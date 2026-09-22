// ============================================================================
//  Guest mode - using the app without an account
//
//  Everything a guest logs lives in this browser's localStorage and never
//  touches Supabase. There is no row, no user id and no network call, which
//  is exactly why a guest cannot share with a partner: there is no account
//  for the database to grant anything to.
//
//  The important promise is that trying it is not a trap. Anything logged as
//  a guest can be carried into a real account afterwards - see
//  takeSnapshot() and the import flow in App.tsx - and can be exported to a
//  file at any time, because a browser is a fragile place to keep something.
// ============================================================================

import type { BodyProfile, DayLog, Entry, EntryKind, Profile, Units } from './types'
import { todayISO } from './dates'

const DATA_KEY = 'daily-guest-data'
const MODE_KEY = 'daily-guest-mode'

/** Not a real user id. It never reaches the database. */
export const GUEST_ID = 'guest-local'

/** What an account adds. Shown to guests, and the honest reason for each. */
export const ACCOUNT_PERKS = [
  { icon: 'link', title: 'Share with a partner', why: 'Needs an account on both sides to connect them.' },
  { icon: 'scale', title: 'Weight tracking and trends', why: 'Worth keeping for months, which a browser cannot promise.' },
  { icon: 'target', title: 'Goals and progress', why: 'Measured over weeks, so they need somewhere durable to live.' },
  { icon: 'book', title: 'A private journal', why: 'Kept behind your sign-in rather than in a browser anyone could open.' },
  { icon: 'chart', title: 'Your full history', why: 'Guests see the last 7 days; accounts keep everything.' },
  { icon: 'send', title: 'It follows you anywhere', why: 'Same log on your phone, laptop and any new device.' },
] as const

/** The days a guest can look back over. An account removes this. */
export const GUEST_HISTORY_DAYS = 7

interface GuestData {
  version: 1
  startedAt: string
  profile: { display_name: string; units: Units }
  body: BodyProfile | null
  entries: Entry[]
  days: DayLog[]
}

const BLANK: GuestData = {
  version: 1,
  startedAt: '',
  profile: { display_name: '', units: 'imperial' },
  body: null,
  entries: [],
  days: [],
}

/* ------------------------------------------------------------- plumbing --- */

function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch { /* fall through */ }
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function read(): GuestData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return { ...BLANK }
    const parsed = JSON.parse(raw) as Partial<GuestData>
    // Anything unexpected falls back rather than throwing. A corrupt blob
    // must not be able to lock someone out of their own app.
    return {
      version: 1,
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : '',
      profile: {
        display_name: typeof parsed.profile?.display_name === 'string' ? parsed.profile.display_name : '',
        units: parsed.profile?.units === 'metric' ? 'metric' : 'imperial',
      },
      body: (parsed.body && typeof parsed.body === 'object' ? parsed.body : null) as BodyProfile | null,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      days: Array.isArray(parsed.days) ? parsed.days : [],
    }
  } catch {
    return { ...BLANK }
  }
}

function write(d: GuestData): void {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(d))
  } catch {
    // Almost always a full or blocked store. Say so plainly rather than
    // letting a save appear to succeed.
    throw new Error(
      'This browser will not let the app save any more. Export what you have, '
      + 'then make an account so it is kept properly.',
    )
  }
}

function mutate(fn: (d: GuestData) => void): GuestData {
  const d = read()
  if (!d.startedAt) d.startedAt = new Date().toISOString()
  fn(d)
  write(d)
  return d
}

/* ----------------------------------------------------------------- mode --- */

export function isGuest(): boolean {
  try { return localStorage.getItem(MODE_KEY) === '1' } catch { return false }
}

export function enterGuest(): void {
  try { localStorage.setItem(MODE_KEY, '1') } catch { /* session-only then */ }
  mutate(() => { /* stamps startedAt */ })
}

/** Leaves guest mode. Logged data is kept unless `wipe` is set, so it can
 *  still be carried into an account after signing up. */
export function leaveGuest(wipe = false): void {
  try {
    localStorage.removeItem(MODE_KEY)
    if (wipe) localStorage.removeItem(DATA_KEY)
  } catch { /* nothing to do */ }
}

export function clearGuestData(): void {
  try { localStorage.removeItem(DATA_KEY) } catch { /* nothing to do */ }
}

export function counts(): { entries: number; days: number; total: number } {
  const d = read()
  return { entries: d.entries.length, days: d.days.length, total: d.entries.length + d.days.length }
}

export function startedAt(): string {
  return read().startedAt
}

/** Everything a guest has logged, for carrying into a new account. */
export function takeSnapshot(): { entries: Entry[]; days: DayLog[]; body: BodyProfile | null; profile: GuestData['profile'] } {
  const d = read()
  return { entries: d.entries, days: d.days, body: d.body, profile: d.profile }
}

