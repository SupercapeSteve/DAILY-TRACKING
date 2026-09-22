// ============================================================================
//  Appearance
//  Everything a person can change about how the app looks resolves to CSS
//  custom properties set on <html>. Inline custom properties beat the
//  stylesheet, so whatever is set here always wins.
//
//  The database is the source of truth, which is what makes a look follow the
//  account onto a new device. localStorage is only a cache so the right theme
//  paints immediately instead of flashing the default first - and it is keyed
//  by user id so two accounts on one device never inherit each other's look.
// ============================================================================

import { bestInk, clampHex, mix, resolveAccent } from './color'

export interface AppearancePrefs {
  theme: ThemeMode
  accent: string
  tint: Tint
  textSize: TextSize
  font: FontChoice
  corners: Corners
  density: Density
  cardStyle: CardStyle
  contrast: Contrast
  motion: Motion
  appName: string
  catFood: string
  catWorkout: string
  catTask: string
  catDay: string
}

export type ThemeMode = 'system' | 'light' | 'dark'
export type Tint = 'warm' | 'neutral' | 'cool'
export type TextSize = 'small' | 'default' | 'large' | 'xlarge'
export type FontChoice = 'system' | 'rounded' | 'serif' | 'mono'
export type Corners = 'sharp' | 'soft' | 'round'
export type Density = 'compact' | 'comfortable' | 'spacious'
export type CardStyle = 'elevated' | 'flat' | 'outlined'
export type Contrast = 'normal' | 'high'
export type Motion = 'full' | 'reduced'

/* ------------------------------------------------------------- choices --- */

export const ACCENTS: { name: string; hex: string }[] = [
  { name: 'Sage', hex: '#5b8c6e' },
  { name: 'Forest', hex: '#3f7d52' },
  { name: 'Teal', hex: '#2f8f86' },
  { name: 'Ocean', hex: '#2f7fbf' },
  { name: 'Indigo', hex: '#5b62c9' },
  { name: 'Violet', hex: '#8b5cc9' },
  { name: 'Orchid', hex: '#b455b0' },
  { name: 'Rose', hex: '#d1477a' },
  { name: 'Coral', hex: '#e0653f' },
  { name: 'Amber', hex: '#cf8a1e' },
  { name: 'Olive', hex: '#7d8b3a' },
  { name: 'Slate', hex: '#5b6b7a' },
]

export const CATEGORY_COLORS: { name: string; hex: string }[] = [
  { name: 'Amber', hex: '#d99036' },
  { name: 'Green', hex: '#5b8c6e' },
  { name: 'Blue', hex: '#6b8fc7' },
  { name: 'Violet', hex: '#9b7ebd' },
  { name: 'Rose', hex: '#d1477a' },
  { name: 'Teal', hex: '#2f8f86' },
  { name: 'Coral', hex: '#e0653f' },
  { name: 'Slate', hex: '#6b7a88' },
]

