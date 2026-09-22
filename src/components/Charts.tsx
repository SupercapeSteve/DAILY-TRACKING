import { fromISO, todayISO, weekdayInitial } from '../lib/dates'
import type { DayRollup } from '../lib/stats'
import { formatWeight } from '../lib/units'
import type { Units } from '../lib/types'

/* -------------------------------------------------------- weight line --- */

export function WeightChart({ points, goalKg, units, height = 150 }: {
  points: { date: string; kg: number; raw: number }[]
  goalKg?: number | null
  units: Units
  height?: number
}) {
  if (points.length < 2) return null

  const W = 320, H = height, PAD_X = 10, PAD_T = 14, PAD_B = 22

  const values = points.map((p) => p.kg)
  const candidates = [...values, ...points.map((p) => p.raw)]
  if (goalKg) candidates.push(goalKg)
  let lo = Math.min(...candidates)
  let hi = Math.max(...candidates)
  if (hi - lo < 1) { lo -= 1; hi += 1 }         // avoid a flat, meaningless line
  const pad = (hi - lo) * 0.15
  lo -= pad; hi += pad

  const x = (i: number) => PAD_X + (i / (points.length - 1)) * (W - PAD_X * 2)
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B)

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - PAD_B} L${x(0).toFixed(1)},${H - PAD_B} Z`

  const first = points[0]!, last = points[points.length - 1]!

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img" aria-label={`Weight trend from ${formatWeight(first.kg, units)} to ${formatWeight(last.kg, units)}`}>
        <defs>
          <linearGradient id="wfade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {goalKg != null && goalKg >= lo && goalKg <= hi && (
          <>
            <line x1={PAD_X} x2={W - PAD_X} y1={y(goalKg)} y2={y(goalKg)}
              stroke="var(--blush)" strokeWidth="1.5" strokeDasharray="5 4" />
            <text x={W - PAD_X} y={y(goalKg) - 5} textAnchor="end"
              fontSize="10" fontWeight="700" fill="var(--blush)">goal</text>
          </>
        )}

        <path d={area} fill="url(#wfade)" />
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* actual weigh-ins as faint dots behind the smoothed line */}
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.raw)} r="1.8"
            fill="var(--text-mute)" opacity="0.35" />
        ))}
        <circle cx={x(points.length - 1)} cy={y(last.kg)} r="4.5"
          fill="var(--primary)" stroke="var(--surface)" strokeWidth="2" />

        <text x={PAD_X} y={H - 6} fontSize="10.5" fill="var(--text-mute)" fontWeight="600">
          {fromISO(first.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </text>
        <text x={W - PAD_X} y={H - 6} textAnchor="end" fontSize="10.5" fill="var(--text-mute)" fontWeight="600">
          {fromISO(last.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </text>
      </svg>
      <p className="tiny mute-2 center" style={{ marginTop: 2 }}>
        Smoothed 7-day average. Dots are individual weigh-ins.
      </p>
    </div>
  )
}

/* ----------------------------------------------------------- week bars --- */

export function WeekBars({ rolls, metric }: {
  rolls: DayRollup[]
  metric: 'workoutMin' | 'tasks' | 'meals'
}) {
  const vals = rolls.map((r) => r[metric])
  const max = Math.max(...vals, 1)
  const today = todayISO()

  return (
    <div className="bar-chart">
      {rolls.map((r) => {
        const v = r[metric]
        const h = v > 0 ? Math.max(6, (v / max) * 100) : 3
        return (
          <div className="bar-chart__col" key={r.date}>
            <div className="bar-chart__track">
              <div
                className="bar-chart__bar"
                data-empty={v === 0}
                style={{ height: `${h}%`, opacity: r.date === today ? 1 : 0.82 }}
                title={`${weekdayInitial(r.date)}: ${v}`}
              />
            </div>
            <span className="bar-chart__lbl" style={{ color: r.date === today ? 'var(--primary)' : undefined }}>
              {weekdayInitial(r.date)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------- week strip --- */

export function WeekStrip({ rolls, selected, onSelect }: {
  rolls: DayRollup[]
  selected?: string
  onSelect?: (date: string) => void
}) {
  const today = todayISO()
  return (
    <div className="weekstrip">
      {rolls.map((r) => {
        const future = r.date > today
        return (
          <button
            key={r.date}
            className="weekday"
            data-sel={r.date === selected}
            data-today={r.date === today}
            disabled={future || !onSelect}
            onClick={() => onSelect?.(r.date)}
            aria-label={r.date}
            style={future ? { opacity: 0.35 } : undefined}
          >
            <span className="weekday__d">{weekdayInitial(r.date)}</span>
            <span className="weekday__n">{fromISO(r.date).getDate()}</span>
            <span className="weekday__dots">
              {r.meals > 0 && <i style={{ background: 'var(--food)' }} />}
              {r.workouts > 0 && <i style={{ background: 'var(--workout)' }} />}
              {r.tasks > 0 && <i style={{ background: 'var(--task)' }} />}
              {r.mood != null && <i style={{ background: 'var(--day)' }} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------ progress --- */

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress__fill" data-done={pct >= 100} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}