/* ------------------------------------------------------------- profile --- */

export function getProfile(): Profile {
  const d = read()
  return {
    id: GUEST_ID,
    display_name: d.profile.display_name,
    role: 'owner',
    units: d.profile.units,
    onboarded: true,          // guests never see onboarding
    solo: true,               // nothing is shareable without an account
    created_at: d.startedAt || new Date().toISOString(),
  }
}

export function upsertProfile(patch: Partial<Profile>): Profile {
  mutate((d) => {
    if (typeof patch.display_name === 'string') d.profile.display_name = patch.display_name
    if (patch.units === 'metric' || patch.units === 'imperial') d.profile.units = patch.units
  })
  return getProfile()
}

export function getBodyProfile(): BodyProfile | null {
  return read().body
}

export function upsertBodyProfile(patch: Partial<BodyProfile>): BodyProfile {
  let out: BodyProfile
  mutate((d) => {
    out = {
      owner_id: GUEST_ID,
      birthdate: null, height_cm: null, goal_weight_kg: null,
      activity_level: null, notes: '',
      ...(d.body ?? {}),
      ...patch,
      updated_at: new Date().toISOString(),
    } as BodyProfile
    d.body = out
  })
  return out!
}

/* ------------------------------------------------------------- entries --- */

export function listEntries(fromISO: string, toISO: string): Entry[] {
  return read().entries
    .filter((e) => e.entry_date >= fromISO && e.entry_date <= toISO)
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date)
      || a.logged_at.localeCompare(b.logged_at))
}

export function createEntry(e: Partial<Entry> & { kind: EntryKind; title: string }): Entry {
  const now = new Date().toISOString()
  const row: Entry = {
    id: uid(),
    owner_id: GUEST_ID,
    kind: e.kind,
    entry_date: e.entry_date ?? todayISO(),
    logged_at: e.logged_at ?? now,
    title: e.title,
    notes: e.notes ?? '',
    is_private: false,          // there is nobody to hide it from
    meal_type: e.meal_type ?? null,
    calories: e.calories ?? null,
    protein_g: e.protein_g ?? null,
    duration_min: e.duration_min ?? null,
    intensity: e.intensity ?? null,
    category: e.category ?? null,
    created_at: now,
  }
  mutate((d) => { d.entries.push(row) })
  return row
}

export function updateEntry(id: string, patch: Partial<Entry>): Entry {
  let out: Entry | undefined
  mutate((d) => {
    const i = d.entries.findIndex((x) => x.id === id)
    if (i >= 0) {
      out = { ...d.entries[i]!, ...patch, id, owner_id: GUEST_ID }
      d.entries[i] = out
    }
  })
  if (!out) throw new Error('That entry is no longer here.')
  return out
}

export function deleteEntry(id: string): void {
  mutate((d) => { d.entries = d.entries.filter((x) => x.id !== id) })
}

export function recentTitles(kind: EntryKind, limit = 8): string[] {
  const seen = new Map<string, { n: number; first: number; label: string }>()
  read().entries
    .filter((e) => e.kind === kind)
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
    .forEach((e, i) => {
      const label = (e.title ?? '').trim()
      if (!label) return
      const key = label.toLowerCase()
      const cur = seen.get(key)
      if (cur) cur.n++
      else seen.set(key, { n: 1, first: i, label })
    })
  return [...seen.values()]
    .sort((a, b) => b.n - a.n || a.first - b.first)
    .slice(0, limit)
    .map((v) => v.label)
}

/* ------------------------------------------------------------ day logs --- */

export function getDayLog(date: string): DayLog | null {
  return read().days.find((d) => d.log_date === date) ?? null
}

export function listDayLogs(fromISO: string, toISO: string): DayLog[] {
  return read().days
    .filter((d) => d.log_date >= fromISO && d.log_date <= toISO)
    .sort((a, b) => b.log_date.localeCompare(a.log_date))
}

export function upsertDayLog(date: string, patch: Partial<DayLog>): DayLog {
  let out: DayLog
  mutate((d) => {
    const i = d.days.findIndex((x) => x.log_date === date)
    const base: DayLog = i >= 0 ? d.days[i]! : {
      id: uid(), owner_id: GUEST_ID, log_date: date,
      mood: null, energy: null, sleep_hours: null, water_cups: null,
      day_note: '', is_private: false, updated_at: new Date().toISOString(),
    }
    out = { ...base, ...patch, log_date: date, owner_id: GUEST_ID, is_private: false,
            updated_at: new Date().toISOString() }
    if (i >= 0) d.days[i] = out
    else d.days.push(out)
  })
  return out!
}
