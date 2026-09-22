import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import * as api from '../../lib/api'
import { navigate } from '../../lib/router'
import type { BodyProfile, ShareKey, Units } from '../../lib/types'
import {
  ftInToCm, cmToFtIn, weightInputToKg, kgToWeightInput, weightUnitLabel, ageFrom,
} from '../../lib/units'
import { todayISO } from '../../lib/dates'
import {
  Banner, Button, Card, Confirm, Field, Icon, Input, Sheet, Spinner, SwitchRow, toast,
} from '../../components/ui'

const SHARE_ITEMS: { key: ShareKey; title: string; desc: string; icon: 'food' | 'workout' | 'task' | 'day' | 'scale' | 'target' }[] = [
  { key: 'share_food',     title: 'Meals',             desc: 'What you ate each day' ,              icon: 'food' },
  { key: 'share_workouts', title: 'Workouts',          desc: 'What you did and for how long',       icon: 'workout' },
  { key: 'share_tasks',    title: 'Tasks',             desc: 'Things you got done',                 icon: 'task' },
  { key: 'share_day',      title: 'How your day went', desc: 'Mood, sleep, water and your note',    icon: 'day' },
  { key: 'share_goals',    title: 'Your goals',        desc: 'The targets you set for yourself',    icon: 'target' },
  { key: 'share_body',     title: 'Body basics',       desc: 'Age, height and weight',              icon: 'scale' },
]

