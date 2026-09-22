import { useEffect, useState } from 'react'
import * as api from '../../lib/api'
import { guessMealType } from '../../lib/dates'
import type { DayLog, Entry, EntryKind, Intensity, MealType } from '../../lib/types'
import {
  Button, Card, Chip, Field, Icon, Input, Sheet, Stepper, Textarea, Switch, toast,
} from '../../components/ui'

/** Sensible starting suggestions so the chips are never empty on day one. */
const SEED: Record<EntryKind, string[]> = {
  food: ['Eggs & toast', 'Coffee', 'Chicken & rice', 'Salad', 'Protein shake', 'Sandwich', 'Pasta', 'Yogurt'],
  workout: ['Legs', 'Upper body', 'Full body', 'Cardio', 'Walk', 'Yoga', 'Core', 'Stretching'],
  task: ['Laundry', 'Dishes', 'Groceries', 'Cleaning', 'Errands', 'Studying', 'Work', 'Meal prep'],
}

const MEALS: { v: MealType; label: string }[] = [
  { v: 'breakfast', label: 'Breakfast' },
  { v: 'lunch', label: 'Lunch' },
  { v: 'dinner', label: 'Dinner' },
  { v: 'snack', label: 'Snack' },
]

const DURATIONS = [15, 30, 45, 60, 90]
const INTENSITIES: { v: Intensity; label: string }[] = [
  { v: 'easy', label: 'Easy' },
  { v: 'moderate', label: 'Moderate' },
  { v: 'hard', label: 'Hard' },
]
const MOODS = ['\u{1F622}', '\u{1F641}', '\u{1F610}', '\u{1F642}', '\u{1F604}']
const MOOD_WORDS = ['Rough', 'Meh', 'Okay', 'Good', 'Great']

type Mode = 'pick' | EntryKind | 'day'

