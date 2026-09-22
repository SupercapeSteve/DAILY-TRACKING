import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { navigate } from '../../lib/router'
import * as api from '../../lib/api'
import type { PartnerViewState } from '../../lib/api'
import {
  clockTime, friendlyDate, lastNDays, relativeTime, todayISO, currentStreak,
} from '../../lib/dates'
import {
  goalProgress, loggedDates, rollupDay, rollupRange, summarize, weightTrend,
} from '../../lib/stats'
import { formatDuration, formatWeight, formatWeightDelta, ageFrom, formatHeight } from '../../lib/units'
import type { BodyProfile, DayLog, Entry, Feedback, Goal, WeightLog } from '../../lib/types'
import { ProgressBar, WeekBars, WeekStrip, WeightChart } from '../../components/Charts'
import {
  Banner, Button, Card, Confirm, Empty, Icon, Spinner, Textarea, toast,
} from '../../components/ui'

const MOODS = ['\u{1F622}', '\u{1F641}', '\u{1F610}', '\u{1F642}', '\u{1F604}']

/* ===================================================== dashboard ======== */

export function PartnerDashboard() {
  const { user, link, profile } = useAuth()
  const units = profile?.units ?? 'imperial'
  const ownerId = link?.owner_id ?? null

  const [view, setView] = useState<PartnerViewState | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [days, setDays] = useState<DayLog[]>([])
  const [weights, setWeights] = useState<WeightLog[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [body, setBody] = useState<BodyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<7 | 30>(7)

  const dates = lastNDays(range)

  const load = useCallback(async () => {
    if (!ownerId) { setLoading(false); return }
    setLoading(true)
    try {
      const v = await api.getPartnerViewState().catch(() => null)
      setView(v)
      const snap = await api.loadRange(ownerId, dates[0]!, dates[dates.length - 1]!)
      setEntries(snap.entries); setDays(snap.days); setGoals(snap.goals)
      setWeights(await api.listWeights(ownerId, lastNDays(120)[0]!).catch(() => []))
      setBody(await api.getBodyProfile(ownerId).catch(() => null))
    } finally { setLoading(false) }
  }, [ownerId, range])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const onFocus = () => { void load() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  if (!user) return <Spinner full />

  if (!ownerId) {
    return (
      <div className="screen stack-l">
        <h1 className="page-title">Not connected</h1>
        <Card className="card--flat">
          <Empty icon="link" title="You are not linked to anyone yet"
            hint="Ask for their 8-character code and sign in again to enter it." />
        </Card>
      </div>
    )
  }

  const name = view?.owner_name || 'Your partner'
  const paused = view?.paused ?? false
  const nothingOn = view
    ? !view.food && !view.workouts && !view.tasks && !view.day && !view.body && !view.goals
    : true

  const today = todayISO()
  const rolls = rollupRange(dates, entries, days)
  const sum = summarize(rolls)
  const todayRoll = rollupDay(today, entries, days.find((d) => d.log_date === today) ?? null)
  const todayDay = days.find((d) => d.log_date === today) ?? null
  const streak = currentStreak(loggedDates(entries, days))
  const trend = weightTrend(weights)
  const gp = goalProgress(goals, entries, days)
  const weekRolls = rollupRange(lastNDays(7), entries, days)

  const latest = weights.length ? Number(weights[weights.length - 1]!.weight_kg) : null
  const firstW = weights.length ? Number(weights[0]!.weight_kg) : null
  const change = latest != null && firstW != null ? latest - firstW : null

  const recent = entries
    .slice()
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.logged_at.localeCompare(a.logged_at))
    .slice(0, 25)

  return (
    <div className="screen stack-l">
      <div>
        <h1 className="page-title">{name}'s progress</h1>
        <p className="muted small">Read only. You cannot change anything here.</p>
      </div>

      {paused ? (
        <Banner kind="warn" icon="pause">
          <strong>{name} has paused sharing.</strong> Nothing is visible right now.
          That is completely their call - please don't read anything into it.
        </Banner>
      ) : nothingOn ? (
        <Banner kind="warn" icon="lock">
          <strong>Nothing is shared yet.</strong> {name} chooses what appears here from
          their own Settings screen.
        </Banner>
      ) : (
        <Banner icon="eye">
          You are seeing only what {name} chose to share. They can change or pause
          this at any time, and some entries may be marked private.
        </Banner>
      )}

      {loading ? (
        <div className="row" style={{ justifyContent: 'center', padding: 24 }}><Spinner /></div>
      ) : paused ? null : (
        <>
          {/* ----------------------------------------------------- today */}
          <div className="stack-s">
            <p className="section-label">Today</p>
            <div className="stat-grid">
              <div className="stat">
                <div className="stat__val" style={{ color: 'var(--food)' }}>
                  {view?.food ? todayRoll.meals : '--'}
                </div>
                <div className="stat__lbl">{view?.food ? 'meals' : 'not shared'}</div>
              </div>
              <div className="stat">
                <div className="stat__val" style={{ color: 'var(--workout)' }}>
                  {view?.workouts ? todayRoll.workoutMin : '--'}
                </div>
                <div className="stat__lbl">{view?.workouts ? 'gym min' : 'not shared'}</div>
              </div>
              <div className="stat">
                <div className="stat__val" style={{ color: 'var(--task)' }}>
                  {view?.tasks ? todayRoll.tasks : '--'}
                </div>
                <div className="stat__lbl">{view?.tasks ? 'tasks' : 'not shared'}</div>
              </div>
            </div>

            {view?.day && todayDay && (todayDay.mood != null || todayDay.day_note.trim()) && (
              <Card className="row">
                <span className="dot dot--day">
                  {todayDay.mood != null
                    ? <span style={{ fontSize: 20 }}>{MOODS[todayDay.mood - 1]}</span>
                    : <Icon name="day" size={20} />}
                </span>
                <div className="grow">
                  <p className="bold small">How their day went</p>
                  {todayDay.day_note.trim() && <p className="small muted pre-wrap">{todayDay.day_note}</p>}
                  <div className="meta" style={{ marginTop: 4 }}>
                    {todayDay.sleep_hours != null && <span><Icon name="moon" size={13} />{todayDay.sleep_hours}h</span>}
                    {todayDay.water_cups ? <span><Icon name="water" size={13} />{todayDay.water_cups} cups</span> : null}
                    {todayDay.energy != null && <span><Icon name="bolt" size={13} />energy {todayDay.energy}/5</span>}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* ------------------------------------------------- week strip */}
          <Card><WeekStrip rolls={weekRolls} /></Card>

          <div className="seg">
            <button className="seg__btn" data-on={range === 7} onClick={() => setRange(7)}>7 days</button>
            <button className="seg__btn" data-on={range === 30} onClick={() => setRange(30)}>30 days</button>
          </div>

          {/* .layout / .col dissolve on phones; on wide screens they split
              the page into two columns without changing the reading order. */}
          <div className="layout">
          <div className="col">

          {/* ---------------------------------------------------- summary */}
          <div className="stack-s">
            <p className="section-label">Last {range} days</p>
            <div className="stat-grid">
              <div className="stat">
                <div className="stat__val">{view?.workouts ? sum.workouts : '--'}</div>
                <div className="stat__lbl">workouts</div>
              </div>
              <div className="stat">
                <div className="stat__val">{view?.workouts ? sum.workoutMin : '--'}</div>
                <div className="stat__lbl">gym min</div>
              </div>
              <div className="stat">
                <div className="stat__val">{view?.tasks ? sum.tasks : '--'}</div>
                <div className="stat__lbl">tasks</div>
              </div>
              <div className="stat">
                <div className="stat__val">{streak}</div>
                <div className="stat__lbl">day streak</div>
              </div>
              <div className="stat">
                <div className="stat__val">{view?.day && sum.avgMood != null ? sum.avgMood : '--'}</div>
                <div className="stat__lbl">avg mood</div>
              </div>
              <div className="stat">
                <div className="stat__val">{view?.food && sum.avgProtein != null ? sum.avgProtein : '--'}</div>
                <div className="stat__lbl">avg protein</div>
              </div>
            </div>
          </div>

          {view?.workouts && (
            <Card className="stack-s">
              <p className="bold">Gym minutes this week</p>
              <WeekBars rolls={weekRolls} metric="workoutMin" />
            </Card>
          )}

          {/* ----------------------------------------------------- weight */}
          {view?.body && (
            <Card className="stack">
              <div>
                <p className="bold">Weight</p>
                <p className="small muted">
                  {latest != null ? formatWeight(latest, units) : 'No weigh-ins shared'}
                  {change != null && weights.length > 1 && (
                    <span className="mute-2"> &middot; {formatWeightDelta(change, units)} overall</span>
                  )}
                </p>
              </div>
              {trend.length >= 2
                ? <WeightChart points={trend} goalKg={body?.goal_weight_kg ?? null} units={units} />
                : <Empty icon="scale" title="Not enough weigh-ins yet" />}
              {(body?.birthdate || body?.height_cm) && (
                <>
                  <hr className="divider" />
                  <div className="meta">
                    {ageFrom(body.birthdate) != null && <span>Age {ageFrom(body.birthdate)}</span>}
                    {body.height_cm && <span>Height {formatHeight(body.height_cm, units)}</span>}
                    {body.goal_weight_kg && <span>Goal {formatWeight(body.goal_weight_kg, units)}</span>}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* ------------------------------------------------------ goals */}
          {view?.goals && gp.length > 0 && (
            <div className="stack-s">
              <p className="section-label">Their goals</p>
              {gp.map((g) => (
                <Card key={g.goal.id} className="stack-s">
                  <div className="row-between">
                    <span className="bold grow">{g.goal.title}</span>
                    <span className="small muted">{g.current} / {g.target} {g.unit}</span>
                  </div>
                  <ProgressBar pct={g.pct} />
                </Card>
              ))}
            </div>
          )}

          </div>

          <div className="col">
          {/* ----------------------------------------------------- recent */}
          <div className="stack-s">
            <p className="section-label">Recent entries</p>
            {recent.length === 0 ? (
              <Card className="card--flat">
                <Empty icon="sparkle" title="Nothing shared in this range"
                  hint="Either nothing was logged, or those categories are switched off." />
              </Card>
            ) : (
              <Card style={{ padding: 0 }}>
                {recent.map((e) => (
                  <div key={e.id} className="entry" style={{ cursor: 'default' }}>
                    <span className={`dot dot--${e.kind}`}><Icon name={e.kind} size={20} /></span>
                    <span className="grow">
                      <span className="bold" style={{ display: 'block' }}>{e.title}</span>
                      <span className="meta">
                        <span>{friendlyDate(e.entry_date)}</span>
                        <span>{clockTime(e.logged_at)}</span>
                        {e.meal_type && <span>{e.meal_type}</span>}
                        {e.duration_min ? <span>{formatDuration(e.duration_min)}</span> : null}
                        {e.calories ? <span>{e.calories} cal</span> : null}
                        {e.protein_g ? <span>{e.protein_g}g protein</span> : null}
                      </span>
                      {e.notes.trim() && (
                        <span className="small muted pre-wrap" style={{ display: 'block', marginTop: 4 }}>{e.notes}</span>
                      )}
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </div>

          <p className="tiny mute-2 center">
            Some entries may be hidden. {name} can mark anything as private as they write it.
          </p>
          </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ==================================================== send a note ======= */

const PROMPTS = [
  'Something you noticed they did well this week',
  'One specific thing, not a list',
  'Ask how something felt before suggesting a change',
]

export function PartnerNotes() {
  const { user, link } = useAuth()
  const [body, setBody] = useState('')
  const [sent, setSent] = useState<Feedback[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<Feedback | null>(null)
  const [name, setName] = useState('them')

  const ownerId = link?.owner_id ?? null

  const load = useCallback(async () => {
    if (!ownerId) { setLoading(false); return }
    try {
      const [notes, v] = await Promise.all([
        api.listFeedback(ownerId).catch(() => []),
        api.getPartnerViewState().catch(() => null),
      ])
      setSent(notes)
      if (v?.owner_name) setName(v.owner_name)
    } finally { setLoading(false) }
  }, [ownerId])

  useEffect(() => { void load() }, [load])

  if (!user) return <Spinner full />

  async function send() {
    const text = body.trim()
    if (!text || !ownerId) return
    setBusy(true)
    try {
      await api.sendFeedback(ownerId, user!.id, text)
      setBody('')
      toast('Note sent')
      await load()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not send', true) }
    finally { setBusy(false) }
  }

  return (
    <div className="screen screen--narrow stack-l">
      <div>
        <h1 className="page-title">Send a note</h1>
        <p className="muted small">{name} sees these in their app.</p>
      </div>

      {!ownerId ? (
        <Card className="card--flat">
          <Empty icon="link" title="Not connected yet" />
        </Card>
      ) : (
        <>
          <Card className="stack-s">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Write something to ${name}...`}
              maxLength={2000}
              style={{ minHeight: 130 }}
            />
            <Button variant="primary" block icon="send" busy={busy}
              disabled={!body.trim()} onClick={send}>Send note</Button>
          </Card>

          <Card className="card--tint stack-s">
            <p className="bold small">
              <Icon name="heart" size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              Notes that actually help
            </p>
            {PROMPTS.map((p) => (
              <p key={p} className="small muted">&middot; {p}</p>
            ))}
            <p className="tiny mute-2">
              They can delete any note, and they chose to share this with you - that
              trust is worth protecting.
            </p>
          </Card>

          <div className="stack-s">
            <p className="section-label">Notes you have sent</p>
            {loading ? (
              <div className="row" style={{ justifyContent: 'center' }}><Spinner /></div>
            ) : sent.length === 0 ? (
              <Empty icon="message" title="None yet" />
            ) : (
              sent.map((n) => (
                <div key={n.id} className="note note--mine stack-s">
                  <p className="pre-wrap small">{n.body}</p>
                  <div className="row-between">
                    <span className="tiny mute-2">
                      {relativeTime(n.created_at)}
                      {n.reaction === 'heart' && ' · they hearted this'}
                    </span>
                    <button className="icon-btn" aria-label="Unsend"
                      onClick={() => setRemoving(n)}>
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      <Confirm
        open={Boolean(removing)}
        title="Unsend this note?"
        onCancel={() => setRemoving(null)}
        confirmLabel="Unsend"
        onConfirm={async () => {
          if (!removing) return
          try { await api.deleteFeedback(removing.id); await load(); toast('Removed') }
          catch { toast('Could not remove', true) }
          setRemoving(null)
        }}
      />
    </div>
  )
}

/* ================================================ partner settings ====== */

export function PartnerSettings() {
  const { user, signOut, link } = useAuth()
  const [view, setView] = useState<PartnerViewState | null>(null)
  const [ask, setAsk] = useState(false)

  useEffect(() => {
    api.getPartnerViewState().then(setView).catch(() => setView(null))
  }, [])

  if (!user) return <Spinner full />

  const rows: [string, boolean][] = view ? [
    ['Meals', view.food],
    ['Workouts', view.workouts],
    ['Tasks', view.tasks],
    ['How their day went', view.day],
    ['Goals', view.goals],
    ['Body basics', view.body],
  ] : []

  return (
    <div className="screen screen--narrow stack-l">
      <h1 className="page-title">Settings</h1>

      <div className="stack-s">
        <p className="section-label">What you can currently see</p>
        {!link?.owner_id ? (
          <Card className="card--flat"><Empty icon="link" title="Not connected" /></Card>
        ) : view?.paused ? (
          <Banner kind="warn" icon="pause">Sharing is paused right now.</Banner>
        ) : (
          <Card style={{ padding: '4px 16px' }}>
            {rows.map(([label, on]) => (
              <div key={label} className="row" style={{ minHeight: 52, borderTop: '1px solid var(--border)' }}>
                <Icon name={on ? 'eye' : 'eyeOff'} size={18}
                  style={{ color: on ? 'var(--primary)' : 'var(--text-mute)' }} />
                <span className="grow">{label}</span>
                <span className="small mute-2">{on ? 'Shared' : 'Off'}</span>
              </div>
            ))}
          </Card>
        )}
        <p className="tiny mute-2">
          Only they can change these. There is no way for you to turn anything on
          from your side - by design.
        </p>
      </div>

      <div className="stack-s">
        <p className="section-label">Look</p>
        <Card style={{ padding: 0 }}>
          <button className="entry" style={{ padding: 16 }} onClick={() => navigate('appearance')}>
            <span className="dot" style={{ background: 'var(--primary)' }}>
              <Icon name="sparkle" size={20} />
            </span>
            <span className="grow">
              <span className="bold" style={{ display: 'block' }}>Appearance</span>
              <span className="small muted">
                Your own colours, text size and layout - separate from theirs.
              </span>
            </span>
            <Icon name="next" size={20} />
          </button>
        </Card>
      </div>

      <div className="stack-s">
        <p className="section-label">Their data</p>
        <Card style={{ padding: 0 }}>
          <button className="entry" style={{ padding: 16 }} onClick={() => navigate('export')}>
            <span className="dot" style={{ background: 'var(--task)' }}>
              <Icon name="send" size={20} />
            </span>
            <span className="grow">
              <span className="bold" style={{ display: 'block' }}>Export what is shared</span>
              <span className="small muted">
                Save the shared progress as one file you can keep or print.
              </span>
            </span>
            <Icon name="next" size={20} />
          </button>
        </Card>
      </div>

      <div className="stack-s">
        <p className="section-label">Account</p>
        <Card className="stack-s">
          <p className="small muted">Signed in as</p>
          <p className="bold truncate">{user.email}</p>
        </Card>
        <Button variant="quiet" block icon="logout" onClick={() => setAsk(true)}>Sign out</Button>
      </div>

      <Confirm
        open={ask}
        title="Sign out?"
        confirmLabel="Sign out"
        onCancel={() => setAsk(false)}
        onConfirm={() => { void signOut() }}
      />
    </div>
  )
}
