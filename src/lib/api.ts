import { supabase } from './supabase'
import * as guest from './guest'
import { todayISO } from './dates'
import type {
  BodyProfile, DayLog, Entry, EntryKind, Feedback, Goal, JournalEntry,
  PartnerLink, Profile, Role, ShareSettings, WeightLog,
} from './types'

/**
 * PostgREST speaks to developers. This translates the handful of failures a
 * person can actually act on - above all the "schema cache" one, which means
 * the app is newer than the database and update.sql needs running.
 */
export function friendlyDbError(msg: string): string {
  const m = (msg || '').toLowerCase()

  if (m.includes('schema cache') || /could not find the .+ column/.test(m)) {
    return 'Your database needs a quick update. Open your Supabase project, '
      + 'go to the SQL Editor, and run the file supabase/update.sql from the '
      + 'project folder. Then reload this page.'
  }
  if (m.includes('does not exist') && m.includes('relation')) {
    return 'Your database has not been set up yet. Run supabase/schema.sql in '
      + 'the Supabase SQL Editor - see SETUP.md.'
  }
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) {
    return 'Could not reach the server. Check your internet connection and try again.'
  }
  if (m.includes('jwt') || m.includes('expired')) {
    return 'Your sign-in has expired. Please sign out and back in.'
  }
  if (m.includes('row-level security') || m.includes('row level security')) {
    return 'That was not allowed. You can only change your own information.'
  }
  if (m.includes('duplicate key')) {
    return 'That already exists.'
  }
  return msg
}

/**
 * Reached only if a guest somehow gets to an account-only screen. The UI
 * should never offer these, so this is a backstop rather than a path.
 */
function accountOnly(what: string): never {
  throw new Error(`${what} needs an account. Tap "Create an account" to keep it properly.`)
}

/** Every query goes through here so errors surface as readable messages. */
function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(friendlyDbError(res.error.message))
  return res.data as T
}

/* ------------------------------------------------------------------ profile */

export async function getProfile(userId: string): Promise<Profile | null> {
  if (guest.isGuest()) return guest.getProfile()
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error(friendlyDbError(error.message))
  return data
}

export async function upsertProfile(p: Partial<Profile> & { id: string }): Promise<Profile> {
  if (guest.isGuest()) return guest.upsertProfile(p)
  return unwrap(await supabase.from('profiles').upsert(p).select().single())
}

/* --------------------------------------------------------------------- link */

/**
 * The link row, whether I'm the owner or the partner on it.
 *
 * One person can legitimately be on TWO rows: someone who signed up as an
 * owner (which mints them a link row of their own) and later redeemed a
 * partner code. So this must never assume a single row - `role` decides
 * which one actually matters to them.
 */
export async function getLink(userId: string, role?: Role): Promise<PartnerLink | null> {
  if (guest.isGuest()) return null
  const { data, error } = await supabase
    .from('partner_links')
    .select('*')
    .or(`owner_id.eq.${userId},partner_id.eq.${userId}`)
    .order('created_at', { ascending: true })
  if (error) throw new Error(friendlyDbError(error.message))

  const rows = (data ?? []) as PartnerLink[]
  if (rows.length === 0) return null
  if (role === 'partner') {
    return rows.find((r) => r.partner_id === userId) ?? rows[0]!
  }
  return rows.find((r) => r.owner_id === userId) ?? rows[0]!
}

/** Owners get a link row (and therefore an invite code) as soon as they exist. */
export async function ensureLink(ownerId: string): Promise<PartnerLink> {
  const existing = await getLink(ownerId, 'owner')
  if (existing && existing.owner_id === ownerId) return existing
  return unwrap(await supabase.from('partner_links').insert({ owner_id: ownerId }).select().single())
}

export async function redeemInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_invite', { p_code: code.trim() })
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, ''))
  return data as string
}

/** Cuts the partner off completely and issues a fresh code. */
export async function unlinkPartner(linkId: string): Promise<PartnerLink> {
  const fresh = await supabase.rpc('new_invite_code')
  const patch: Record<string, unknown> = {
    partner_id: null,
    status: 'pending',
    accepted_at: null,
  }
  if (!fresh.error && fresh.data) patch.invite_code = fresh.data
  return unwrap(await supabase.from('partner_links').update(patch).eq('id', linkId).select().single())
}

