import type { DayLog, Entry, Goal, WeightLog } from './types'
import { lastNDays, startOfWeek, todayISO, addDays } from './dates'

export interface DayRollup {
  date: string
  meals: number
  workouts: number
  workoutMin: number
  tasks: number
  mood: number | null
  calories: number | null
  protein: number | null
  water: number | null
  logged: boolean
}

export function rollupDay(date: string, entries: Entry[], day: DayLog | null): DayRollup {
  const onDay = entries.filter((e) => e.entry_date === date)
  const workouts = onDay.filter((e) => e.kind === 'workout')
  const meals = onDay.filter((e) => e.kind === 'food')

  const sum = (xs: (number | null)[]) => {
    const vals = xs.filter((v): v is number => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null
  }

  return {
    date,
    meals: meals.length,
    workouts: workouts.length,
    workoutMin: workouts.reduce((a, e) => a + (e.duration_min ?? 0), 0),
    tasks: onDay.filter((e) => e.kind === 'task').length,
    mood: day?.mood ?? null,
    calories: sum(meals.map((e) => e.calories)),
    protein: sum(meals.map((e) => e.protein_g)),
    water: day?.water_cups ?? null,
    logged: onDay.length > 0 || Boolean(day && (day.mood != null || day.day_note.trim())),
  }
}

export function rollupRange(dates: string[], entries: Entry[], days: DayLog[]): DayRollup[] {
  const byDate = new Map(days.map((d) => [d.log_date, d]))
  return dates.map((d) => rollupDay(d, entries, byDate.get(d) ?? null))
}

export interface WeekSummary {
  workouts: number
  workoutMin: number
  tasks: number
  meals: number
  daysLogged: number
  avgMood: number | null
  avgCalories: number | null
  avgProtein: number | null
  avgWater: number | null
}

export function summarize(rolls: DayRollup[]): WeekSummary {
  const avg = (xs: (number | null)[]) => {
    const vals = xs.filter((v): v is number => v != null)
    if (!vals.length) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
  }
  return {
    workouts: rolls.reduce((a, r) => a + r.workouts, 0),
    workoutMin: rolls.reduce((a, r) => a + r.workoutMin, 0),
    tasks: rolls.reduce((a, r) => a + r.tasks, 0),
    meals: rolls.reduce((a, r) => a + r.meals, 0),
    daysLogged: rolls.filter((r) => r.logged).length,
    avgMood: avg(rolls.map((r) => r.mood)),
    avgCalories: avg(rolls.map((r) => r.calories)),
    avgProtein: avg(rolls.map((r) => r.protein)),
    avgWater: avg(rolls.map((r) => r.water)),
  }
}

/** The set of dates that count toward a streak. */
export function loggedDates(entries: Entry[], days: DayLog[]): Set<string> {
  const s = new Set<string>()
  entries.forEach((e) => s.add(e.entry_date))
  days.forEach((d) => {
    if (d.mood != null || d.day_note.trim() || d.water_cups != null) s.add(d.log_date)
  })
  return s
}

export interface GoalProgress {
  goal: Goal
  current: number
  target: number
  pct: number
  unit: string
  window: 'week' | 'day'
}

/** Measures each goal against the current week (or today, for daily goals). */
export function goalProgress(goals: Goal[], entries: Entry[], days: DayLog[]): GoalProgress[] {
  const today = todayISO()
  const weekStart = startOfWeek(today)
  const weekDates = new Set(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)))

  const weekEntries = entries.filter((e) => weekDates.has(e.entry_date))
  const todayEntries = entries.filter((e) => e.entry_date === today)
  const todayDay = days.find((d) => d.log_date === today) ?? null
  const weekDays = days.filter((d) => weekDates.has(d.log_date))

  return goals.map((goal) => {
    const target = goal.target_value ?? 0
    let current = 0
    let unit = ''
    let window: 'week' | 'day' = 'week'

    switch (goal.metric) {
      case 'workouts_per_week':
        current = weekEntries.filter((e) => e.kind === 'workout').length
        unit = 'workouts'
        break
      case 'workout_minutes_per_week':
        current = weekEntries.filter((e) => e.kind === 'workout')
          .reduce((a, e) => a + (e.duration_min ?? 0), 0)
        unit = 'min'
        break
      case 'tasks_per_week':
        current = weekEntries.filter((e) => e.kind === 'task').length
        unit = 'tasks'
        break
      case 'days_logged_per_week':
        current = loggedDates(weekEntries, weekDays).size
        unit = 'days'
        break
      case 'water_per_day':
        current = todayDay?.water_cups ?? 0
        unit = 'cups'; window = 'day'
        break
      case 'protein_per_day':
        current = todayEntries.reduce((a, e) => a + (e.protein_g ?? 0), 0)
        unit = 'g'; window = 'day'
        break
      case 'calories_per_day':
        current = todayEntries.reduce((a, e) => a + (e.calories ?? 0), 0)
        unit = 'cal'; window = 'day'
        break
      default:
        current = 0; unit = ''
    }

    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
    return { goal, current, target, pct, unit, window }
  })
}

/**
 * A gentle 7-day moving average so the weight line shows the trend instead of
 * daily water-weight noise. Looking at a jagged line every morning is exactly
 * how a tracker starts to feel discouraging.
 */
export function weightTrend(weights: WeightLog[], windowDays = 7): { date: string; kg: number; raw: number }[] {
  if (!weights.length) return []
  const sorted = [...weights].sort((a, b) => a.log_date.localeCompare(b.log_date))
  return sorted.map((w, i) => {
    const from = Math.max(0, i - windowDays + 1)
    const slice = sorted.slice(from, i + 1)
    const avg = slice.reduce((a, s) => a + Number(s.weight_kg), 0) / slice.length
    return { date: w.log_date, kg: Math.round(avg * 10) / 10, raw: Number(w.weight_kg) }
  })
}

/** Dates for the visible week strip, Monday through Sunday of this week. */
export function thisWeekDates(): string[] {
  const start = startOfWeek(todayISO())
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export const last7 = () => lastNDays(7)
export const last30 = () => lastNDays(30)
