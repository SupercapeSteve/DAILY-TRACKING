// ============================================================================
//  Export - file building
//
//  Deliberately free of any data-layer or browser dependency: it takes a
//  finished ExportBundle and returns a string. That keeps it runnable in
//  Node, which is how scripts/test-export.mjs checks the real output rather
//  than a copy of it.
// ============================================================================

import { fromISO, clockTime } from './dates'
import { rollupRange, summarize, weightTrend, loggedDates } from './stats'
import { currentStreak } from './dates'
import {
  formatWeight, formatWeightDelta, ageFrom, formatHeight, formatDuration,
  kgToWeightInput, weightUnitLabel,
} from './units'
import type {
  BodyProfile, DayLog, Entry, Feedback, Goal, JournalEntry, Units, WeightLog,
} from './types'

export type ExportFormat = 'html' | 'csv' | 'json'
export type ExportRange = 'all' | '30' | '90' | '365'

export interface ExportOptions {
  ownerId: string
  ownerName: string
  units: Units
  range: ExportRange
  /** Owner only. The journal is unreachable for anyone else regardless. */
  includeJournal: boolean
  /** Changes wording and adds the "this is a snapshot" notice. */
  asPartner: boolean
  /** Which categories were shared at the moment of export, if known. */
  sharedCategories?: string[]
}

export interface ExportBundle {
  generatedAt: string
  ownerName: string
  units: Units
  rangeLabel: string
  fromISO: string
  toISO: string
  asPartner: boolean
  sharedCategories?: string[]
  body: BodyProfile | null
  weights: WeightLog[]
  entries: Entry[]
  days: DayLog[]
  journal: JournalEntry[]
  goals: Goal[]
  notes: Feedback[]
}

export const RANGE_LABEL: Record<ExportRange, string> = {
  all: 'Everything',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  '365': 'Last 12 months',
}

/* ------------------------------------------------------------------ JSON -- */

export function toJSON(b: ExportBundle): string {
  return JSON.stringify(
    {
      format: 'daily-export',
      version: 1,
      generatedAt: b.generatedAt,
      person: b.ownerName,
      range: { label: b.rangeLabel, from: b.fromISO, to: b.toISO },
      exportedBy: b.asPartner ? 'partner (shared data only)' : 'owner (complete)',
      sharedCategories: b.sharedCategories ?? null,
      units: b.units,
      note: b.asPartner
        ? 'This contains only what was being shared at the time of export.'
        : 'This is a complete copy of your own data.',
      bodyProfile: b.body,
      weights: b.weights,
      entries: b.entries,
      dayLogs: b.days,
      journal: b.journal,
      goals: b.goals,
      partnerNotes: b.notes,
    },
    null,
    2,
  )
}

/* ------------------------------------------------------------------- CSV -- */

const CSV_COLUMNS = [
  'type', 'date', 'time', 'title', 'category', 'duration_min', 'calories',
  'protein_g', 'mood_1_5', 'energy_1_5', 'sleep_hours', 'water_cups',
  'weight', 'weight_unit', 'private', 'notes',
] as const

