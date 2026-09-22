// Export regression guard.
//
// Tests the REAL src/lib/exportFormat.ts (bundled by esbuild), not a copy.
//
//   npm run test:export
//
// It also writes a sample file to scripts/.tmp/sample-export.html so the
// readable output can be opened and looked at, which is the whole point of
// that format.
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toHTML, toCSV, toJSON, buildFile, RANGE_LABEL } from './.tmp/export.bundle.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '.tmp')
mkdirSync(OUT, { recursive: true })

let fails = 0
const check = (name, cond, extra = '') => {
  if (cond) console.log(`  ok   ${name}`)
  else { console.log(`  FAIL ${name} ${extra}`); fails++ }
}

/* ------------------------------------------------------------- fixtures -- */

const OWNER = 'owner-1'
const day = (n) => {
  const d = new Date(Date.UTC(2026, 8, 22 - n))
  return d.toISOString().slice(0, 10)
}

const entry = (kind, n, title, extra = {}) => ({
  id: `e${kind}${n}${title}`, owner_id: OWNER, kind,
  entry_date: day(n), logged_at: `${day(n)}T12:30:00.000Z`,
  title, notes: '', is_private: false,
  meal_type: null, calories: null, protein_g: null,
  duration_min: null, intensity: null, category: null,
  created_at: `${day(n)}T12:30:00.000Z`, ...extra,
})

// Deliberately nasty strings: these must not break CSV or HTML.
const NASTY = 'Comma, "quotes" & <script>alert(1)</script>\nsecond line'

const bundle = {
  generatedAt: '2026-09-22T09:00:00.000Z',
  ownerName: 'Sam',
  units: 'imperial',
  rangeLabel: RANGE_LABEL.all,
  fromISO: day(10),
  toISO: day(0),
  asPartner: false,
  sharedCategories: undefined,
  body: {
    owner_id: OWNER, birthdate: '1998-04-12', height_cm: 165,
    goal_weight_kg: 64, activity_level: 'moderate', notes: '',
    updated_at: '2026-09-01T00:00:00.000Z',
  },
  weights: [0, 3, 6].map((n) => ({
    id: `w${n}`, owner_id: OWNER, log_date: day(n),
    weight_kg: 68 - n * 0.2, note: '', created_at: `${day(n)}T07:00:00.000Z`,
  })).reverse(),
  entries: [
    entry('food', 0, 'Eggs & toast', { meal_type: 'breakfast', calories: 420, protein_g: 28 }),
    entry('workout', 0, 'Legs', { duration_min: 55, intensity: 'hard', notes: NASTY }),
    entry('task', 1, NASTY),
    entry('food', 2, 'Pasta', { meal_type: 'dinner', calories: 700, is_private: true }),
  ],
  days: [{
    id: 'd0', owner_id: OWNER, log_date: day(0), mood: 5, energy: 4,
    sleep_hours: 7.5, water_cups: 8, day_note: NASTY, is_private: false,
    updated_at: `${day(0)}T20:00:00.000Z`,
  }],
  journal: [{
    id: 'j0', owner_id: OWNER, log_date: day(1), body: NASTY,
    created_at: '', updated_at: '',
  }],
  goals: [{
    id: 'g0', owner_id: OWNER, title: 'Workouts each week',
    metric: 'workouts_per_week', target_value: 4, active: true,
    created_at: '2026-09-01T00:00:00.000Z',
  }],
  notes: [{
    id: 'n0', owner_id: OWNER, author_id: 'p1', body: NASTY,
    reaction: 'heart', created_at: `${day(0)}T18:00:00.000Z`,
  }],
}

const TOTAL_RECORDS = bundle.entries.length + bundle.days.length + bundle.weights.length
  + bundle.goals.length + bundle.notes.length + bundle.journal.length

/* ------------------------------------------------------------------ CSV -- */

function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

console.log('CSV')
console.log('-'.repeat(56))
const csv = toCSV(bundle)
const rows = parseCsv(csv)
const widths = [...new Set(rows.map((r) => r.length))]

check('starts with a UTF-8 BOM so Excel reads accents', csv.charCodeAt(0) === 0xFEFF)
check('every row has an identical field count', widths.length === 1, `got ${widths}`)
check('one row per record plus a header',
  rows.length === TOTAL_RECORDS + 1, `got ${rows.length - 1}, expected ${TOTAL_RECORDS}`)
check('CRLF line endings', csv.includes('\r\n'))

// the round trip is the real test of quoting
const nastyCells = rows.flat().filter((c) => c.includes('<script>'))
check('commas, quotes and newlines survive a round trip',
  nastyCells.length >= 3 && nastyCells.every((c) => c === NASTY),
  `found ${nastyCells.length}`)
check('a private entry is marked private',
  rows.some((r) => r[0] === 'food' && r[14] === 'yes'))

/* ----------------------------------------------------------------- HTML -- */

console.log('\nHTML')
console.log('-'.repeat(56))
const html = toHTML(bundle)

check('is a complete document', html.startsWith('<!doctype html>') && html.trimEnd().endsWith('</html>'))
check('contains no script tags at all', !/<script/i.test(html))
check('references nothing external', !/(src|href)\s*=\s*["']https?:/i.test(html))
check('escapes user text rather than embedding markup',
  html.includes('&lt;script&gt;') && !html.includes('<script>alert(1)</script>'))
check('shows the person\'s name', html.includes('<h1>Sam</h1>'))
check('includes an inline weight chart', html.includes('<svg') && html.includes('class="chart"'))
check('includes the journal when asked', html.includes('Journal'))

const partnerHtml = toHTML({ ...bundle, asPartner: true, journal: [] })
check('partner copy says it is only what was shared',
  partnerHtml.includes('chose to share with you'))
check('partner copy carries the snapshot warning',
  partnerHtml.includes('treat it as theirs'))

/* ----------------------------------------------------------------- JSON -- */

console.log('\nJSON')
console.log('-'.repeat(56))
const parsed = JSON.parse(toJSON(bundle))
check('parses', true)
check('is versioned', parsed.format === 'daily-export' && parsed.version === 1)
check('keeps every entry', parsed.entries.length === bundle.entries.length)
check('keeps the journal', parsed.journal.length === 1)
check('labels who exported it', parsed.exportedBy.startsWith('owner'))

const partnerJson = JSON.parse(toJSON({ ...bundle, asPartner: true, journal: [] }))
check('partner copy is labelled as shared-only', partnerJson.exportedBy.includes('partner'))
check('partner copy carries no journal', partnerJson.journal.length === 0)

/* -------------------------------------------------------------- naming -- */

console.log('\nFilenames')
console.log('-'.repeat(56))
for (const fmt of ['html', 'csv', 'json']) {
  const f = buildFile(bundle, fmt)
  check(`${fmt}: safe filename ${f.filename}`, /^[a-z0-9-]+\.[a-z]+$/.test(f.filename))
}
const odd = buildFile({ ...bundle, ownerName: '  Ana María / O\'Brien  ' }, 'csv')
check(`awkward names are made filename-safe (${odd.filename})`,
  /^[a-z0-9-]+\.csv$/.test(odd.filename))

/* -------------------------------------------------------------- sample -- */

writeFileSync(join(OUT, 'sample-export.html'), html, 'utf8')
writeFileSync(join(OUT, 'sample-export.csv'), csv, 'utf8')
console.log(`\nsample written to scripts/.tmp/sample-export.html (${html.length} bytes)`)

console.log(`\n${fails === 0 ? 'ALL EXPORT CHECKS PASS' : `*** ${fails} FAILURE(S) ***`}`)
process.exit(fails === 0 ? 0 : 1)
