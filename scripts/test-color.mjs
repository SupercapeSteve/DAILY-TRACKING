// Contrast regression guard.
//
// Tests the REAL src/lib/color.ts (bundled by esbuild), not a copy of it, so
// it cannot silently drift from what ships.
//
//   npm run test:color
//
// This exists because a wrong readability rule is invisible in review: the
// app looks fine, and only some accent colours end up unreadable. An earlier
// version used a luminance threshold and shipped white-on-rose at 2.83:1.
import { contrast, resolveAccent, bestInk, luminance } from './.tmp/color.bundle.mjs'
import { sanitizePrefs, DEFAULT_PREFS } from './.tmp/theme.bundle.mjs'

const ACCENTS = [
  ['Sage', '#5b8c6e'], ['Forest', '#3f7d52'], ['Teal', '#2f8f86'],
  ['Ocean', '#2f7fbf'], ['Indigo', '#5b62c9'], ['Violet', '#8b5cc9'],
  ['Orchid', '#b455b0'], ['Rose', '#d1477a'], ['Coral', '#e0653f'],
  ['Amber', '#cf8a1e'], ['Olive', '#7d8b3a'], ['Slate', '#5b6b7a'],
]

// Nasty values a colour picker can genuinely produce.
const EXTREMES = [
  ['white', '#ffffff'], ['black', '#000000'], ['lemon', '#ffff00'],
  ['cyan', '#00ffff'], ['lime', '#00ff00'], ['magenta', '#ff00ff'],
  ['near-black', '#050505'], ['pale pink', '#ffe4ec'],
]

const TARGET = 4.5
let fails = 0
let worst = { ratio: Infinity, label: '' }

console.log('accent'.padEnd(12), 'mode'.padEnd(6), 'button bg'.padEnd(11), 'ink'.padEnd(9), 'ratio')
console.log('-'.repeat(56))

for (const [label, hex] of [...ACCENTS, ...EXTREMES]) {
  for (const mode of ['light', 'dark']) {
    const { primary, onPrimary, ratio } = resolveAccent(hex, mode)
    const ok = ratio >= TARGET
    if (!ok) fails++
    if (ratio < worst.ratio) worst = { ratio, label: `${label}/${mode}` }
    console.log(
      label.padEnd(12), mode.padEnd(6), primary.padEnd(11),
      onPrimary.padEnd(9), ratio.toFixed(2), ok ? '' : '  <-- FAIL',
    )
  }
}

console.log('-'.repeat(56))
console.log(`worst case: ${worst.label} at ${worst.ratio.toFixed(2)}:1`)

// the specific bug that prompted this: white on dusty rose was 2.83:1
const rose = resolveAccent('#d1477a', 'dark')
console.log(`\nregression - Rose in dark mode: ink ${rose.onPrimary} at ${rose.ratio.toFixed(2)}:1`)
if (rose.ratio < TARGET) { console.log('REGRESSION STILL PRESENT'); fails++ }

// sanity: bestInk must actually pick the better of the two
for (const [, hex] of [...ACCENTS, ...EXTREMES]) {
  const ink = bestInk(hex)
  const other = ink === '#ffffff' ? '#16161a' : '#ffffff'
  if (contrast(ink, hex) < contrast(other, hex)) {
    console.log(`bestInk picked the worse ink for ${hex}`); fails++
  }
}

// sanity: luminance bounds
for (const [, hex] of EXTREMES) {
  const l = luminance(hex)
  if (l < -1e-9 || l > 1 + 1e-9) { console.log(`luminance out of range for ${hex}: ${l}`); fails++ }
}

/* ------------------------------------------------------------------------
   Prefs come out of a jsonb column, so they can be anything at all. Every
   one of these must produce a complete, usable set of values rather than
   throwing or yielding undefined - otherwise one bad row blanks the app.
   ------------------------------------------------------------------------ */
console.log('\nsanitizePrefs against hostile input')
console.log('-'.repeat(56))

const KEYS = Object.keys(DEFAULT_PREFS)
const HEX_RE = /^#[0-9a-f]{6}$/
const COLOUR_KEYS = ['accent', 'catFood', 'catWorkout', 'catTask', 'catDay']

const HOSTILE = [
  ['null', null],
  ['undefined', undefined],
  ['a string', 'not an object'],
  ['a number', 42],
  ['an array', [1, 2, 3]],
  ['empty object', {}],
  ['unknown enum values', { theme: 'neon', tint: 'plaid', density: 'huge', font: 'comic' }],
  ['bad hex', { accent: 'red', catFood: '#xyz', catTask: '#12345', catDay: 12 }],
  ['3-digit hex', { accent: '#abc' }],
  ['nulls everywhere', Object.fromEntries(KEYS.map((k) => [k, null]))],
  ['wrong types', Object.fromEntries(KEYS.map((k) => [k, { nested: true }]))],
  ['blank app name', { appName: '   ' }],
  ['giant app name', { appName: 'x'.repeat(500) }],
  ['prototype pollution attempt', JSON.parse('{"__proto__":{"polluted":true},"theme":"dark"}')],
  ['unknown keys from a future version', { theme: 'dark', somethingNew: 'later' }],
]

for (const [label, input] of HOSTILE) {
  let out
  try {
    out = sanitizePrefs(input)
  } catch (e) {
    console.log(`  FAIL ${label}: threw ${e.message}`)
    fails++
    continue
  }
  const missing = KEYS.filter((k) => out[k] === undefined || out[k] === null)
  const badName = typeof out.appName !== 'string' || !out.appName.trim() || out.appName.length > 24
  const badHex = COLOUR_KEYS.filter((k) => !HEX_RE.test(out[k]))
  if (missing.length || badName || badHex.length) {
    console.log(`  FAIL ${label}: missing=${missing} badName=${badName} badHex=${badHex}`)
    fails++
  } else {
    console.log(`  ok   ${label}`)
  }
}

if ({}.polluted !== undefined) {
  console.log('  FAIL the prototype was polluted')
  fails++
} else {
  console.log('  ok   prototype not polluted')
}

// a valid set must survive a round trip completely untouched
const round = sanitizePrefs(JSON.parse(JSON.stringify(DEFAULT_PREFS)))
let drifted = 0
for (const k of KEYS) {
  if (round[k] !== DEFAULT_PREFS[k]) {
    console.log(`  FAIL round trip changed ${k}: ${DEFAULT_PREFS[k]} -> ${round[k]}`)
    fails++
    drifted++
  }
}
if (!drifted) console.log('  ok   valid prefs survive a round trip unchanged')

console.log(`\n${fails === 0 ? 'ALL CHECKS PASS' : `*** ${fails} FAILURE(S) ***`}`)
process.exit(fails === 0 ? 0 : 1)
