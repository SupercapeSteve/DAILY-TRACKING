import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import * as api from '../lib/api'
import {
  Banner, Button, Card, Field, Icon, Input, Spinner, SwitchRow, toast,
} from '../components/ui'
import type { ShareKey, Units } from '../lib/types'
import { ftInToCm, weightInputToKg, weightUnitLabel } from '../lib/units'
import { todayISO } from '../lib/dates'

type Step = 'role' | 'name' | 'basics' | 'sharing' | 'code' | 'done'

const SHARE_ITEMS: { key: ShareKey; title: string; desc: string; icon: 'food' | 'workout' | 'task' | 'day' | 'scale' | 'target'; preset: boolean }[] = [
  { key: 'share_food',     title: 'Meals',          desc: 'What you ate each day',              icon: 'food',    preset: true },
  { key: 'share_workouts', title: 'Workouts',       desc: 'What you did and for how long',      icon: 'workout', preset: true },
  { key: 'share_tasks',    title: 'Tasks',          desc: 'Things you got done',                icon: 'task',    preset: true },
  { key: 'share_day',      title: 'How your day went', desc: 'Your mood, sleep, water and note', icon: 'day',    preset: true },
  { key: 'share_goals',    title: 'Your goals',     desc: 'The targets you set for yourself',   icon: 'target',  preset: true },
  // The most personal one starts OFF. She opts in rather than opting out.
  { key: 'share_body',     title: 'Body basics',    desc: 'Age, height and weight',             icon: 'scale',   preset: false },
]