export interface PartnerViewState {
  owner_id: string
  owner_name: string
  paused: boolean
  food: boolean
  workouts: boolean
  tasks: boolean
  day: boolean
  body: boolean
  goals: boolean
}

/** What the partner is allowed to know about which switches are on. */
export async function getPartnerViewState(): Promise<PartnerViewState | null> {
  const { data, error } = await supabase.rpc('partner_view_state')
  if (error) throw new Error(friendlyDbError(error.message))
  return (data as PartnerViewState | null) ?? null
}

/* ----------------------------------------------------------- share settings */

export async function getShareSettings(ownerId: string): Promise<ShareSettings | null> {
  if (guest.isGuest()) return null
  const { data, error } = await supabase
    .from('share_settings').select('*').eq('owner_id', ownerId).maybeSingle()
  if (error) throw new Error(friendlyDbError(error.message))
  return data
}

export async function ensureShareSettings(ownerId: string): Promise<ShareSettings> {
  const existing = await getShareSettings(ownerId)
  if (existing) return existing
  // Defaults are all-false in the schema: a new account shares nothing.
  return unwrap(await supabase.from('share_settings').insert({ owner_id: ownerId }).select().single())
}

export async function updateShareSettings(
  ownerId: string, patch: Partial<ShareSettings>,
): Promise<ShareSettings> {
  return unwrap(
    await supabase.from('share_settings')
      .upsert({ owner_id: ownerId, ...patch, updated_at: new Date().toISOString() })
      .select().single(),
  )
}

/* --------------------------------------------------------------------- body */

export async function getBodyProfile(ownerId: string): Promise<BodyProfile | null> {
  if (guest.isGuest()) return guest.getBodyProfile()
  const { data, error } = await supabase
    .from('body_profile').select('*').eq('owner_id', ownerId).maybeSingle()
  if (error) throw new Error(friendlyDbError(error.message))
  return data
}

export async function upsertBodyProfile(
  ownerId: string, patch: Partial<BodyProfile>,
): Promise<BodyProfile> {
  if (guest.isGuest()) return guest.upsertBodyProfile(patch)
  return unwrap(
    await supabase.from('body_profile')
      .upsert({ owner_id: ownerId, ...patch, updated_at: new Date().toISOString() })
      .select().single(),
  )
}

/* ------------------------------------------------------------------ weights */

export async function listWeights(ownerId: string, sinceISO?: string): Promise<WeightLog[]> {
  if (guest.isGuest()) return []
  let q = supabase.from('weight_logs').select('*').eq('owner_id', ownerId)
  if (sinceISO) q = q.gte('log_date', sinceISO)
  return unwrap(await q.order('log_date', { ascending: true })) ?? []
}

export async function upsertWeight(
  ownerId: string, log_date: string, weight_kg: number, note = '',
): Promise<WeightLog> {
  if (guest.isGuest()) accountOnly('Weight tracking')
  return unwrap(
    await supabase.from('weight_logs')
      .upsert({ owner_id: ownerId, log_date, weight_kg, note }, { onConflict: 'owner_id,log_date' })
      .select().single(),
  )
}

export async function deleteWeight(id: string): Promise<void> {
  const { error } = await supabase.from('weight_logs').delete().eq('id', id)
  if (error) throw new Error(friendlyDbError(error.message))
}

/* ------------------------------------------------------------------ entries */

export async function listEntries(
  ownerId: string, fromISO: string, toISO: string,
): Promise<Entry[]> {
  if (guest.isGuest()) return guest.listEntries(fromISO, toISO)
  return unwrap(
    await supabase.from('entries').select('*')
      .eq('owner_id', ownerId)
      .gte('entry_date', fromISO)
      .lte('entry_date', toISO)
      .order('entry_date', { ascending: false })
      .order('logged_at', { ascending: true }),
  ) ?? []
}

export async function createEntry(e: Partial<Entry> & { owner_id: string; kind: EntryKind; title: string }) {
  if (guest.isGuest()) return guest.createEntry(e)
  return unwrap(await supabase.from('entries').insert(e).select().single())
}

export async function updateEntry(id: string, patch: Partial<Entry>): Promise<Entry> {
  if (guest.isGuest()) return guest.updateEntry(id, patch)
  return unwrap(await supabase.from('entries').update(patch).eq('id', id).select().single())
}

