// ============================================================================
//  Export - gathering and delivery
//
//  Scope is not decided here. The partner's export simply runs the same
//  queries and keeps whatever comes back - Row Level Security already decides
//  what that is. So a category that is switched off, an entry marked private,
//  or a paused account all produce an empty result rather than needing a
//  second set of rules here that could drift from the first.
//
//  Everything is generated in the browser. Nothing is uploaded anywhere, and
//  no server ever sees the file.
// ============================================================================

import * as api from './api'
import { todayISO, addDays } from './dates'
import type {
  BodyProfile, DayLog, Entry, Feedback, Goal, JournalEntry, WeightLog,
} from './types'
import type { ExportBundle, ExportOptions } from './exportFormat'
import { RANGE_LABEL } from './exportFormat'

export type {
  ExportBundle, ExportFormat, ExportOptions, ExportRange,
} from './exportFormat'
export { toJSON, toCSV, toHTML, buildFile } from './exportFormat'

/* --------------------------------------------------------------- gather --- */

export async function gather(opts: ExportOptions): Promise<ExportBundle> {
  const to = todayISO()
  const from = opts.range === 'all' ? '1970-01-01' : addDays(to, -Number(opts.range) + 1)

  // Anything the caller is not allowed to read comes back empty instead of
  // throwing, so one blocked category never fails the whole export.
  const safe = <T>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback)

  const [entries, days, weights, goals, notes, body, journal] = await Promise.all([
    safe(api.listEntries(opts.ownerId, from, to), [] as Entry[]),
    safe(api.listDayLogs(opts.ownerId, from, to), [] as DayLog[]),
    safe(api.listWeights(opts.ownerId, opts.range === 'all' ? undefined : from), [] as WeightLog[]),
    safe(api.listGoals(opts.ownerId), [] as Goal[]),
    safe(api.listFeedback(opts.ownerId, 500), [] as Feedback[]),
    safe(api.getBodyProfile(opts.ownerId), null as BodyProfile | null),
    opts.includeJournal && !opts.asPartner
      ? safe(api.listJournal(opts.ownerId, 1000), [] as JournalEntry[])
      : Promise.resolve([] as JournalEntry[]),
  ])

  return {
    generatedAt: new Date().toISOString(),
    ownerName: opts.ownerName,
    units: opts.units,
    rangeLabel: RANGE_LABEL[opts.range],
    fromISO: entries.length || days.length ? from : from,
    toISO: to,
    asPartner: opts.asPartner,
    sharedCategories: opts.sharedCategories,
    body,
    weights,
    entries: [...entries].sort(byDateThenTime),
    days: [...days].sort((a, b) => a.log_date.localeCompare(b.log_date)),
    journal: [...journal].sort((a, b) => a.log_date.localeCompare(b.log_date)),
    goals,
    notes,
  }
}

function byDateThenTime(a: Entry, b: Entry): number {
  return a.entry_date.localeCompare(b.entry_date) || a.logged_at.localeCompare(b.logged_at)
}

export function isEmpty(b: ExportBundle): boolean {
  return !b.entries.length && !b.days.length && !b.weights.length
    && !b.journal.length && !b.goals.length && !b.notes.length
}

export function download(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * On a phone the share sheet is far more useful than a download, because it
 * can hand the file straight to Messages, Mail, Drive or Files. Falls back to
 * a plain download wherever sharing files is not supported.
 */
export async function shareOrDownload(
  filename: string, content: string, mime: string, title: string,
): Promise<'shared' | 'downloaded'> {
  try {
    const file = new File([content], filename, { type: mime })
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title })
      return 'shared'
    }
  } catch {
    // cancelled, or the browser refused - fall through to a download
  }
  download(filename, content, mime)
  return 'downloaded'
}

/** Opens the readable version in a new tab, for people who would rather look
 *  at it than save it. */
export function openInTab(content: string, mime: string): boolean {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const w = window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return Boolean(w)
}