export const FONTS: Record<FontChoice, { label: string; stack: string }> = {
  system: {
    label: 'System',
    stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  rounded: {
    label: 'Rounded',
    stack: "ui-rounded, 'SF Pro Rounded', 'Segoe UI Variable Display', Nunito, 'Trebuchet MS', system-ui, sans-serif",
  },
  serif: {
    label: 'Serif',
    stack: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif",
  },
  mono: {
    label: 'Mono',
    stack: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace",
  },
}

const TEXT_SCALE: Record<TextSize, number> = {
  small: 0.92, default: 1, large: 1.1, xlarge: 1.22,
}

const CORNERS: Record<Corners, { r: string; sm: string; lg: string }> = {
  sharp: { r: '6px', sm: '4px', lg: '9px' },
  soft: { r: '18px', sm: '12px', lg: '24px' },
  round: { r: '28px', sm: '18px', lg: '34px' },
}

const DENSITY: Record<Density, { gapS: string; gap: string; gapL: string; pad: string }> = {
  compact: { gapS: '6px', gap: '10px', gapL: '14px', pad: '12px' },
  comfortable: { gapS: '8px', gap: '14px', gapL: '22px', pad: '16px' },
  spacious: { gapS: '12px', gap: '19px', gapL: '30px', pad: '22px' },
}

/* ------------------------------------------------------------ palettes --- */

interface Palette {
  bg: string; bgTint: string; surface: string; surface2: string
  border: string; border2: string
  text: string; textSoft: string; textMute: string
}

const PALETTES: Record<Tint, Record<'light' | 'dark', Palette>> = {
  warm: {
    light: {
      bg: '#fbf7f4', bgTint: '#f4efe9', surface: '#ffffff', surface2: '#f7f3ef',
      border: '#e8e0d8', border2: '#d9cfc4',
      text: '#2c2723', textSoft: '#6b6159', textMute: '#948a80',
    },
    dark: {
      bg: '#161311', bgTint: '#1d1917', surface: '#221e1b', surface2: '#2b2521',
      border: '#352e29', border2: '#463d36',
      text: '#f0eae4', textSoft: '#b8ada3', textMute: '#8a7f75',
    },
  },
  neutral: {
    light: {
      bg: '#f7f7f8', bgTint: '#f0f0f2', surface: '#ffffff', surface2: '#f4f4f6',
      border: '#e4e4e7', border2: '#d2d2d8',
      text: '#26262b', textSoft: '#5f5f68', textMute: '#8e8e98',
    },
    dark: {
      bg: '#131316', bgTint: '#19191d', surface: '#1f1f23', surface2: '#27272c',
      border: '#32323a', border2: '#45454f',
      text: '#ececf0', textSoft: '#b0b0ba', textMute: '#83838f',
    },
  },
  cool: {
    light: {
      bg: '#f5f8fb', bgTint: '#eaeff5', surface: '#ffffff', surface2: '#f2f6fa',
      border: '#dfe6ee', border2: '#cbd6e2',
      text: '#212b36', textSoft: '#55636f', textMute: '#85929e',
    },
    dark: {
      bg: '#101418', bgTint: '#151b21', surface: '#1b2229', surface2: '#232c34',
      border: '#2c363f', border2: '#3b4854',
      text: '#e8eef4', textSoft: '#a9b6c2', textMute: '#7c8894',
    },
  },
}

export const DEFAULT_PREFS: AppearancePrefs = {
  theme: 'system',
  accent: '#5b8c6e',
  tint: 'warm',
  textSize: 'default',
  font: 'system',
  corners: 'soft',
  density: 'comfortable',
  cardStyle: 'elevated',
  contrast: 'normal',
  motion: 'full',
  appName: 'Daily',
  catFood: '#d99036',
  catWorkout: '#5b8c6e',
  catTask: '#6b8fc7',
  catDay: '#9b7ebd',
}

/* -------------------------------------------------------- sanitisation --- */

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

/**
 * Prefs arrive from a jsonb column, so they could be anything at all -
 * hand-edited, from a newer version of the app, or corrupt. Every field is
 * validated against the values this build understands and falls back to the
 * default, so bad data can never break rendering.
 */
export function sanitizePrefs(raw: unknown): AppearancePrefs {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const name = typeof p.appName === 'string' ? p.appName.trim().slice(0, 24) : ''
  return {
    theme: oneOf(p.theme, ['system', 'light', 'dark'] as const, DEFAULT_PREFS.theme),
    accent: clampHex(p.accent, DEFAULT_PREFS.accent),
    tint: oneOf(p.tint, ['warm', 'neutral', 'cool'] as const, DEFAULT_PREFS.tint),
    textSize: oneOf(p.textSize, ['small', 'default', 'large', 'xlarge'] as const, DEFAULT_PREFS.textSize),
    font: oneOf(p.font, ['system', 'rounded', 'serif', 'mono'] as const, DEFAULT_PREFS.font),
    corners: oneOf(p.corners, ['sharp', 'soft', 'round'] as const, DEFAULT_PREFS.corners),
    density: oneOf(p.density, ['compact', 'comfortable', 'spacious'] as const, DEFAULT_PREFS.density),
    cardStyle: oneOf(p.cardStyle, ['elevated', 'flat', 'outlined'] as const, DEFAULT_PREFS.cardStyle),
    contrast: oneOf(p.contrast, ['normal', 'high'] as const, DEFAULT_PREFS.contrast),
    motion: oneOf(p.motion, ['full', 'reduced'] as const, DEFAULT_PREFS.motion),
    appName: name || DEFAULT_PREFS.appName,
    catFood: clampHex(p.catFood, DEFAULT_PREFS.catFood),
    catWorkout: clampHex(p.catWorkout, DEFAULT_PREFS.catWorkout),
    catTask: clampHex(p.catTask, DEFAULT_PREFS.catTask),
    catDay: clampHex(p.catDay, DEFAULT_PREFS.catDay),
  }
}

/* ------------------------------------------------------------- applying -- */

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
}