export async function deleteEntry(id: string): Promise<void> {
  if (guest.isGuest()) return guest.deleteEntry(id)
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) throw new Error(friendlyDbError(error.message))
}

/**
 * Bulk insert, used when a guest signs up and brings their log with them.
 * One round trip instead of one per entry, which matters when someone has
 * been trying the app for a fortnight before deciding.
 */
export async function createEntries(
  rows: (Partial<Entry> & { owner_id: string; kind: EntryKind; title: string })[],
): Promise<number> {
  if (!rows.length) return 0
  if (guest.isGuest()) accountOnly('Importing')
  const { error } = await supabase.from('entries').insert(rows)
  if (error) throw new Error(friendlyDbError(error.message))
  return rows.length
}

export async function upsertDayLogs(
  rows: (Partial<DayLog> & { owner_id: string; log_date: string })[],
): Promise<number> {
  if (!rows.length) return 0
  if (guest.isGuest()) accountOnly('Importing')
  const { error } = await supabase.from('day_logs')
    .upsert(rows, { onConflict: 'owner_id,log_date' })
  if (error) throw new Error(friendlyDbError(error.message))
  return rows.length
}

/**
 * The things she logs most often, newest-first, for the one-tap chips.
 * This is the single biggest reason daily logging survives past week one.
 */
export async function recentTitles(ownerId: string, kind: EntryKind, limit = 8): Promise<string[]> {
  if (guest.isGuest()) return guest.recentTitles(kind, limit)
  const { data, error } = await supabase
    .from('entries').select('title')
    .eq('owner_id', ownerId).eq('kind', kind)
    .order('logged_at', { ascending: false })
    .limit(120)
  if (error) throw new Error(friendlyDbError(error.message))

  // Rows arrive newest-first, so a lower `first` index means more recent.
  const seen = new Map<string, { n: number; first: number; label: string }>()
  ;(data ?? []).forEach((r: { title: string | null }, i: number) => {
    const label = (r.title ?? '').trim()
    if (!label) return
    const key = label.toLowerCase()
    const cur = seen.get(key)
    if (cur) cur.n++
    else seen.set(key, { n: 1, first: i, label })
  })

  return [...seen.values()]
    .sort((a, b) => b.n - a.n || a.first - b.first) // most used, then most recent
    .slice(0, limit)
    .map((v) => v.label)
}

/* ----------------------------------------------------------------- day logs */

export async function getDayLog(ownerId: string, log_date: string): Promise<DayLog | null> {
  if (guest.isGuest()) return guest.getDayLog(log_date)
  const { data, error } = await supabase
    .from('day_logs').select('*').eq('owner_id', ownerId).eq('log_date', log_date).maybeSingle()
  if (error) throw new Error(friendlyDbError(error.message))
  return data
}

export async function listDayLogs(
  ownerId: string, fromISO: string, toISO: string,
): Promise<DayLog[]> {
  if (guest.isGuest()) return guest.listDayLogs(fromISO, toISO)
  return unwrap(
    await supabase.from('day_logs').select('*')
      .eq('owner_id', ownerId)
      .gte('log_date', fromISO).lte('log_date', toISO)
      .order('log_date', { ascending: false }),
  ) ?? []
}

export async function upsertDayLog(
  ownerId: string, log_date: string, patch: Partial<DayLog>,
): Promise<DayLog> {
  if (guest.isGuest()) return guest.upsertDayLog(log_date, patch)
  return unwrap(
    await supabase.from('day_logs')
      .upsert(
        { owner_id: ownerId, log_date, ...patch, updated_at: new Date().toISOString() },
        { onConflict: 'owner_id,log_date' },
      )
      .select().single(),
  )
}

/* ------------------------------------------------------------------ journal */

export async function getJournal(ownerId: string, log_date: string): Promise<JournalEntry | null> {
  const { data, error } = await supabase
    .from('journal_entries').select('*')
    .eq('owner_id', ownerId).eq('log_date', log_date).maybeSingle()
  if (error) throw new Error(friendlyDbError(error.message))
  return data
}

export async function listJournal(ownerId: string, limit = 60): Promise<JournalEntry[]> {
  if (guest.isGuest()) return []
  return unwrap(
    await supabase.from('journal_entries').select('*')
      .eq('owner_id', ownerId)
      .order('log_date', { ascending: false }).limit(limit),
  ) ?? []
}

