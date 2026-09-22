import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import * as api from '../../lib/api'
import { lastNDays, todayISO, currentStreak } from '../../lib/dates'
import {
  goalProgress, loggedDates, rollupRange, summarize, weightTrend,
} from '../../lib/stats'
import {
  formatWeight, formatWeightDelta, kgToWeightInput, weightInputToKg, weightUnitLabel, ageFrom, formatHeight,
} from '../../lib/units'
import type { BodyProfile, DayLog, Entry, Goal, GoalMetric, WeightLog } from '../../lib/types'
import { ProgressBar, WeekBars, WeightChart } from '../../components/Charts'
import {
  Button, Card, Empty, Field, Icon, Input, Sheet, Spinner, toast, Confirm,
} from '../../components/ui'
import { ACCOUNT_PERKS, GUEST_HISTORY_DAYS } from '../../lib/guest'
import { navigate } from '../../lib/router'

const GOAL_PRESETS: { metric: GoalMetric; title: string; target: number; unit: string }[] = [
  { metric: 'workouts_per_week', title: 'Workouts each week', target: 4, unit: 'workouts' },
  { metric: 'workout_minutes_per_week', title: 'Gym minutes each week', target: 180, unit: 'min' },
  { metric: 'tasks_per_week', title: 'Tasks each week', target: 10, unit: 'tasks' },
  { metric: 'days_logged_per_week', title: 'Days logged each week', target: 6, unit: 'days' },
  { metric: 'water_per_day', title: 'Water each day', target: 8, unit: 'cups' },
  { metric: 'protein_per_day', title: 'Protein each day', target: 100, unit: 'g' },
  { metric: 'calories_per_day', title: 'Calories each day', target: 1800, unit: 'cal' },
]