export default function LogSheet({
  open, onClose, ownerId, date, onSaved, editEntry, editDay, startMode,
}: {
  open: boolean
  onClose: () => void
  ownerId: string
  date: string
  onSaved: () => void
  editEntry?: Entry | null
  editDay?: DayLog | null
  startMode?: Mode
}) {
  const [mode, setMode] = useState<Mode>('pick')
  const [busy, setBusy] = useState(false)
  const [recents, setRecents] = useState<string[]>([])

  // shared
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [details, setDetails] = useState(false)

  // food
  const [meal, setMeal] = useState<MealType>('lunch')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')

  // workout
  const [duration, setDuration] = useState(30)
  const [intensity, setIntensity] = useState<Intensity | null>(null)

  // day
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [sleep, setSleep] = useState(7.5)
  const [water, setWater] = useState(0)
  const [dayNote, setDayNote] = useState('')

  /* ---------------------------------------------------------- open/reset */

  useEffect(() => {
    if (!open) return

    if (editEntry) {
      setMode(editEntry.kind)
      setTitle(editEntry.title)
      setNotes(editEntry.notes)
      setIsPrivate(editEntry.is_private)
      setMeal(editEntry.meal_type ?? guessMealType())
      setCalories(editEntry.calories?.toString() ?? '')
      setProtein(editEntry.protein_g?.toString() ?? '')
      setDuration(editEntry.duration_min ?? 30)
      setIntensity(editEntry.intensity)
      setDetails(Boolean(editEntry.calories || editEntry.protein_g || editEntry.notes))
    } else if (editDay || startMode === 'day') {
      setMode('day')
      setMood(editDay?.mood ?? null)
      setEnergy(editDay?.energy ?? null)
      setSleep(editDay?.sleep_hours ?? 7.5)
      setWater(editDay?.water_cups ?? 0)
      setDayNote(editDay?.day_note ?? '')
      setIsPrivate(editDay?.is_private ?? false)
    } else {
      setMode(startMode ?? 'pick')
      setTitle(''); setNotes(''); setIsPrivate(false); setDetails(false)
      setMeal(guessMealType()); setCalories(''); setProtein('')
      setDuration(30); setIntensity(null)
      setMood(null); setEnergy(null); setSleep(7.5); setWater(0); setDayNote('')
    }
  }, [open, editEntry, editDay, startMode])

  // Pull her own most-used items for the one-tap chips.
  useEffect(() => {
    if (!open || mode === 'pick' || mode === 'day') return
    let alive = true
    api.recentTitles(ownerId, mode as EntryKind)
      .then((r) => { if (alive) setRecents(r) })
      .catch(() => { if (alive) setRecents([]) })
    return () => { alive = false }
  }, [open, mode, ownerId])

  /* ---------------------------------------------------------------- save */

  async function saveEntry(kind: EntryKind) {
    const clean = title.trim()
    if (!clean) { toast('Give it a quick name first', true); return }
    setBusy(true)
    try {
      const payload: Partial<Entry> = {
        title: clean,
        notes: notes.trim(),
        is_private: isPrivate,
        entry_date: date,
        meal_type: kind === 'food' ? meal : null,
        calories: kind === 'food' && calories ? Number(calories) : null,
        protein_g: kind === 'food' && protein ? Number(protein) : null,
        duration_min: kind === 'workout' ? duration : null,
        intensity: kind === 'workout' ? intensity : null,
      }

      if (editEntry) await api.updateEntry(editEntry.id, payload)
      else await api.createEntry({ ...payload, owner_id: ownerId, kind, title: clean })

      toast(editEntry ? 'Updated' : 'Saved')
      onSaved(); onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', true)
    } finally { setBusy(false) }
  }

  async function saveDay() {
    setBusy(true)
    try {
      await api.upsertDayLog(ownerId, date, {
        mood, energy,
        sleep_hours: sleep,
        water_cups: water,
        day_note: dayNote.trim(),
        is_private: isPrivate,
      })
      toast('Saved')
      onSaved(); onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', true)
    } finally { setBusy(false) }
  }

  async function removeEntry() {
    if (!editEntry) return
    setBusy(true)
    try {
      await api.deleteEntry(editEntry.id)
      toast('Deleted')
      onSaved(); onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete', true)
    } finally { setBusy(false) }
  }

  /* -------------------------------------------------------------- pieces */

  const suggestions = [...recents, ...SEED[(mode === 'day' || mode === 'pick') ? 'food' : mode]]
    .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
    .slice(0, 10)

  const privacyRow = (
    <Card className="card--tint row" style={{ padding: '10px 14px' }}>
      <Icon name={isPrivate ? 'lock' : 'eye'} size={20}
        style={{ color: isPrivate ? 'var(--primary)' : 'var(--text-mute)', flex: '0 0 auto' }} />
      <span className="grow small">
        <span className="bold" style={{ display: 'block' }}>
          {isPrivate ? 'Just for me' : 'Can be shared'}
        </span>
        <span className="mute-2">
          {isPrivate ? 'Hidden from your partner, always.' : 'Only if that category is on.'}
        </span>
      </span>
      <Switch on={isPrivate} onChange={setIsPrivate} label="Keep this entry private" />
    </Card>
  )

  const titles: Record<Mode, string> = {
    pick: 'Add to your day',
    food: editEntry ? 'Edit meal' : 'Add a meal',
    workout: editEntry ? 'Edit workout' : 'Add a workout',
    task: editEntry ? 'Edit task' : 'Add a task',
    day: 'How was today?',
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={titles[mode]}
      action={mode !== 'pick' && !editEntry && !startMode ? (
        <button className="link-btn" onClick={() => setMode('pick')}>Back</button>
      ) : undefined}
    >
      {/* ------------------------------------------------------ picker -- */}
      {mode === 'pick' && (
        <div className="stack">
          {([
            ['food', 'A meal', 'What you ate', 'food'],
            ['workout', 'A workout', 'Gym, walk, class, anything', 'workout'],
            ['task', 'Something you got done', 'At home or out', 'task'],
            ['day', 'How your day went', 'Mood, sleep, water, a note', 'day'],
          ] as const).map(([m, label, sub, icon]) => (
            <Card key={m} style={{ padding: 0 }}>
              <button className="entry" style={{ padding: 16 }} onClick={() => setMode(m)}>
                <span className={`dot dot--${icon}`}><Icon name={icon} size={20} /></span>
                <span className="grow">
                  <span className="bold" style={{ display: 'block', fontSize: 17 }}>{label}</span>
                  <span className="small muted">{sub}</span>
                </span>
                <Icon name="next" size={20} />
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* -------------------------------------------------------- food -- */}
      {mode === 'food' && (
        <div className="stack">
          <div className="wrap">
            {MEALS.map((m) => (
              <Chip key={m.v} on={meal === m.v} onClick={() => setMeal(m.v)}>{m.label}</Chip>
            ))}
          </div>

          <Field label="What did you have?">
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chicken salad" autoFocus={!editEntry} maxLength={120} />
          </Field>

          {!editEntry && (
            <div className="wrap">
              {suggestions.map((s) => (
                <Chip key={s} on={title.toLowerCase() === s.toLowerCase()}
                  onClick={() => setTitle(s)}>{s}</Chip>
              ))}
            </div>
          )}

          {!details && (
            <Button variant="quiet" icon="plus" onClick={() => setDetails(true)}>
              Add calories or protein
            </Button>
          )}
          {details && (
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <Field label="Calories">
                  <Input type="number" inputMode="numeric" value={calories}
                    onChange={(e) => setCalories(e.target.value)} placeholder="optional" min={0} />
                </Field>
              </div>
              <div className="grow">
                <Field label="Protein (g)">
                  <Input type="number" inputMode="numeric" value={protein}
                    onChange={(e) => setProtein(e.target.value)} placeholder="optional" min={0} />
                </Field>
              </div>
            </div>
          )}

          {privacyRow}
          <Button variant="primary" size="lg" block busy={busy} onClick={() => saveEntry('food')}>
            {editEntry ? 'Save changes' : 'Add meal'}
          </Button>
          {editEntry && <Button variant="danger" block onClick={removeEntry}>Delete</Button>}
        </div>
      )}

      {/* ----------------------------------------------------- workout -- */}
      {mode === 'workout' && (
        <div className="stack">
          <Field label="What did you do?">
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Legs" autoFocus={!editEntry} maxLength={120} />
          </Field>

          {!editEntry && (
            <div className="wrap">
              {suggestions.map((s) => (
                <Chip key={s} on={title.toLowerCase() === s.toLowerCase()}
                  onClick={() => setTitle(s)}>{s}</Chip>
              ))}
            </div>
          )}

          <Field label="How long?">
            <div className="stack-s">
              <div className="wrap">
                {DURATIONS.map((d) => (
                  <Chip key={d} on={duration === d} onClick={() => setDuration(d)}>{d} min</Chip>
                ))}
              </div>
              <Card className="card--tint" style={{ padding: 10 }}>
                <Stepper value={duration} onChange={setDuration} min={0} max={360} step={5} unit="min" />
              </Card>
            </div>
          </Field>

          <Field label="How hard was it?">
            <div className="wrap">
              {INTENSITIES.map((i) => (
                <Chip key={i.v} on={intensity === i.v}
                  onClick={() => setIntensity(intensity === i.v ? null : i.v)}>{i.label}</Chip>
              ))}
            </div>
          </Field>

          {!details && (
            <Button variant="quiet" icon="plus" onClick={() => setDetails(true)}>Add a note</Button>
          )}
          {details && (
            <Field label="Notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Sets, reps, how it felt..." maxLength={1000} />
            </Field>
          )}

          {privacyRow}
          <Button variant="primary" size="lg" block busy={busy} onClick={() => saveEntry('workout')}>
            {editEntry ? 'Save changes' : 'Add workout'}
          </Button>
          {editEntry && <Button variant="danger" block onClick={removeEntry}>Delete</Button>}
        </div>
      )}

      {/* -------------------------------------------------------- task -- */}
      {mode === 'task' && (
        <div className="stack">
          <Field label="What did you get done?">
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Laundry" autoFocus={!editEntry} maxLength={120} />
          </Field>

          {!editEntry && (
            <div className="wrap">
              {suggestions.map((s) => (
                <Chip key={s} on={title.toLowerCase() === s.toLowerCase()}
                  onClick={() => setTitle(s)}>{s}</Chip>
              ))}
            </div>
          )}

          {!details && (
            <Button variant="quiet" icon="plus" onClick={() => setDetails(true)}>Add a note</Button>
          )}
          {details && (
            <Field label="Notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </Field>
          )}

          {privacyRow}
          <Button variant="primary" size="lg" block busy={busy} onClick={() => saveEntry('task')}>
            {editEntry ? 'Save changes' : 'Add task'}
          </Button>
          {editEntry && <Button variant="danger" block onClick={removeEntry}>Delete</Button>}
        </div>
      )}

      {/* --------------------------------------------------------- day -- */}
      {mode === 'day' && (
        <div className="stack">
          <Field label="How are you feeling?">
            <div className="moods">
              {MOODS.map((face, i) => (
                <button key={i} className="mood" data-on={mood === i + 1}
                  onClick={() => setMood(mood === i + 1 ? null : i + 1)}
                  aria-label={MOOD_WORDS[i]} type="button">{face}</button>
              ))}
            </div>
            {mood != null && (
              <p className="small center muted" style={{ marginTop: 6 }}>{MOOD_WORDS[mood - 1]}</p>
            )}
          </Field>

          <Field label="Energy">
            <div className="moods">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className="mood" data-on={energy === n}
                  style={{ fontSize: 16, fontWeight: 700 }}
                  onClick={() => setEnergy(energy === n ? null : n)}
                  aria-label={`Energy ${n} of 5`} type="button">{n}</button>
              ))}
            </div>
          </Field>

          <Field label="Sleep last night">
            <Card className="card--tint" style={{ padding: 10 }}>
              <Stepper value={sleep} onChange={setSleep} min={0} max={16} step={0.5} unit="hrs" />
            </Card>
          </Field>

          <Field label="Water today">
            <Card className="card--tint" style={{ padding: 10 }}>
              <Stepper value={water} onChange={setWater} min={0} max={30} step={1} unit="cups" />
            </Card>
          </Field>

          <Field label="Anything you want to remember about today?">
            <Textarea value={dayNote} onChange={(e) => setDayNote(e.target.value)}
              placeholder="Big win, hard moment, anything..." maxLength={2000} />
          </Field>

          {privacyRow}
          <Button variant="primary" size="lg" block busy={busy} onClick={saveDay}>Save my day</Button>
        </div>
      )}
    </Sheet>
  )
}
