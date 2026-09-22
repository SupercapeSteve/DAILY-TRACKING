// DEV-ONLY fake backend. Never imported by the real build - it is wired in
// exclusively through vite.config.mock.ts so the screens can be eyeballed
// without a live Supabase project.
import type {
  BodyProfile, DayLog, Entry, EntryKind, Feedback, Goal, JournalEntry,
  PartnerLink, Profile, ShareSettings, WeightLog,
} from '../src/lib/types'
import { addDays, todayISO } from '../src/lib/dates'

export interface PartnerViewState {
  owner_id: string; owner_name: string; paused: boolean
  food: boolean; workouts: boolean; tasks: boolean
  day: boolean; body: boolean; goals: boolean
}

const OWNER = '00000000-0000-0000-0000-0000000000aa'
const today = todayISO()
const d = (n: number) => addDays(today, -n)

let seq = 0
const id = () => `id-${++seq}`

const mk = (
  kind: EntryKind, day: number, title: string, extra: Partial<Entry> = {},
): Entry => ({
  id: id(), owner_id: OWNER, kind, entry_date: d(day),
  logged_at: `${d(day)}T${String(8 + (seq % 12)).padStart(2, '0')}:${String((seq * 7) % 60).padStart(2, '0')}:00Z`,
  title, notes: '', is_private: false,
  meal_type: null, calories: null, protein_g: null,
  duration_min: null, intensity: null, category: null,
  created_at: `${d(day)}T12:00:00Z`, ...extra,
})

const ENTRIES: Entry[] = [
  mk('food', 0, 'Eggs & toast', { meal_type: 'breakfast', calories: 420, protein_g: 28 }),
  mk('food', 0, 'Chicken salad', { meal_type: 'lunch', calories: 530, protein_g: 42 }),
  mk('workout', 0, 'Legs', { duration_min: 55, intensity: 'hard', notes: 'Squats felt strong today' }),
  mk('task', 0, 'Laundry'),
  mk('task', 0, 'Groceries', { is_private: true }),
  mk('food', 1, 'Protein shake', { meal_type: 'snack', calories: 210, protein_g: 30 }),
  mk('workout', 1, 'Cardio', { duration_min: 30, intensity: 'moderate' }),
  mk('task', 1, 'Meal prep'),
  mk('workout', 2, 'Yoga', { duration_min: 45, intensity: 'easy' }),
  mk('food', 2, 'Pasta', { meal_type: 'dinner', calories: 700, protein_g: 25 }),
  mk('workout', 3, 'Upper body', { duration_min: 50, intensity: 'hard' }),
  mk('task', 3, 'Cleaning'),
  mk('task', 4, 'Studying'),
  mk('workout', 5, 'Walk', { duration_min: 25, intensity: 'easy' }),
  mk('food', 5, 'Yogurt', { meal_type: 'breakfast', calories: 180, protein_g: 15 }),
]

const DAYS: DayLog[] = [0, 1, 2, 3, 5].map((n) => ({
  id: id(), owner_id: OWNER, log_date: d(n),
  mood: [5, 4, 3, 4, 5][n % 5] ?? 4,
  energy: [4, 3, 3, 5, 4][n % 5] ?? 3,
  sleep_hours: 7.5 - (n % 3) * 0.5,
  water_cups: 8 - (n % 4),
  day_note: n === 0 ? 'Long day but the gym session was a real win.' : n === 2 ? 'Felt a bit off, took it easy.' : '',
  is_private: false, updated_at: `${d(n)}T20:00:00Z`,
}))

const WEIGHTS: WeightLog[] = Array.from({ length: 14 }, (_, i) => ({
  id: id(), owner_id: OWNER, log_date: d(13 - i),
  weight_kg: 68.5 - i * 0.12 + (i % 3) * 0.3,
  note: '', created_at: `${d(13 - i)}T07:00:00Z`,
}))

const GOALS: Goal[] = [
  { id: id(), owner_id: OWNER, title: 'Workouts each week', metric: 'workouts_per_week', target_value: 4, active: true, created_at: '2026-09-01T00:00:00Z' },
  { id: id(), owner_id: OWNER, title: 'Water each day', metric: 'water_per_day', target_value: 8, active: true, created_at: '2026-09-01T00:00:00Z' },
  { id: id(), owner_id: OWNER, title: 'Protein each day', metric: 'protein_per_day', target_value: 100, active: true, created_at: '2026-09-01T00:00:00Z' },
]