/** RFC 4180: quote anything containing a comma, quote or newline. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',')

export function toCSV(b: ExportBundle): string {
  const unit = weightUnitLabel(b.units)
  const rows: unknown[][] = []

  b.entries.forEach((e) => rows.push([
    e.kind, e.entry_date, clockTime(e.logged_at), e.title,
    e.meal_type ?? e.intensity ?? e.category ?? '',
    e.duration_min ?? '', e.calories ?? '', e.protein_g ?? '',
    '', '', '', '', '', '', e.is_private ? 'yes' : 'no', e.notes,
  ]))

  b.days.forEach((d) => rows.push([
    'day', d.log_date, '', 'How the day went', '',
    '', '', '',
    d.mood ?? '', d.energy ?? '', d.sleep_hours ?? '', d.water_cups ?? '',
    '', '', d.is_private ? 'yes' : 'no', d.day_note,
  ]))

  b.weights.forEach((w) => rows.push([
    'weight', w.log_date, '', 'Weigh-in', '',
    '', '', '', '', '', '', '',
    kgToWeightInput(Number(w.weight_kg), b.units) ?? '', unit, 'no', w.note,
  ]))

  b.goals.forEach((g) => rows.push([
    'goal', '', '', g.title, g.metric,
    '', '', '', '', '', '', '',
    g.target_value ?? '', '', 'no', g.active ? 'active' : 'inactive',
  ]))

  b.notes.forEach((n) => rows.push([
    'partner_note', n.created_at.slice(0, 10), clockTime(n.created_at),
    'Note from partner', '', '', '', '', '', '', '', '', '', '', 'no', n.body,
  ]))

  b.journal.forEach((j) => rows.push([
    'journal', j.log_date, '', 'Journal entry', '',
    '', '', '', '', '', '', '', '', '', 'yes', j.body,
  ]))

  rows.sort((a, b2) => String(a[1] ?? '').localeCompare(String(b2[1] ?? '')))

  // The BOM makes Excel read it as UTF-8 instead of mangling any accents.
  return '﻿' + [csvRow([...CSV_COLUMNS]), ...rows.map(csvRow)].join('\r\n') + '\r\n'
}

/* ------------------------------------------------------------------ HTML -- */

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const MOODS = ['\u{1F622}', '\u{1F641}', '\u{1F610}', '\u{1F642}', '\u{1F604}']
const MOOD_WORDS = ['Rough', 'Meh', 'Okay', 'Good', 'Great']