export default function Onboarding() {
  const { user, profile, refresh } = useAuth()
  const [step, setStep] = useState<Step>('role')
  const [busy, setBusy] = useState(false)

  const [role, setRole] = useState<'owner' | 'partner' | null>(null)
  const [name, setName] = useState(profile?.display_name ?? '')
  const [units, setUnits] = useState<Units>(profile?.units ?? 'imperial')

  const [birthdate, setBirthdate] = useState('')
  const [ft, setFt] = useState(''); const [inch, setInch] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weight, setWeight] = useState('')
  const [goalWeight, setGoalWeight] = useState('')

  const [shares, setShares] = useState<Record<ShareKey, boolean>>(
    () => Object.fromEntries(SHARE_ITEMS.map((s) => [s.key, s.preset])) as Record<ShareKey, boolean>,
  )

  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  // Keep the name box filled if a profile row already exists.
  useEffect(() => { if (profile?.display_name) setName(profile.display_name) }, [profile?.display_name])

  if (!user) return <Spinner full />

  async function pickRole(r: 'owner' | 'partner') {
    setRole(r)
    setStep('name')
  }

  async function saveName() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await api.upsertProfile({
        id: user!.id,
        display_name: name.trim(),
        role: role ?? 'owner',
        units,
        onboarded: false,
      })
      setStep(role === 'partner' ? 'code' : 'basics')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save that.', true)
    } finally { setBusy(false) }
  }

  async function saveBasics(skip = false) {
    setBusy(true)
    try {
      if (!skip) {
        const cm = units === 'metric'
          ? (heightCm ? Number(heightCm) : null)
          : ftInToCm(ft ? Number(ft) : null, inch ? Number(inch) : null)

        await api.upsertBodyProfile(user!.id, {
          birthdate: birthdate || null,
          height_cm: cm,
          goal_weight_kg: weightInputToKg(goalWeight ? Number(goalWeight) : null, units),
        })

        const kg = weightInputToKg(weight ? Number(weight) : null, units)
        if (kg) await api.upsertWeight(user!.id, todayISO(), kg)
      }
      setStep('sharing')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save that.', true)
    } finally { setBusy(false) }
  }

  async function saveSharing() {
    setBusy(true)
    try {
      await api.updateShareSettings(user!.id, { ...shares, sharing_paused: false })
      const link = await api.ensureLink(user!.id)
      setInviteCode(link.invite_code)
      await api.upsertProfile({ id: user!.id, onboarded: true })
      setStep('done')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save that.', true)
    } finally { setBusy(false) }
  }

  async function submitCode() {
    setCodeError(''); setBusy(true)
    try {
      await api.redeemInvite(code)
      await api.upsertProfile({ id: user!.id, onboarded: true })
      await refresh()
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : 'That code did not work.')
    } finally { setBusy(false) }
  }

  async function finish() {
    setBusy(true)
    await refresh()
    setBusy(false)
  }

  /* ------------------------------------------------------------ render -- */

  return (
    <div className="auth-wrap">
      {step === 'role' && (
        <>
          <div className="brand">
            <div className="brand__mark"><Icon name="heart" size={40} /></div>
            <div>
              <h1>Welcome</h1>
              <p className="muted" style={{ marginTop: 6 }}>First, which one are you?</p>
            </div>
          </div>

          <div className="stack">
            <Card className="stack-s" style={{ padding: 0 }}>
              <button className="entry" style={{ padding: 18 }} onClick={() => pickRole('owner')}>
                <span className="dot dot--workout"><Icon name="sparkle" size={20} /></span>
                <span className="grow">
                  <span className="bold" style={{ display: 'block', fontSize: 17 }}>
                    I'm tracking my progress
                  </span>
                  <span className="small muted">
                    You log your day. You decide what your partner can see.
                  </span>
                </span>
                <Icon name="next" size={20} />
              </button>
            </Card>

            <Card style={{ padding: 0 }}>
              <button className="entry" style={{ padding: 18 }} onClick={() => pickRole('partner')}>
                <span className="dot dot--task"><Icon name="heart" size={20} /></span>
                <span className="grow">
                  <span className="bold" style={{ display: 'block', fontSize: 17 }}>
                    I'm here to support someone
                  </span>
                  <span className="small muted">
                    You'll need the code from their app.
                  </span>
                </span>
                <Icon name="next" size={20} />
              </button>
            </Card>
          </div>
        </>
      )}

      {step === 'name' && (
        <>
          <h1>What should we call you?</h1>
          <div className="stack">
            <Field label="Your first name">
              <Input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sam" autoComplete="given-name" autoFocus maxLength={40}
              />
            </Field>

            {role === 'owner' && (
              <Field label="Units">
                <div className="seg">
                  <button className="seg__btn" data-on={units === 'imperial'}
                    onClick={() => setUnits('imperial')} type="button">lb / ft</button>
                  <button className="seg__btn" data-on={units === 'metric'}
                    onClick={() => setUnits('metric')} type="button">kg / cm</button>
                </div>
              </Field>
            )}

            <Button variant="primary" size="lg" block busy={busy}
              disabled={!name.trim()} onClick={saveName}>Continue</Button>
          </div>
        </>
      )}

      {step === 'basics' && (
        <>
          <h1>A few basics</h1>
          <p className="muted">All optional, and only you see these unless you choose to share them.</p>

          <div className="stack">
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
                <Field label={`Current weight (${weightUnitLabel(units)})`}>
                  <Input type="number" inputMode="decimal" value={weight}
                    onChange={(e) => setWeight(e.target.value)} step="0.1" />
                </Field>
              </div>
              <div className="grow">
                <Field label={`Goal (${weightUnitLabel(units)})`}>
                  <Input type="number" inputMode="decimal" value={goalWeight}
                    onChange={(e) => setGoalWeight(e.target.value)} step="0.1" />
                </Field>
              </div>
            </div>

            <Button variant="primary" size="lg" block busy={busy}
              onClick={() => saveBasics(false)}>Continue</Button>
            <Button variant="quiet" block onClick={() => saveBasics(true)}>Skip for now</Button>
          </div>
        </>
      )}

      {step === 'sharing' && (
        <>
          <h1>What do you want to share?</h1>
          <p className="muted">
            Everything starts private. Turn on only what you want your partner to see -
            and change it any time in Settings.
          </p>

          <Card style={{ padding: '2px 14px' }}>
            {SHARE_ITEMS.map((s) => (
              <SwitchRow
                key={s.key}
                icon={s.icon}
                title={s.title}
                desc={s.desc}
                on={shares[s.key]}
                onChange={(v) => setShares((cur) => ({ ...cur, [s.key]: v }))}
              />
            ))}
          </Card>

          <Banner icon="lock">
            Your private journal is never shared, and you can hide any single entry
            as you write it.
          </Banner>

          <Button variant="primary" size="lg" block busy={busy} onClick={saveSharing}>
            Save and continue
          </Button>
        </>
      )}

      {step === 'code' && (
        <>
          <h1>Enter their code</h1>
          <p className="muted">
            Ask them to open Settings in their app - the 8-character code is right at the top.
          </p>

          <div className="stack">
            <Input
              className="input--lg"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeError('') }}
              placeholder="ABCD2345"
              autoCapitalize="characters" autoCorrect="off" spellCheck={false}
              maxLength={12} autoFocus
              style={{ letterSpacing: '.18em', fontFamily: 'ui-monospace, Menlo, monospace' }}
            />
            {codeError && <Banner kind="error">{codeError}</Banner>}
            <Button variant="primary" size="lg" block busy={busy}
              disabled={code.trim().length < 6} onClick={submitCode}>Connect</Button>
          </div>

          <Banner>
            You will only ever see what they choose to share, and they can change
            or pause that at any time.
          </Banner>
        </>
      )}

      {step === 'done' && (
        <>
          <div className="brand">
            <div className="brand__mark"><Icon name="check" size={40} /></div>
            <h1>You're all set</h1>
          </div>

          <Card className="stack">
            <p className="bold center">Your partner's code</p>
            <div className="code">{inviteCode}</div>
            <p className="small muted center">
              Send this to your partner so they can follow along. You can find it
              again any time in Settings.
            </p>
            <Button icon="copy" block onClick={async () => {
              try {
                await navigator.clipboard.writeText(inviteCode)
                toast('Code copied')
              } catch { toast('Press and hold the code to copy it', true) }
            }}>Copy code</Button>
          </Card>

          <Button variant="primary" size="lg" block busy={busy} onClick={finish}>
            Start my first day
          </Button>
        </>
      )}
    </div>
  )
}
