// Everything here works in the user's LOCAL timezone on purpose.
// Using toISOString() would file a 9pm entry under tomorrow's date, which is
// exactly the kind of bug that makes a tracker feel broken and untrustworthy.

/** "2026-09-21" for a Date, in local time. */
export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today as "2026-09-21", local. */
export function todayISO(): string {
  return toISO(new Date())
}

/** Parse "2026-09-21" into a local midnight Date (NOT UTC). */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function daysBetween(aISO: string, bISO: string): number {
  const a = fromISO(aISO).getTime()
  const b = fromISO(bISO).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** The last n dates ending today, oldest first. */
export function lastNDays(n: number, endISO = todayISO()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(addDays(endISO, -i))
  return out
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const d = fromISO(iso)
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - dow)
  return toISO(d)
}

export function isToday(iso: string): boolean {
  return iso === todayISO()
}

/** "Today", "Yesterday", or "Mon, Sep 15". */
export function friendlyDate(iso: string): string {
  const diff = daysBetween(iso, todayISO())
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff === -1) return 'Tomorrow'
  return fromISO(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "Sunday, September 21" - used for the big header on the Today screen. */
export function longDate(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/** "S M T W T F S" initial for the week strip. */
export function weekdayInitial(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, { weekday: 'narrow' })
}

/** "2:15 PM" from a timestamptz. */
export function clockTime(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** "just now" / "3h ago" / "Sep 14" for feedback notes. */
export function relativeTime(ts: string): string {
  const then = new Date(ts).getTime()
  const mins = Math.floor((Date.now() - then) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Which meal it probably is right now, so the form opens pre-answered. */
export function guessMealType(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Longest run of consecutive logged days ending today (or yesterday - a streak
 * shouldn't die at midnight before she's had a chance to log).
 */
export function currentStreak(loggedDates: Set<string>): number {
  const today = todayISO()
  let cursor = loggedDates.has(today) ? today : addDays(today, -1)
  if (!loggedDates.has(cursor)) return 0
  let n = 0
  while (loggedDates.has(cursor)) {
    n++
    cursor = addDays(cursor, -1)
  }
  return n
}