function longDay(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

/** A small inline SVG so the file stays self-contained with no scripts. */
function weightSvg(points: { date: string; kg: number }[], goalKg: number | null, units: Units): string {
  if (points.length < 2) return ''
  const W = 640, H = 180, PX = 36, PT = 16, PB = 28
  const vals = points.map((p) => p.kg)
  if (goalKg) vals.push(goalKg)
  let lo = Math.min(...vals), hi = Math.max(...vals)
  if (hi - lo < 1) { lo -= 1; hi += 1 }
  const pad = (hi - lo) * 0.15
  lo -= pad; hi += pad
  const x = (i: number) => PX + (i / (points.length - 1)) * (W - PX * 2)
  const y = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ')
  const goalLine = goalKg != null && goalKg >= lo && goalKg <= hi
    ? `<line x1="${PX}" x2="${W - PX}" y1="${y(goalKg).toFixed(1)}" y2="${y(goalKg).toFixed(1)}"
         stroke="#d98e8e" stroke-width="1.5" stroke-dasharray="5 4"/>`
    : ''
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img"
    aria-label="Weight trend">${goalLine}
    <path d="${line}" fill="none" stroke="#5b8c6e" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${PX}" y="${H - 8}" font-size="11" fill="#948a80">${esc(points[0]!.date)}</text>
    <text x="${W - PX}" y="${H - 8}" font-size="11" fill="#948a80" text-anchor="end">${esc(points[points.length - 1]!.date)}</text>
    <text x="${PX}" y="12" font-size="11" fill="#948a80">${esc(formatWeight(hi - pad, units))}</text>
  </svg>`
}

export function toHTML(b: ExportBundle): string {
  const dates = [...new Set([
    ...b.entries.map((e) => e.entry_date),
    ...b.days.map((d) => d.log_date),
    ...b.journal.map((j) => j.log_date),
  ])].sort().reverse()

  const rolls = rollupRange(dates.slice().reverse(), b.entries, b.days)
  const sum = summarize(rolls)
  const streak = currentStreak(loggedDates(b.entries, b.days))
  const trend = weightTrend(b.weights)
  const latest = b.weights.length ? Number(b.weights[b.weights.length - 1]!.weight_kg) : null
  const first = b.weights.length ? Number(b.weights[0]!.weight_kg) : null
  const age = ageFrom(b.body?.birthdate)

  const stat = (v: string | number, l: string) =>
    `<div class="stat"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`

  const daySections = dates.map((date) => {
    const es = b.entries.filter((e) => e.entry_date === date)
    const day = b.days.find((d) => d.log_date === date)
    const jrn = b.journal.filter((j) => j.log_date === date && j.body.trim())
    if (!es.length && !day && !jrn.length) return ''

    const rows = es.map((e) => {
      const bits = [
        clockTime(e.logged_at),
        e.meal_type, e.intensity,
        e.duration_min ? formatDuration(e.duration_min) : null,
        e.calories ? `${e.calories} cal` : null,
        e.protein_g ? `${e.protein_g}g protein` : null,
        e.is_private ? 'private' : null,
      ].filter(Boolean).join(' &middot; ')
      return `<tr>
        <td class="k k--${esc(e.kind)}">${esc(e.kind)}</td>
        <td><strong>${esc(e.title)}</strong>${e.notes.trim() ? `<div class="note">${esc(e.notes)}</div>` : ''}</td>
        <td class="meta">${bits}</td>
      </tr>`
    }).join('')

    const dayBlock = day && (day.mood != null || day.day_note.trim() || day.sleep_hours != null)
      ? `<div class="day-summary">
          ${day.mood != null ? `<span class="mood">${MOODS[day.mood - 1]} ${esc(MOOD_WORDS[day.mood - 1] ?? '')}</span>` : ''}
          ${day.sleep_hours != null ? `<span>${esc(day.sleep_hours)}h sleep</span>` : ''}
          ${day.water_cups ? `<span>${esc(day.water_cups)} cups water</span>` : ''}
          ${day.energy != null ? `<span>energy ${esc(day.energy)}/5</span>` : ''}
          ${day.day_note.trim() ? `<p class="quote">${esc(day.day_note)}</p>` : ''}
        </div>` : ''

    const jrnBlock = jrn.length
      ? `<div class="journal"><h4>Journal</h4>${jrn.map((j) => `<p class="quote">${esc(j.body)}</p>`).join('')}</div>`
      : ''

    return `<section class="day">
      <h3>${esc(longDay(date))}</h3>
      ${dayBlock}
      ${rows ? `<table>${rows}</table>` : ''}
      ${jrnBlock}
    </section>`
  }).join('')

  const notesBlock = b.notes.length
    ? `<section><h2>Notes from partner</h2>${b.notes.map((n) => `
        <div class="pnote"><p class="quote">${esc(n.body)}</p>
        <div class="meta">${esc(n.created_at.slice(0, 10))}</div></div>`).join('')}</section>`
    : ''

  const goalsBlock = b.goals.length
    ? `<section><h2>Goals</h2><table>${b.goals.map((g) => `
        <tr><td><strong>${esc(g.title)}</strong></td>
        <td class="meta">target ${esc(g.target_value ?? '')}</td></tr>`).join('')}</table></section>`
    : ''

  const bodyBlock = (age != null || b.body?.height_cm || latest != null)
    ? `<section><h2>Body</h2><div class="stats">
        ${age != null ? stat(age, 'years') : ''}
        ${b.body?.height_cm ? stat(formatHeight(b.body.height_cm, b.units), 'height') : ''}
        ${latest != null ? stat(formatWeight(latest, b.units), 'latest weight') : ''}
        ${b.body?.goal_weight_kg ? stat(formatWeight(b.body.goal_weight_kg, b.units), 'goal') : ''}
        ${latest != null && first != null && b.weights.length > 1
          ? stat(formatWeightDelta(latest - first, b.units), 'change') : ''}
      </div>
      ${weightSvg(trend, b.body?.goal_weight_kg ?? null, b.units)}
      </section>`
    : ''

  const scopeNotice = b.asPartner
    ? `<div class="notice">
        <strong>This is only what ${esc(b.ownerName)} chose to share with you</strong>, as it
        stood on ${esc(b.generatedAt.slice(0, 10))}. Entries they marked private are not here,
        their journal is never included, and they may change or stop sharing at any time.
        This file is a snapshot of their information - please treat it as theirs.
       </div>`
    : `<div class="notice">
        This is your own complete copy${b.journal.length ? ', including your private journal' : ''}.
        It was made in your browser and was not sent anywhere.
       </div>`

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(b.ownerName)} - Daily export ${esc(b.toISO)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; padding:32px 20px 64px; background:#fbf7f4; color:#2c2723;
    font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width: 820px; margin: 0 auto; }
  h1 { font-size:30px; margin:0 0 4px; letter-spacing:-.02em; }
  h2 { font-size:19px; margin:34px 0 12px; padding-bottom:6px; border-bottom:2px solid #e8e0d8; }
  h3 { font-size:16px; margin:0 0 8px; }
  h4 { font-size:14px; margin:12px 0 4px; color:#6b6159; }
  .sub { color:#6b6159; margin:0 0 20px; }
  .notice { background:#f1f6f2; border:1px solid #dfeae2; border-radius:12px;
    padding:13px 16px; font-size:14.5px; color:#3b634c; margin:18px 0 8px; }
  .stats { display:flex; flex-wrap:wrap; gap:10px; margin:14px 0; }
  .stat { flex:1 1 110px; background:#fff; border:1px solid #e8e0d8; border-radius:12px;
    padding:12px; text-align:center; }
  .stat .v { font-size:22px; font-weight:700; }
  .stat .l { font-size:12px; color:#948a80; margin-top:2px; }
  .chart { width:100%; height:auto; background:#fff; border:1px solid #e8e0d8;
    border-radius:12px; margin-top:10px; }
  section.day { background:#fff; border:1px solid #e8e0d8; border-radius:12px;
    padding:14px 16px; margin-bottom:10px; page-break-inside:avoid; }
  table { width:100%; border-collapse:collapse; }
  td { padding:7px 6px; vertical-align:top; border-top:1px solid #f1ece6; font-size:15px; }
  tr:first-child td { border-top:0; }
  .k { width:78px; font-size:11px; text-transform:uppercase; letter-spacing:.05em;
    font-weight:700; color:#fff; }
  .k--food span, .k { border-radius:5px; }
  .k--food { color:#a7681f; } .k--workout { color:#3b634c; }
  .k--task { color:#3f5c8a; }
  .meta { color:#6b6159; font-size:13.5px; white-space:nowrap; }
  .note { color:#6b6159; font-size:14px; margin-top:2px; }
  .day-summary { display:flex; flex-wrap:wrap; gap:10px; font-size:14px;
    color:#6b6159; margin-bottom:8px; }
  .mood { font-weight:650; color:#2c2723; }
  .quote { background:#f7f3ef; border-left:3px solid #d9cfc4; border-radius:0 8px 8px 0;
    margin:6px 0 0; padding:8px 12px; white-space:pre-wrap; font-size:14.5px; }
  .journal .quote { border-left-color:#9b7ebd; }
  .pnote { background:#fff; border:1px solid #e8e0d8; border-radius:12px;
    padding:10px 14px; margin-bottom:8px; }
  footer { margin-top:40px; color:#948a80; font-size:13px; text-align:center; }
  @media print { body { background:#fff; padding:0; } section.day, .stat { border-color:#ccc; } }
</style></head><body><div class="wrap">
  <h1>${esc(b.ownerName)}</h1>
  <p class="sub">${esc(b.rangeLabel)} &middot; up to ${esc(b.toISO)}
    &middot; exported ${esc(b.generatedAt.slice(0, 10))}</p>
  ${scopeNotice}

  <h2>At a glance</h2>
  <div class="stats">
    ${stat(sum.workouts, 'workouts')}
    ${stat(sum.workoutMin, 'gym minutes')}
    ${stat(sum.tasks, 'tasks')}
    ${stat(sum.meals, 'meals logged')}
    ${stat(sum.daysLogged, 'days logged')}
    ${stat(streak, 'day streak')}
    ${sum.avgMood != null ? stat(sum.avgMood, 'average mood') : ''}
    ${sum.avgProtein != null ? stat(`${sum.avgProtein}g`, 'avg protein') : ''}
  </div>

  ${bodyBlock}
  ${goalsBlock}

  <h2>Day by day</h2>
  ${daySections || '<p class="sub">Nothing logged in this period.</p>'}

  ${notesBlock}

  <footer>Generated by Daily &middot; ${esc(b.generatedAt)}</footer>
</div></body></html>`
}

/* -------------------------------------------------------------- delivery -- */

export function buildFile(b: ExportBundle, format: ExportFormat): {
  filename: string; content: string; mime: string
} {
  const who = (b.ownerName || 'daily').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const stamp = b.toISO
  if (format === 'csv') {
    return { filename: `${who}-daily-${stamp}.csv`, content: toCSV(b), mime: 'text/csv;charset=utf-8' }
  }
  if (format === 'json') {
    return { filename: `${who}-daily-${stamp}.json`, content: toJSON(b), mime: 'application/json' }
  }
  return { filename: `${who}-daily-${stamp}.html`, content: toHTML(b), mime: 'text/html;charset=utf-8' }
}

