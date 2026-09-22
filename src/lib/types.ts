export type Role = 'owner' | 'partner'
export type Units = 'imperial' | 'metric'
export type EntryKind = 'food' | 'workout' | 'task'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type Intensity = 'easy' | 'moderate' | 'hard'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

export interface Profile {
  id: string
  display_name: string
  role: Role
  units: Units
  onboarded: boolean
  created_at: string
}

export interface PartnerLink {
  id: string
  owner_id: string
  partner_id: string | null
  invite_code: string
  status: 'pending' | 'accepted' | 'revoked'
  created_at: string
  accepted_at: string | null
}

export interface ShareSettings {
  owner_id: string
  share_food: boolean
  share_workouts: boolean
  share_tasks: boolean
  share_day: boolean
  share_body: boolean
  share_goals: boolean
  sharing_paused: boolean
  updated_at: string
}

/** The keys of ShareSettings that are per-category switches. */
export type ShareKey = 'share_food' | 'share_workouts' | 'share_tasks' | 'share_day' | 'share_body' | 'share_goals'

export interface BodyProfile {
  owner_id: string
  birthdate: string | null
  height_cm: number | null
  goal_weight_kg: number | null
  activity_level: ActivityLevel | null
  notes: string
  updated_at: string
}

export interface WeightLog {
  id: string
  owner_id: string
  log_date: string
  weight_kg: number
  note: string
  created_at: string
}

export interface Entry {
  id: string
  owner_id: string
  kind: EntryKind
  entry_date: string
  logged_at: string
  title: string
  notes: string
  is_private: boolean
  meal_type: MealType | null
  calories: number | null
  protein_g: number | null
  duration_min: number | null
  intensity: Intensity | null
  category: string | null
  created_at: string
}

export interface DayLog {
  id: string
  owner_id: string
  log_date: string
  mood: number | null
  energy: number | null
  sleep_hours: number | null
  water_cups: number | null
  day_note: string
  is_private: boolean
  updated_at: string
}

export interface JournalEntry {
  id: string
  owner_id: string
  log_date: string
  body: string
  created_at: string
  updated_at: string
}

export type GoalMetric =
  | 'workouts_per_week'
  | 'workout_minutes_per_week'
  | 'tasks_per_week'
  | 'water_per_day'
  | 'protein_per_day'
  | 'calories_per_day'
  | 'days_logged_per_week'
  | 'custom'

export interface Goal {
  id: string
  owner_id: string
  title: string
  metric: GoalMetric
  target_value: number | null
  active: boolean
  created_at: string
}

export interface Feedback {
  id: string
  owner_id: string
  author_id: string
  body: string
  reaction: 'heart' | 'thumbsup' | 'seen' | null
  created_at: string
}