const FEEDBACK: Feedback[] = [
  { id: id(), owner_id: OWNER, author_id: 'bb', body: 'Three gym days this week already. Seriously proud of you.', reaction: 'heart', created_at: `${d(0)}T18:20:00Z` },
  { id: id(), owner_id: OWNER, author_id: 'bb', body: 'Noticed your protein is up. How has your energy felt?', reaction: null, created_at: `${d(2)}T09:00:00Z` },
]

const BODY: BodyProfile = {
  owner_id: OWNER, birthdate: '1998-04-12', height_cm: 165,
  goal_weight_kg: 64, activity_level: 'moderate', notes: '', updated_at: '2026-09-01T00:00:00Z',
}

const JOURNAL: JournalEntry[] = [
  { id: id(), owner_id: OWNER, log_date: d(1), body: 'Wrote down some things I want to work on this month.', created_at: '', updated_at: '' },
]

const ok = <T,>(v: T) => Promise.resolve(v)

export const getProfile = (): Promise<Profile | null> => ok(null)
export const upsertProfile = (p: never) => ok(p)
export const getLink = (): Promise<PartnerLink | null> => ok(null)
export const ensureLink = () => ok({} as PartnerLink)
export const redeemInvite = () => ok(OWNER)
export const unlinkPartner = () => ok({} as PartnerLink)
export const getShareSettings = (): Promise<ShareSettings | null> => ok(null)
export const ensureShareSettings = () => ok({} as ShareSettings)
export const updateShareSettings = (_o: string, p: never) => ok(p)

export const getPartnerViewState = (): Promise<PartnerViewState | null> => ok({
  owner_id: OWNER, owner_name: 'Sam', paused: false,
  food: true, workouts: true, tasks: true, day: true, body: true, goals: true,
})

export const getBodyProfile = () => ok(BODY)
export const upsertBodyProfile = () => ok(BODY)
export const listWeights = () => ok(WEIGHTS)
export const upsertWeight = () => ok(WEIGHTS[0]!)
export const deleteWeight = () => ok(undefined)

export const listEntries = (_o: string, from: string, to: string) =>
  ok(ENTRIES.filter((e) => e.entry_date >= from && e.entry_date <= to))
export const createEntry = (e: never) => ok(e)
export const updateEntry = (_i: string, e: never) => ok(e)
export const deleteEntry = () => ok(undefined)
export const recentTitles = (_o: string, kind: EntryKind) =>
  ok([...new Set(ENTRIES.filter((e) => e.kind === kind).map((e) => e.title))].slice(0, 6))

export const getDayLog = (_o: string, date: string) => ok(DAYS.find((x) => x.log_date === date) ?? null)
export const listDayLogs = (_o: string, from: string, to: string) =>
  ok(DAYS.filter((x) => x.log_date >= from && x.log_date <= to))
export const upsertDayLog = (_o: string, _d: string, p: never) => ok(p)

export const getJournal = () => ok(JOURNAL[0] ?? null)
export const listJournal = () => ok(JOURNAL)
export const upsertJournal = () => ok(JOURNAL[0]!)
export const deleteJournal = () => ok(undefined)

export const listGoals = () => ok(GOALS)
export const createGoal = (g: never) => ok(g)
export const updateGoal = (_i: string, g: never) => ok(g)
export const deleteGoal = () => ok(undefined)

export const listFeedback = () => ok(FEEDBACK)
export const sendFeedback = () => ok(FEEDBACK[0]!)
export const reactToFeedback = () => ok(FEEDBACK[0]!)
export const deleteFeedback = () => ok(undefined)

export const loadDay = (_o: string, date = today) =>
  ok({ date, entries: ENTRIES.filter((e) => e.entry_date === date), day: DAYS.find((x) => x.log_date === date) ?? null })

export const loadRange = (_o: string, from: string, to: string) => ok({
  entries: ENTRIES.filter((e) => e.entry_date >= from && e.entry_date <= to),
  days: DAYS.filter((x) => x.log_date >= from && x.log_date <= to),
  weights: WEIGHTS,
  goals: GOALS,
})

export const OWNER_ID = OWNER