export async function upsertJournal(
  ownerId: string, log_date: string, body: string,
): Promise<JournalEntry> {
  return unwrap(
    await supabase.from('journal_entries')
      .upsert(
        { owner_id: ownerId, log_date, body, updated_at: new Date().toISOString() },
        { onConflict: 'owner_id,log_date' },
      )
      .select().single(),
  )
}

export async function deleteJournal(id: string): Promise<void> {
  const { error } = await supabase.from('journal_entries').delete().eq('id', id)
  if (error) throw new Error(friendlyDbError(error.message))
}

/* -------------------------------------------------------------------- goals */

export async function listGoals(ownerId: string): Promise<Goal[]> {
  if (guest.isGuest()) return []
  return unwrap(
    await supabase.from('goals').select('*')
      .eq('owner_id', ownerId).eq('active', true)
      .order('created_at', { ascending: true }),
  ) ?? []
}

export async function createGoal(g: Partial<Goal> & { owner_id: string; title: string }): Promise<Goal> {
  if (guest.isGuest()) accountOnly('Goals')
  return unwrap(await supabase.from('goals').insert(g).select().single())
}

export async function updateGoal(id: string, patch: Partial<Goal>): Promise<Goal> {
  return unwrap(await supabase.from('goals').update(patch).eq('id', id).select().single())
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw new Error(friendlyDbError(error.message))
}

/* ----------------------------------------------------------------- feedback */

export async function listFeedback(ownerId: string, limit = 50): Promise<Feedback[]> {
  if (guest.isGuest()) return []
  return unwrap(
    await supabase.from('feedback').select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false }).limit(limit),
  ) ?? []
}

export async function sendFeedback(ownerId: string, authorId: string, body: string): Promise<Feedback> {
  return unwrap(
    await supabase.from('feedback')
      .insert({ owner_id: ownerId, author_id: authorId, body: body.trim() })
      .select().single(),
  )
}

export async function reactToFeedback(id: string, reaction: Feedback['reaction']): Promise<Feedback> {
  return unwrap(await supabase.from('feedback').update({ reaction }).eq('id', id).select().single())
}

export async function deleteFeedback(id: string): Promise<void> {
  const { error } = await supabase.from('feedback').delete().eq('id', id)
  if (error) throw new Error(friendlyDbError(error.message))
}

/* --------------------------------------------------------------- appearance */

/**
 * Stored as jsonb so new look-and-feel options never need a migration.
 * Returns the raw value - theme.ts sanitises it, because this data is
 * free-form and a bad value must not be able to break rendering.
 */
export async function getAppearance(userId: string): Promise<unknown | null> {
  // A guest's look lives in the same local cache the theme already uses.
  if (guest.isGuest()) return null
  const { data, error } = await supabase
    .from('appearance').select('prefs').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(friendlyDbError(error.message))
  return (data as { prefs?: unknown } | null)?.prefs ?? null
}

export async function saveAppearance(userId: string, prefs: unknown): Promise<void> {
  if (guest.isGuest()) return
  const { error } = await supabase.from('appearance').upsert({
    user_id: userId, prefs, updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(friendlyDbError(error.message))
}

/* ------------------------------------------------------------------ bundles */

export interface DaySnapshot {
  date: string
  entries: Entry[]
  day: DayLog | null
}

/** Everything the Today screen needs, in two round trips. */
export async function loadDay(ownerId: string, date = todayISO()): Promise<DaySnapshot> {
  const [entries, day] = await Promise.all([
    listEntries(ownerId, date, date),
    getDayLog(ownerId, date),
  ])
  return { date, entries, day }
}

export interface RangeSnapshot {
  entries: Entry[]
  days: DayLog[]
  weights: WeightLog[]
  goals: Goal[]
}

/** Everything the Progress screen and the partner dashboard need. */
export async function loadRange(
  ownerId: string, fromISO: string, toISO: string,
): Promise<RangeSnapshot> {
  const [entries, days, weights, goals] = await Promise.all([
    listEntries(ownerId, fromISO, toISO),
    listDayLogs(ownerId, fromISO, toISO),
    listWeights(ownerId, fromISO).catch(() => []),  // blocked by RLS = not shared
    listGoals(ownerId).catch(() => []),
  ])
  return { entries, days, weights, goals }
}