export function resolveMode(prefs: AppearancePrefs): 'light' | 'dark' {
  if (prefs.theme === 'light') return 'light'
  if (prefs.theme === 'dark') return 'dark'
  return systemPrefersDark() ? 'dark' : 'light'
}

/** Writes the whole look onto <html> as custom properties. */
export function applyTheme(prefs: AppearancePrefs): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const mode = resolveMode(prefs)
  const ink = mode === 'dark' ? '#ffffff' : '#000000'
  const paper = mode === 'dark' ? '#000000' : '#ffffff'

  let pal = PALETTES[prefs.tint][mode]
  if (prefs.contrast === 'high') {
    pal = {
      ...pal,
      text: mode === 'dark' ? '#ffffff' : '#0a0a0a',
      textSoft: mode === 'dark' ? '#dcdcdc' : '#2e2e2e',
      textMute: mode === 'dark' ? '#b4b4b4' : '#4a4a4a',
      border: mode === 'dark' ? '#55555d' : '#a8a8a8',
      border2: mode === 'dark' ? '#77777f' : '#7d7d7d',
    }
  }

  const { primary, onPrimary } = resolveAccent(prefs.accent, mode)
  const primaryDark = mode === 'dark' ? mix(primary, '#ffffff', 0.8) : mix(primary, '#000000', 0.82)
  const primarySoft = mix(primary, pal.surface, mode === 'dark' ? 0.2 : 0.12)

  const set = (k: string, v: string) => root.style.setProperty(k, v)

  set('--bg', pal.bg)
  set('--bg-tint', pal.bgTint)
  set('--surface', pal.surface)
  set('--surface-2', pal.surface2)
  set('--border', pal.border)
  set('--border-2', pal.border2)
  set('--text', pal.text)
  set('--text-soft', pal.textSoft)
  set('--text-mute', pal.textMute)

  set('--primary', primary)
  set('--primary-dark', primaryDark)
  set('--primary-soft', primarySoft)
  set('--on-primary', onPrimary)

  // Each category also needs its OWN readable ink. Deriving the icon colour
  // from the accent would leave a pale category dot with an invisible glyph.
  const cats: [string, string][] = [
    ['food', clampHex(prefs.catFood, DEFAULT_PREFS.catFood)],
    ['workout', clampHex(prefs.catWorkout, DEFAULT_PREFS.catWorkout)],
    ['task', clampHex(prefs.catTask, DEFAULT_PREFS.catTask)],
    ['day', clampHex(prefs.catDay, DEFAULT_PREFS.catDay)],
  ]
  cats.forEach(([key, hex]) => {
    set(`--${key}`, hex)
    set(`--on-${key}`, bestInk(hex))
  })

  const danger = mode === 'dark' ? '#e08585' : '#c25b5b'
  set('--danger', danger)
  set('--danger-soft', mix(danger, pal.surface, mode === 'dark' ? 0.18 : 0.1))
  const amber = mode === 'dark' ? '#e0a75c' : '#d99036'
  set('--amber', amber)
  set('--warn-bg', mix(amber, pal.surface, mode === 'dark' ? 0.16 : 0.12))
  set('--warn-border', mix(amber, pal.surface, mode === 'dark' ? 0.3 : 0.28))

  const c = CORNERS[prefs.corners]
  set('--radius', c.r)
  set('--radius-sm', c.sm)
  set('--radius-lg', c.lg)

  const d = DENSITY[prefs.density]
  set('--gap-s', d.gapS)
  set('--gap', d.gap)
  set('--gap-l', d.gapL)
  set('--card-pad', d.pad)

  set('--fs', String(TEXT_SCALE[prefs.textSize]))
  set('--font', FONTS[prefs.font].stack)

  const shadowInk = mode === 'dark' ? '0,0,0' : '44,39,35'
  const shadow = `0 1px 2px rgba(${shadowInk},${mode === 'dark' ? '.3' : '.05'}), `
    + `0 4px 16px rgba(${shadowInk},${mode === 'dark' ? '.25' : '.05'})`
  set('--shadow', shadow)
  set('--shadow-lg', `0 4px 12px rgba(${shadowInk},${mode === 'dark' ? '.35' : '.08'}), `
    + `0 16px 40px rgba(${shadowInk},${mode === 'dark' ? '.45' : '.12'})`)

  if (prefs.cardStyle === 'elevated') {
    set('--card-shadow', shadow)
    set('--card-border-w', '1px')
  } else if (prefs.cardStyle === 'outlined') {
    set('--card-shadow', 'none')
    set('--card-border-w', '1.5px')
  } else {
    set('--card-shadow', 'none')
    set('--card-border-w', '0px')
  }

  set('--ink', ink)
  set('--paper', paper)

  root.dataset.theme = mode
  root.dataset.motion = prefs.motion
  // keeps native scrollbars and form controls in step with the theme
  root.style.colorScheme = mode

  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
    ?? document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', mode === 'dark' ? pal.bg : primary)

  if (prefs.appName) document.title = prefs.appName
}