export default function Settings() {
  const { user, profile, link, share, setShareLocal, refresh, signOut } = useAuth()
  const units: Units = profile?.units ?? 'imperial'

  const [body, setBody] = useState<BodyProfile | null>(null)
  const [weightNow, setWeightNow] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const [nameSheet, setNameSheet] = useState(false)
  const [name, setName] = useState(profile?.display_name ?? '')
  const [bodySheet, setBodySheet] = useState(false)
  const [signOutAsk, setSignOutAsk] = useState(false)
  const [unlinkAsk, setUnlinkAsk] = useState(false)
  const [codeSheet, setCodeSheet] = useState(false)
  const [code, setCode] = useState('')
  const [codeErr, setCodeErr] = useState('')

  // body sheet fields
  const [birthdate, setBirthdate] = useState('')
  const [ft, setFt] = useState(''); const [inch, setInch] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [goalWeight, setGoalWeight] = useState('')
  const [curWeight, setCurWeight] = useState('')

  useEffect(() => {
    if (!user) return
    let alive = true
    Promise.all([
      api.getBodyProfile(user.id).catch(() => null),
      api.listWeights(user.id).catch(() => []),
    ]).then(([b, w]) => {
      if (!alive) return
      setBody(b)
      setWeightNow(w.length ? Number(w[w.length - 1]!.weight_kg) : null)
      setLoading(false)
    })
    return () => { alive = false }
  }, [user])

  useEffect(() => { setName(profile?.display_name ?? '') }, [profile?.display_name])

  if (!user) return <Spinner full />

  const connected = Boolean(link?.partner_id)
  const paused = share?.sharing_paused ?? false
  const activeKeys = SHARE_ITEMS.filter((s) => share?.[s.key])

  async function toggleShare(key: ShareKey, value: boolean) {
    if (!share) return
    const next = { ...share, [key]: value }
    setShareLocal(next)                         // instant feedback
    try {
      await api.updateShareSettings(user!.id, { [key]: value })
    } catch (e) {
      setShareLocal(share)                      // roll back on failure
      toast(e instanceof Error ? e.message : 'Could not save', true)
    }
  }

  async function togglePause(value: boolean) {
    if (!share) return
    const next = { ...share, sharing_paused: value }
    setShareLocal(next)
    try {
      await api.updateShareSettings(user!.id, { sharing_paused: value })
      toast(value ? 'Sharing paused' : 'Sharing resumed')
    } catch (e) {
      setShareLocal(share)
      toast(e instanceof Error ? e.message : 'Could not save', true)
    }
  }

  function openBodySheet() {
    setBirthdate(body?.birthdate ?? '')
    if (units === 'metric') setHeightCm(body?.height_cm?.toString() ?? '')
    else {
      const { ft: f, inch: i } = cmToFtIn(body?.height_cm ?? null)
      setFt(f?.toString() ?? ''); setInch(i?.toString() ?? '')
    }
    setGoalWeight(kgToWeightInput(body?.goal_weight_kg ?? null, units)?.toString() ?? '')
    setCurWeight(kgToWeightInput(weightNow, units)?.toString() ?? '')
    setBodySheet(true)
  }

  async function saveBody() {
    try {
      const cm = units === 'metric'
        ? (heightCm ? Number(heightCm) : null)
        : ftInToCm(ft ? Number(ft) : null, inch ? Number(inch) : null)

      const b = await api.upsertBodyProfile(user!.id, {
        birthdate: birthdate || null,
        height_cm: cm,
        goal_weight_kg: weightInputToKg(goalWeight ? Number(goalWeight) : null, units),
      })
      setBody(b)

      const kg = weightInputToKg(curWeight ? Number(curWeight) : null, units)
      if (kg && kg !== weightNow) {
        await api.upsertWeight(user!.id, todayISO(), kg)
        setWeightNow(kg)
      }
      setBodySheet(false)
      toast('Saved')
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save', true) }
  }

  async function saveName() {
    if (!name.trim()) return
    try {
      await api.upsertProfile({ id: user!.id, display_name: name.trim() })
      await refresh()
      setNameSheet(false)
      toast('Saved')
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save', true) }
  }

  async function switchUnits(u: Units) {
    try {
      await api.upsertProfile({ id: user!.id, units: u })
      await refresh()
    } catch { toast('Could not change units', true) }
  }

  const age = ageFrom(body?.birthdate)

  return (
    <div className="screen stack-l">
      <h1 className="page-title">Settings</h1>

      {/* ================================================== SHARING ======= */}
      <div className="stack-s">
        <p className="section-label">What your partner can see</p>

        {!connected ? (
          <Card className="stack">
            <div className="row">
              <span className="dot" style={{ background: 'var(--task)' }}><Icon name="link" size={20} /></span>
              <div className="grow">
                <p className="bold">Invite your partner</p>
                <p className="small muted">Send them this code so they can follow along.</p>
              </div>
            </div>
            <div className="code">{link?.invite_code ?? '--------'}</div>
            <div className="row">
              <Button className="grow" icon="copy" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link?.invite_code ?? '')
                  toast('Code copied')
                } catch { toast('Press and hold the code to copy', true) }
              }}>Copy</Button>
              <Button className="grow" icon="send" onClick={async () => {
                const text = `Here is my code for the Daily app: ${link?.invite_code}`
                if (navigator.share) {
                  try { await navigator.share({ text }) } catch { /* cancelled */ }
                } else {
                  try { await navigator.clipboard.writeText(text); toast('Copied - paste it to them') }
                  catch { toast('Copy the code above', true) }
                }
              }}>Send</Button>
            </div>
            <button className="link-btn" style={{ alignSelf: 'center' }}
              onClick={() => { setCode(''); setCodeErr(''); setCodeSheet(true) }}>
              Wait - I was given a code instead
            </button>
          </Card>
        ) : (
          <>
            {/* the single biggest control: pause everything */}
            <Card className={paused ? 'card--accent' : ''}
              style={paused ? { borderLeftColor: 'var(--amber)' } : undefined}>
              <SwitchRow
                icon={paused ? 'pause' : 'eye'}
                title={paused ? 'Sharing is paused' : 'Pause all sharing'}
                desc={paused
                  ? 'Your partner sees nothing at all right now. Your entries are still saved.'
                  : 'Instantly hides everything, without changing your choices below.'}
                on={paused}
                onChange={togglePause}
              />
            </Card>

            <Card style={{ padding: '2px 14px', opacity: paused ? 0.5 : 1 }}>
              {SHARE_ITEMS.map((s) => (
                <SwitchRow
                  key={s.key}
                  icon={s.icon}
                  title={s.title}
                  desc={s.desc}
                  on={Boolean(share?.[s.key])}
                  disabled={paused}
                  onChange={(v) => toggleShare(s.key, v)}
                />
              ))}
            </Card>

            <Card className="card--tint stack-s">
              <p className="bold small">
                <Icon name="eye" size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                Right now your partner sees:
              </p>
              {paused ? (
                <p className="small muted">Nothing. Sharing is paused.</p>
              ) : activeKeys.length === 0 ? (
                <p className="small muted">Nothing yet. Turn something on above.</p>
              ) : (
                <p className="small muted">
                  {activeKeys.map((s) => s.title).join(', ')}.
                  {' '}Entries you marked <strong>Just for me</strong> stay hidden, and your
                  journal is never included.
                </p>
              )}
            </Card>

            <Button variant="quiet" block onClick={() => setUnlinkAsk(true)}>
              Disconnect my partner
            </Button>
          </>
        )}
      </div>

      {/* ================================================== JOURNAL ======= */}
      <div className="stack-s">
        <p className="section-label">Private</p>
        <Card style={{ padding: 0 }}>
          <button className="entry" style={{ padding: 16 }} onClick={() => navigate('journal')}>
            <span className="dot" style={{ background: 'var(--violet)' }}><Icon name="book" size={20} /></span>
            <span className="grow">
              <span className="bold" style={{ display: 'block' }}>My journal</span>
              <span className="small muted">Never shared with anyone. Not even a toggle for it.</span>
            </span>
            <Icon name="next" size={20} />
          </button>
        </Card>
      </div>

      {/* ==================================================== ABOUT ======= */}
      <div className="stack-s">
        <p className="section-label">About you</p>
        <Card style={{ padding: 0 }}>
          <button className="entry" style={{ padding: 16 }} onClick={() => setNameSheet(true)}>
            <span className="grow">
              <span className="small muted" style={{ display: 'block' }}>Name</span>
              <span className="bold">{profile?.display_name || 'Not set'}</span>
            </span>
            <Icon name="edit" size={18} />
          </button>
          <button className="entry" style={{ padding: 16 }} onClick={openBodySheet}>
            <span className="grow">
              <span className="small muted" style={{ display: 'block' }}>Body basics</span>
              <span className="bold">
                {loading ? '...' : [
                  age != null ? `${age} yrs` : null,
                  body?.height_cm ? (units === 'metric'
                    ? `${Math.round(body.height_cm)} cm`
                    : `${cmToFtIn(body.height_cm).ft}'${cmToFtIn(body.height_cm).inch}"`) : null,
                  weightNow != null ? `${kgToWeightInput(weightNow, units)} ${weightUnitLabel(units)}` : null,
                ].filter(Boolean).join(' · ') || 'Not set'}
              </span>
            </span>
            <Icon name="edit" size={18} />
          </button>
        </Card>

        <Card className="stack-s">
          <p className="label">Units</p>
          <div className="seg">
            <button className="seg__btn" data-on={units === 'imperial'}
              onClick={() => switchUnits('imperial')}>lb / ft</button>
            <button className="seg__btn" data-on={units === 'metric'}
              onClick={() => switchUnits('metric')}>kg / cm</button>
          </div>
          <p className="tiny mute-2">Changing this only changes how numbers are shown.</p>
        </Card>
      </div>

      {/* =================================================== ACCOUNT ====== */}
      <div className="stack-s">
        <p className="section-label">Account</p>
        <Card className="stack-s">
          <p className="small muted">Signed in as</p>
          <p className="bold truncate">{user.email}</p>
        </Card>
        <Button variant="quiet" block icon="logout" onClick={() => setSignOutAsk(true)}>
          Sign out
        </Button>
        <p className="tiny mute-2 center">
          You do not need to sign out. Staying signed in is what keeps this a one-tap app.
        </p>
      </div>

      {/* ==================================================== sheets ====== */}
      <Sheet open={codeSheet} onClose={() => setCodeSheet(false)} title="Enter their code">
        <div className="stack">
          <p className="muted small">
            If you are the one supporting someone else, enter their 8-character code
            here. This switches your account over to the supporter view.
          </p>
          <Input
            className="input--lg"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeErr('') }}
            placeholder="ABCD2345"
            autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            maxLength={12}
            style={{ letterSpacing: '.18em', fontFamily: 'ui-monospace, Menlo, monospace' }}
          />
          {codeErr && <Banner kind="error">{codeErr}</Banner>}
          <Button variant="primary" size="lg" block disabled={code.trim().length < 6}
            onClick={async () => {
              setCodeErr('')
              try {
                await api.redeemInvite(code)
                await refresh()
                setCodeSheet(false)
                toast('Connected')
              } catch (e) {
                setCodeErr(e instanceof Error ? e.message : 'That code did not work.')
              }
            }}>Connect</Button>
        </div>
      </Sheet>

      <Sheet open={nameSheet} onClose={() => setNameSheet(false)} title="Your name">
        <div className="stack">
          <Field label="First name">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={40} />
          </Field>
          <Button variant="primary" size="lg" block onClick={saveName}>Save</Button>
        </div>
      </Sheet>

      <Sheet open={bodySheet} onClose={() => setBodySheet(false)} title="Body basics">
        <div className="stack">
          <Banner icon="lock">
            These are only visible to your partner if <strong>Body basics</strong> is
            switched on above.
          </Banner>

          <Field label="Date of birth">
            <Input type="date" value={birthdate} max={todayISO()}
              onChange={(e) => setBirthdate(e.target.value)} />
          </Field>

          <Field label="Height">
            {units === 'metric' ? (
              <Input type="number" inputMode="numeric" placeholder="cm" value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)} min={80} max={250} />
            ) : (
              <div className="row">
                <Input type="number" inputMode="numeric" placeholder="ft" value={ft}
                  onChange={(e) => setFt(e.target.value)} min={3} max={8} />
                <Input type="number" inputMode="numeric" placeholder="in" value={inch}
                  onChange={(e) => setInch(e.target.value)} min={0} max={11} />
              </div>
            )}
          </Field>

          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <Field label={`Current (${weightUnitLabel(units)})`}>
                <Input type="number" inputMode="decimal" step="0.1" value={curWeight}
                  onChange={(e) => setCurWeight(e.target.value)} />
              </Field>
            </div>
            <div className="grow">
              <Field label={`Goal (${weightUnitLabel(units)})`}>
                <Input type="number" inputMode="decimal" step="0.1" value={goalWeight}
                  onChange={(e) => setGoalWeight(e.target.value)} />
              </Field>
            </div>
          </div>

          <Button variant="primary" size="lg" block onClick={saveBody}>Save</Button>
        </div>
      </Sheet>

      <Confirm
        open={signOutAsk}
        title="Sign out?"
        body="You will need your email and password to get back in."
        confirmLabel="Sign out"
        onCancel={() => setSignOutAsk(false)}
        onConfirm={() => { void signOut() }}
      />

      <Confirm
        open={unlinkAsk}
        title="Disconnect your partner?"
        body="They lose access immediately and a brand new code is created. Nothing you logged is deleted."
        confirmLabel="Disconnect"
        onCancel={() => setUnlinkAsk(false)}
        onConfirm={async () => {
          if (!link) return
          try {
            await api.unlinkPartner(link.id)
            await refresh()
            toast('Partner disconnected')
          } catch (e) { toast(e instanceof Error ? e.message : 'Could not disconnect', true) }
          setUnlinkAsk(false)
        }}
      />
    </div>
  )
}
