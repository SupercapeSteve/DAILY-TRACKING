// Carrying a guest's log into a real account.
//
// Kept in its own module because it is the one place that needs both the
// local store and the live data layer, and api.ts already imports guest.ts -
// putting this in either of them would make a cycle.

import * as api from './api'
import * as guest from './guest'

export interface ImportResult {
  entries: number
  days: number
}

/**
 * Copies everything logged as a guest into `userId`, then clears the local
 * copy.
 *
 * Day logs are upserted on (owner, date), so importing into an account that
 * already has something on that day updates it rather than failing on the
 * unique constraint. Entries are inserted, which can duplicate if this ran
 * twice - so the local copy is only cleared after the writes succeed, and the
 * caller offers this once.
 */
export async function importGuestData(userId: string): Promise<ImportResult> {
  const snap = guest.takeSnapshot()

  const entryRows = snap.entries.map((e) => ({
    owner_id: userId,
    kind: e.kind,
    title: e.title,
    entry_date: e.entry_date,
    logged_at: e.logged_at,
    notes: e.notes ?? '',
    is_private: false,
    meal_type: e.meal_type ?? null,
    calories: e.calories ?? null,
    protein_g: e.protein_g ?? null,
    duration_min: e.duration_min ?? null,
    intensity: e.intensity ?? null,
    category: e.category ?? null,
  }))

  const dayRows = snap.days.map((d) => ({
    owner_id: userId,
    log_date: d.log_date,
    mood: d.mood,
    energy: d.energy,
    sleep_hours: d.sleep_hours,
    water_cups: d.water_cups,
    day_note: d.day_note ?? '',
    is_private: false,
  }))

  const entries = await api.createEntries(entryRows)
  const days = await api.upsertDayLogs(dayRows)

  // Only bring over body basics if the account has none, so a fresh sign-up
  // gains them but an existing account is never overwritten.
  if (snap.body) {
    const existing = await api.getBodyProfile(userId).catch(() => null)
    if (!existing) {
      await api.upsertBodyProfile(userId, {
        birthdate: snap.body.birthdate,
        height_cm: snap.body.height_cm,
        goal_weight_kg: snap.body.goal_weight_kg,
      }).catch(() => { /* optional - never fail the import over it */ })
    }
  }

  guest.clearGuestData()
  return { entries, days }
}