/* ---------------------------------------------------------------- cache -- */

const CACHE_KEY = 'daily-appearance'

export function cachePrefs(userId: string, prefs: AppearancePrefs): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, prefs }))
  } catch { /* private mode, blocked storage - the DB still has the truth */ }
}

/** Only returns a cached look for the account it was saved under. */
export function readCachedPrefs(userId?: string): AppearancePrefs | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { userId?: string; prefs?: unknown }
    if (userId && parsed.userId !== userId) return null
    if (!parsed.prefs) return null
    return sanitizePrefs(parsed.prefs)
  } catch { return null }
}

export function clearCachedPrefs(): void {
  try { localStorage.removeItem(CACHE_KEY) } catch { /* nothing to do */ }
}

/** Removes every property this module sets, back to the stylesheet defaults. */
export function resetInlineTheme(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const keys = [
    '--bg', '--bg-tint', '--surface', '--surface-2', '--border', '--border-2',
    '--text', '--text-soft', '--text-mute', '--primary', '--primary-dark',
    '--primary-soft', '--on-primary', '--food', '--workout', '--task', '--day',
    '--on-food', '--on-workout', '--on-task', '--on-day',
    '--danger', '--danger-soft', '--amber', '--warn-bg', '--warn-border',
    '--radius', '--radius-sm', '--radius-lg', '--gap-s', '--gap', '--gap-l',
    '--card-pad', '--fs', '--font', '--shadow', '--shadow-lg', '--card-shadow',
    '--card-border-w', '--ink', '--paper',
  ]
  keys.forEach((k) => root.style.removeProperty(k))
  root.style.removeProperty('color-scheme')
  delete root.dataset.theme
  delete root.dataset.motion
}