export default function Progress() {
  const { user, profile, isGuest } = useAuth()
  const units = profile?.units ?? 'imperial'

  const [range, setRange] = useState<7 | 30>(7)
  const [entries, setEntries] = useState<Entry[]>([])
  const [days, setDays] = useState<DayLog[]>([])
  const [weights, setWeights] = useState<WeightLog[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [body, setBody] = useState<BodyProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const [weighSheet, setWeighSheet] = useState(false)
  const [weighVal, setWeighVal] = useState('')
  const [goalSheet, setGoalSheet] = useState(false)
  const [removing, setRemoving] = useState<Goal | null>(null)

  const dates = lastNDays(range)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [snap, b] = await Promise.all([
        api.loadRange(user.id, dates[0]!, dates[dates.length - 1]!),
        api.getBodyProfile(user.id).catch(() => null),
      ])
      setEntries(snap.entries); setDays(snap.days)
      setGoals(snap.goals); setBody(b)
      // the chart wants more history than the selected range
      setWeights(await api.listWeights(user.id, lastNDays(120)[0]!).catch(() => []))
    } finally { setLoading(false) }
  }, [user, range])

  useEffect(() => { void load() }, [load])

  if (!user) return <Spinner full />

  const rolls = rollupRange(dates, entries, days)
  const sum = summarize(rolls)
  const streak = currentStreak(loggedDates(entries, days))
  const trend = weightTrend(weights)
  const gp = goalProgress(goals, entries, days)

  const latest = weights.length ? Number(weights[weights.length - 1]!.weight_kg) : null
  const first = weights.length ? Number(weights[0]!.weight_kg) : null
  const change = latest != null && first != null ? latest - first : null
  const age = ageFrom(body?.birthdate)

  async function saveWeight() {
    const kg = weightInputToKg(weighVal ? Number(weighVal) : null, units)
    if (!kg) { toast('Enter a weight first', true); return }
    try {
      await api.upsertWeight(user!.id, todayISO(), kg)
      setWeighSheet(false); setWeighVal('')
      toast('Weight saved')
      await load()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save', true) }
  }

  async function addGoal(p: typeof GOAL_PRESETS[number]) {
    try {
      await api.createGoal({
        owner_id: user!.id, title: p.title, metric: p.metric, target_value: p.target,
      })
      setGoalSheet(false); toast('Goal added'); await load()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not add', true) }
  }

  return (
    <div className="screen stack-l">
      <div>
        <h1 className="page-title">Your progress</h1>
        <p className="muted small">Only you see this page.</p>
      </div>

      {isGuest ? (
        <p className="small muted center">
          Last {GUEST_HISTORY_DAYS} days. An account keeps the lot.
        </p>
      ) : (
        <div className="seg">
          <button className="seg__btn" data-on={range === 7} onClick={() => setRange(7)}>Last 7 days</button>
          <button className="seg__btn" data-on={range === 30} onClick={() => setRange(30)}>Last 30 days</button>
        </div>
      )}

      {/* .layout / .col dissolve on phones, so this stacks exactly as before;
          on wide screens they become two columns. */}
      <div className="layout">
        <div className="col">
      {loading ? (
        <div className="row" style={{ justifyContent: 'center', padding: 24 }}><Spinner /></div>
      ) : (
        <>
          {/* -------------------------------------------------------- streak */}
          {streak > 0 && (
            <Card className="row card--accent">
              <span className="dot" style={{ background: 'var(--amber)' }}><Icon name="flame" size={20} /></span>
              <div className="grow">
                <p className="bold">{streak}-day streak</p>
                <p className="small muted">
                  {streak < 3 ? 'Nice start - keep it going.'
                    : streak < 7 ? 'You are building a real habit.'
                    : 'That is genuinely impressive consistency.'}
                </p>
              </div>
            </Card>
          )}

          {/* ------------------------------------------------------ summary */}
          <div className="stack-s">
            <p className="section-label">Totals</p>
            <div className="stat-grid">
              <div className="stat">
                <div className="stat__val">{sum.workouts}</div>
                <div className="stat__lbl">workouts</div>
              </div>
              <div className="stat">
                <div className="stat__val">{sum.workoutMin}</div>
                <div className="stat__lbl">gym min</div>
              </div>
              <div className="stat">
                <div className="stat__val">{sum.tasks}</div>
                <div className="stat__lbl">tasks</div>
              </div>
              <div className="stat">
                <div className="stat__val">{sum.daysLogged}<span className="mute-2" style={{ fontSize: 15 }}>/{range}</span></div>
                <div className="stat__lbl">days logged</div>
              </div>
              <div className="stat">
                <div className="stat__val">{sum.avgMood != null ? `${sum.avgMood}` : '--'}</div>
                <div className="stat__lbl">avg mood</div>
              </div>
              <div className="stat">
                <div className="stat__val">{sum.avgWater != null ? sum.avgWater : '--'}</div>
                <div className="stat__lbl">avg water</div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------- charts */}
          {range === 7 && (
            <Card className="stack-s">
              <p className="bold">Gym minutes</p>
              <WeekBars rolls={rolls} metric="workoutMin" />
            </Card>
          )}

          {isGuest && (
            <Card className="stack-s">
              <div className="row">
                <span className="dot" style={{ background: 'var(--primary)' }}>
                  <Icon name="sparkle" size={20} />
                </span>
                <div className="grow">
                  <p className="bold">More with an account</p>
                  <p className="small muted">Free, and everything you have logged comes with you.</p>
                </div>
              </div>
              <hr className="divider" />
              {ACCOUNT_PERKS.map((p) => (
                <div key={p.title} className="row" style={{ alignItems: 'flex-start' }}>
                  <Icon name={p.icon} size={17} style={{ color: 'var(--primary)', marginTop: 3, flex: '0 0 auto' }} />
                  <span className="grow">
                    <span className="bold small" style={{ display: 'block' }}>{p.title}</span>
                    <span className="tiny mute-2">{p.why}</span>
                  </span>
                </div>
              ))}
              <Button variant="primary" block onClick={() => navigate('settings')}>
                Create an account
              </Button>
            </Card>
          )}

          {/* ------------------------------------------------------- weight */}
          {!isGuest && (
          <Card className="stack">
            <div className="row-between">
              <div>
                <p className="bold">Weight</p>
                <p className="small muted">
                  {latest != null ? formatWeight(latest, units) : 'Not tracked yet'}
                  {change != null && weights.length > 1 && (
                    <span className="mute-2"> &middot; {formatWeightDelta(change, units)} overall</span>
                  )}
                </p>
              </div>
              <Button size="sm" icon="plus" onClick={() => {
                setWeighVal(kgToWeightInput(latest, units)?.toString() ?? '')
                setWeighSheet(true)
              }}>Log</Button>
            </div>

            {trend.length >= 2 ? (
              <WeightChart points={trend} goalKg={body?.goal_weight_kg ?? null} units={units} />
            ) : (
              <Empty icon="scale" title="Log twice to see your trend"
                hint="One weigh-in a week is plenty." />
            )}

            {(age != null || body?.height_cm || body?.goal_weight_kg) && (
              <>
                <hr className="divider" />
                <div className="meta">
                  {age != null && <span>Age {age}</span>}
                  {body?.height_cm && <span>Height {formatHeight(body.height_cm, units)}</span>}
                  {body?.goal_weight_kg && <span>Goal {formatWeight(body.goal_weight_kg, units)}</span>}
                </div>
              </>
            )}
          </Card>
          )}
        </>
      )}
        </div>

        <div className="col">
          {!loading && (
            <>
          {/* -------------------------------------------------------- goals */}
          {!isGuest && (
          <div className="stack-s">
            <div className="row-between">
              <p className="section-label">Your goals</p>
              <button className="link-btn" onClick={() => setGoalSheet(true)}>Add</button>
            </div>

            {gp.length === 0 ? (
              <Card className="card--flat">
                <Empty icon="target" title="No goals yet"
                  hint="Set one or two things to aim for. You can change them whenever." />
              </Card>
            ) : (
              <div className="stack-s">
                {gp.map((g) => (
                  <Card key={g.goal.id} className="stack-s">
                    <div className="row-between">
                      <span className="bold grow">{g.goal.title}</span>
                      <span className="small muted">
                        {g.current} / {g.target} {g.unit}
                      </span>
                      <button className="icon-btn" aria-label="Remove goal"
                        onClick={() => setRemoving(g.goal)}>
                        <Icon name="x" size={18} />
                      </button>
                    </div>
                    <ProgressBar pct={g.pct} />
                    <p className="tiny mute-2">
                      {g.window === 'day' ? 'Today' : 'This week'}
                      {g.pct >= 100 ? ' · done' : ''}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------- weigh sheet */}
      <Sheet open={weighSheet} onClose={() => setWeighSheet(false)} title="Log your weight">
        <div className="stack">
          <Field label={`Weight today (${weightUnitLabel(units)})`}>
            <Input className="input--lg" type="number" inputMode="decimal" step="0.1"
              value={weighVal} onChange={(e) => setWeighVal(e.target.value)} autoFocus />
          </Field>
          <Button variant="primary" size="lg" block onClick={saveWeight}>Save</Button>
          <p className="tiny mute-2 center">
            Weighing in once a week at the same time of day gives a much truer picture
            than doing it daily.
          </p>
        </div>
      </Sheet>

      {/* -------------------------------------------------------- goal sheet */}
      <Sheet open={goalSheet} onClose={() => setGoalSheet(false)} title="Add a goal">
        <div className="stack-s">
          <p className="muted small">Pick something to aim for. These are yours - you set them.</p>
          {GOAL_PRESETS
            .filter((p) => !goals.some((g) => g.metric === p.metric))
            .map((p) => (
              <Card key={p.metric} style={{ padding: 0 }}>
                <button className="entry" style={{ padding: 14 }} onClick={() => addGoal(p)}>
                  <span className="dot" style={{ background: 'var(--primary)' }}>
                    <Icon name="target" size={19} />
                  </span>
                  <span className="grow">
                    <span className="bold" style={{ display: 'block' }}>{p.title}</span>
                    <span className="small muted">Starts at {p.target} {p.unit}</span>
                  </span>
                  <Icon name="plus" size={20} />
                </button>
              </Card>
            ))}
          {GOAL_PRESETS.every((p) => goals.some((g) => g.metric === p.metric)) && (
            <Empty icon="check" title="You have them all" hint="Remove one to swap it out." />
          )}
        </div>
      </Sheet>

      <Confirm
        open={Boolean(removing)}
        title="Remove this goal?"
        body={removing?.title}
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          try { await api.deleteGoal(removing.id); await load(); toast('Removed') }
          catch (e) { toast(e instanceof Error ? e.message : 'Could not remove', true) }
          setRemoving(null)
        }}
      />
    </div>
  )
}
