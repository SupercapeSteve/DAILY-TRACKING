import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import * as api from '../../lib/api'
import { friendlyDate, clockTime, greeting, longDate, todayISO, lastNDays } from '../../lib/dates'
import { rollupRange, rollupDay } from '../../lib/stats'
import { formatDuration } from '../../lib/units'
import type { DayLog, Entry } from '../../lib/types'
import { WeekStrip } from '../../components/Charts'
import { Button, Card, Empty, Icon, Spinner, Banner } from '../../components/ui'
import LogSheet from './LogSheet'
import { navigate } from '../../lib/router'

const MOODS = ['\u{1F622}', '\u{1F641}', '\u{1F610}', '\u{1F642}', '\u{1F604}']

export default function Today() {
  const { user, profile, share, link, isSolo } = useAuth()
  const [date, setDate] = useState(todayISO())
  const [entries, setEntries] = useState<Entry[]>([])
  const [days, setDays] = useState<DayLog[]>([])
  const [loading, setLoading] = useState(true)

  const [sheet, setSheet] = useState(false)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [editingDay, setEditingDay] = useState<DayLog | null>(null)
  const [startMode, setStartMode] = useState<'food' | 'workout' | 'task' | 'day' | undefined>()

  // A rolling 7 days ending today, NOT Mon-Sun: on a Monday the calendar
  // week would be six empty future boxes, which reads as "you've done nothing".
  const week = lastNDays(7)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const [e, d] = await Promise.all([
        api.listEntries(user.id, week[0]!, week[6]!),
        api.listDayLogs(user.id, week[0]!, week[6]!),
      ])
      setEntries(e); setDays(d)
    } catch {
      /* the banner below covers the offline case */
    } finally { setLoading(false) }
  }, [user, week[0], week[6]])

  useEffect(() => { void load() }, [load])

  // Refetch when she comes back to the tab, so a second device stays in sync.
  useEffect(() => {
    const onFocus = () => { void load() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  if (!user) return <Spinner full />

  const dayLog = days.find((d) => d.log_date === date) ?? null
  const dayEntries = entries
    .filter((e) => e.entry_date === date)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
  const roll = rollupDay(date, entries, dayLog)
  const weekRolls = rollupRange(week, entries, days)

  const sharingOn = Boolean(share) && !share!.sharing_paused && Boolean(link?.partner_id)
  const activeCount = share
    ? [share.share_food, share.share_workouts, share.share_tasks,
       share.share_day, share.share_body, share.share_goals].filter(Boolean).length
    : 0

  function openAdd(mode?: 'food' | 'workout' | 'task' | 'day') {
    setEditing(null); setEditingDay(null); setStartMode(mode); setSheet(true)
  }

  return (
    <div className="screen screen--fab stack-l">
      {/* --------------------------------------------------------- header */}
      <div>
        <p className="muted small">{greeting()}{profile?.display_name ? `, ${profile.display_name}` : ''}</p>
        <h1 className="page-title">{friendlyDate(date)}</h1>
        <p className="mute-2 small">{longDate(date)}</p>
      </div>

      {/* Sharing state - always visible, never buried. A solo account has
          nothing to share, so the whole control would just be noise. */}
      {!isSolo && (
      <button
        className="banner"
        onClick={() => navigate('settings')}
        style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
      >
        <Icon name={sharingOn ? 'eye' : 'lock'} size={18} />
        <span className="grow small">
          {!link?.partner_id
            ? <>No one is connected yet. <strong>Tap to invite your partner.</strong></>
            : share?.sharing_paused
              ? <>Sharing is <strong>paused</strong>. Nothing is visible right now.</>
              : activeCount === 0
                ? <>Connected, but <strong>nothing is shared</strong> yet. Tap to choose.</>
                : <>Sharing <strong>{activeCount} of 6</strong> things. Tap to change.</>}
        </span>
        <Icon name="next" size={16} />
      </button>
      )}

      {/* ----------------------------------------------------- week strip */}
      <Card className="stack-s">
        <WeekStrip rolls={weekRolls} selected={date} onSelect={setDate} />
      </Card>

      {/* On a phone .layout and .col collapse away entirely, so these sections
          just stack and the reading order is identical at every width. On a
          wide screen they become the two content columns. */}
      <div className="layout">
        <div className="col">
      {loading ? (
        <div className="row center" style={{ justifyContent: 'center', padding: 20 }}>
          <Spinner />
        </div>
      ) : (
        <>
          {/* ---------------------------------------------------- at a glance */}
          <div className="stat-grid">
            <div className="stat">
              <div className="stat__val" style={{ color: 'var(--food)' }}>{roll.meals}</div>
              <div className="stat__lbl">{roll.meals === 1 ? 'meal' : 'meals'}</div>
            </div>
            <div className="stat">
              <div className="stat__val" style={{ color: 'var(--workout)' }}>
                {roll.workoutMin > 0 ? roll.workoutMin : '0'}
              </div>
              <div className="stat__lbl">gym min</div>
            </div>
            <div className="stat">
              <div className="stat__val" style={{ color: 'var(--task)' }}>{roll.tasks}</div>
              <div className="stat__lbl">{roll.tasks === 1 ? 'task' : 'tasks'}</div>
            </div>
          </div>

          {/* --------------------------------------------------- how was today */}
          {dayLog && (dayLog.mood != null || dayLog.day_note.trim()) ? (
            <Card style={{ padding: 0 }}>
              <button className="entry" style={{ padding: 16 }}
                onClick={() => { setEditingDay(dayLog); setEditing(null); setStartMode('day'); setSheet(true) }}>
                <span className="dot dot--day">
                  {dayLog.mood != null
                    ? <span style={{ fontSize: 20 }}>{MOODS[dayLog.mood - 1]}</span>
                    : <Icon name="day" size={20} />}
                </span>
                <span className="grow">
                  <span className="bold" style={{ display: 'block' }}>How the day went</span>
                  {dayLog.day_note.trim() ? (
                    <span className="small muted pre-wrap">{dayLog.day_note}</span>
                  ) : (
                    <span className="small muted">Logged</span>
                  )}
                  <span className="meta" style={{ marginTop: 6 }}>
                    {dayLog.sleep_hours != null && <span><Icon name="moon" size={13} />{dayLog.sleep_hours}h sleep</span>}
                    {dayLog.water_cups != null && dayLog.water_cups > 0 &&
                      <span><Icon name="water" size={13} />{dayLog.water_cups} cups</span>}
                    {dayLog.energy != null && <span><Icon name="bolt" size={13} />energy {dayLog.energy}/5</span>}
                    {dayLog.is_private && !isSolo && <span className="pill pill--private"><Icon name="lock" />Just me</span>}
                  </span>
                </span>
                <Icon name="edit" size={18} />
              </button>
            </Card>
          ) : (
            <Card className="stack-s card--accent">
              <div className="row">
                <span className="dot dot--day"><Icon name="day" size={20} /></span>
                <div className="grow">
                  <p className="bold">How was {date === todayISO() ? 'today' : 'this day'}?</p>
                  <p className="small muted">Takes about five seconds.</p>
                </div>
              </div>
              <div className="moods">
                {MOODS.map((face, i) => (
                  <button key={i} className="mood" type="button"
                    aria-label={`Mood ${i + 1} of 5`}
                    onClick={async () => {
                      try {
                        await api.upsertDayLog(user.id, date, { mood: i + 1 })
                        await load()
                      } catch { /* toast handled by sheet path */ }
                    }}>{face}</button>
                ))}
              </div>
              <Button variant="quiet" block onClick={() => openAdd('day')}>
                Add sleep, water and a note
              </Button>
            </Card>
          )}

          {/* ------------------------------------------------------- timeline */}
          <div className="stack-s">
            <div className="row-between">
              <p className="section-label">{friendlyDate(date)}'s log</p>
              {dayEntries.length > 0 && (
                <span className="tiny mute-2">{dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}</span>
              )}
            </div>

            {dayEntries.length === 0 ? (
              <Card className="card--flat">
                <Empty
                  icon="sparkle"
                  title="Nothing logged yet"
                  hint="Tap the + button to add a meal, a workout, or something you got done."
                />
              </Card>
            ) : (
              <Card style={{ padding: 0 }}>
                {dayEntries.map((e) => (
                  <button key={e.id} className="entry"
                    onClick={() => { setEditing(e); setEditingDay(null); setStartMode(undefined); setSheet(true) }}>
                    <span className={`dot dot--${e.kind}`}><Icon name={e.kind} size={20} /></span>
                    <span className="grow">
                      <span className="bold" style={{ display: 'block' }}>{e.title}</span>
                      <span className="meta">
                        <span>{clockTime(e.logged_at)}</span>
                        {e.meal_type && <span>{e.meal_type}</span>}
                        {e.duration_min ? <span>{formatDuration(e.duration_min)}</span> : null}
                        {e.intensity && <span>{e.intensity}</span>}
                        {e.calories ? <span>{e.calories} cal</span> : null}
                        {e.protein_g ? <span>{e.protein_g}g protein</span> : null}
                        {e.is_private && !isSolo && <span className="pill pill--private"><Icon name="lock" />Just me</span>}
                      </span>
                      {e.notes.trim() && <span className="small muted pre-wrap" style={{ display: 'block', marginTop: 4 }}>{e.notes}</span>}
                    </span>
                    <Icon name="edit" size={18} />
                  </button>
                ))}
              </Card>
            )}
          </div>
        </>
      )}
        </div>

        <div className="col">
          {!loading && (
            <>
              {/* ------------------------------------------------- quick add */}
              <div className="stack-s">
                <p className="section-label">Quick add</p>
                <div className="row" style={{ gap: 8 }}>
                  {([['food', 'Meal'], ['workout', 'Workout'], ['task', 'Task']] as const).map(([k, label]) => (
                    <button key={k} className="card grow" style={{ padding: '14px 8px', cursor: 'pointer', border: 0 }}
                      onClick={() => openAdd(k)}>
                      <span className={`dot dot--${k}`} style={{ margin: '0 auto 6px' }}><Icon name={k} size={19} /></span>
                      <span className="small bold" style={{ display: 'block', textAlign: 'center' }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {date !== todayISO() && (
                <Button variant="ghost" block icon="back" onClick={() => setDate(todayISO())}>
                  Back to today
                </Button>
              )}

              {date === todayISO() && (
                <Banner icon="info">
                  Missed a day? Tap any date above to go back and fill it in.
                </Banner>
              )}
            </>
          )}
        </div>
      </div>

      {/* the floating add button */}
      <button className="fab" aria-label="Add something" onClick={() => openAdd()}>
        <Icon name="plus" size={30} />
      </button>

      <LogSheet
        open={sheet}
        onClose={() => { setSheet(false); setEditing(null); setEditingDay(null); setStartMode(undefined) }}
        ownerId={user.id}
        date={date}
        onSaved={load}
        editEntry={editing}
        editDay={editingDay}
        startMode={startMode}
      />
    </div>
  )
}
