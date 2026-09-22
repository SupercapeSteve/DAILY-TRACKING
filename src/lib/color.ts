// Pure colour maths. No DOM, no imports - so it can be tested on its own,
// which matters because a wrong answer here makes buttons unreadable.

const HEX = /^#[0-9a-f]{6}$/i

export function clampHex(v: unknown, fallback: string): string {
  return typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : fallback
}

export function toRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

const byte = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1 to 21. 4.5 is the target for normal text. */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export const WHITE = '#ffffff'
export const DARK_INK = '#16161a'

/**
 * Whichever of white / near-black is actually more readable on `bg`.
 *
 * Do NOT replace this with a luminance threshold. The white-vs-black
 * crossover sits near L=0.18, not in the middle of the range, so a mid-tone
 * colour like a dusty rose looks "darkish" while still needing dark text.
 * Comparing the two real ratios is exact and needs no magic number.
 */
export function bestInk(bg: string): string {
  return contrast(WHITE, bg) >= contrast(DARK_INK, bg) ? WHITE : DARK_INK
}

export function mix(a: string, b: string, weightOfA: number): string {
  const [r1, g1, b1] = toRgb(a)
  const [r2, g2, b2] = toRgb(b)
  const w = Math.max(0, Math.min(1, weightOfA))
  return `#${byte(r1 * w + r2 * (1 - w))}${byte(g1 * w + g2 * (1 - w))}${byte(b1 * w + b2 * (1 - w))}`
}

export interface ResolvedAccent {
  primary: string
  onPrimary: string
  ratio: number
}

/** WCAG AA for normal-size text. */
export const TEXT_TARGET = 4.5

/**
 * Turns whatever colour someone picked into a filled-button background that
 * can actually carry text, plus the ink to put on it.
 *
 * Corrections, in order:
 *  1. a very dark accent is lifted, or it vanishes against a dark background
 *  2. a very light accent is pulled down, or no ink is readable on it
 *  3. if the better ink STILL cannot reach 4.5:1, the background is nudged
 *     away from that ink until it can
 *
 * Step 3 matters more than it looks. Plenty of perfectly ordinary mid-tone
 * colours - a dusty rose, a mid blue - sit in a dead zone where neither white
 * nor black reaches 4.5:1 on their own. Without this they ship at ~4.3:1.
 *
 * The nudge direction comes from bestInk, which makes it monotonic: moving
 * away from the chosen ink only ever increases contrast, so the loop cannot
 * oscillate, and it is bounded anyway.
 */
export function resolveAccent(accent: string, mode: 'light' | 'dark'): ResolvedAccent {
  let primary = clampHex(accent, '#5b8c6e')

  if (mode === 'dark' && luminance(primary) < 0.22) {
    primary = mix(primary, WHITE, 0.72)
  }
  for (let i = 0; i < 12 && luminance(primary) > 0.55; i++) {
    primary = mix(primary, '#000000', 0.9)
  }

  const onPrimary = bestInk(primary)
  const away = onPrimary === WHITE ? '#000000' : WHITE
  for (let i = 0; i < 40 && contrast(onPrimary, primary) < TEXT_TARGET; i++) {
    primary = mix(primary, away, 0.96)
  }

  return { primary, onPrimary, ratio: contrast(onPrimary, primary) }
}
