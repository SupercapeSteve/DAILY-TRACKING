import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { navigate } from '../../lib/router'
import {
  ACCENTS, CATEGORY_COLORS, DEFAULT_PREFS, FONTS, applyTheme,
  type AppearancePrefs, type CardStyle, type Contrast, type Corners,
  type Density, type FontChoice, type TextSize, type ThemeMode, type Tint,
} from '../../lib/theme'
import {
  Banner, Button, Card, Chip, Confirm, Field, Icon, Input, SwitchRow, toast,
} from '../../components/ui'

/** A row of mutually exclusive chips, which is most of this screen. */
function Choice<T extends string>({ label, hint, value, options, onChange }: {
  label: string
  hint?: string
  value: T
  options: { v: T; label: string; style?: React.CSSProperties }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="stack-s">
      <span className="label">{label}</span>
      <div className="wrap">
        {options.map((o) => (
          <Chip key={o.v} on={value === o.v} style={o.style} onClick={() => onChange(o.v)}>
            {o.label}
          </Chip>
        ))}
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

function Swatches({ label, value, options, onChange }: {
  label: string
  value: string
  options: { name: string; hex: string }[]
  onChange: (hex: string) => void
}) {
  const isPreset = options.some((o) => o.hex.toLowerCase() === value.toLowerCase())
  return (
    <div className="stack-s">
      <span className="label">{label}</span>
      <div className="swatches">
        {options.map((o) => {
          const on = o.hex.toLowerCase() === value.toLowerCase()
          return (
            <button
              key={o.hex}
              type="button"
              className="swatch"
              data-on={on}
              style={{ background: o.hex }}
              aria-label={o.name}
              aria-pressed={on}
              onClick={() => onChange(o.hex)}
            >
              {on && <Icon name="check" size={20} style={{ color: '#fff' }} />}
            </button>
          )
        })}

        {/* any colour at all, via the device's own picker */}
        <span className="swatch swatch--custom" data-on={!isPreset} title="Any colour">
          <input
            type="color"
            value={value}
            aria-label={`${label} - pick any colour`}
            onChange={(e) => onChange(e.target.value)}
          />
          {!isPreset && (
            <span
              style={{
                position: 'absolute', inset: 4, borderRadius: '50%',
                background: value, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="check" size={18} style={{ color: '#fff' }} />
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

export default function Appearance() {
  const { prefs, savePrefs } = useAuth()
  const [draft, setDraft] = useState<AppearancePrefs>(prefs)
  const [resetAsk, setResetAsk] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // Keep in step if the account's look arrives (or changes) while we're here.
  useEffect(() => { setDraft(prefs) }, [prefs])

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  /**
   * Apply instantly so every tap is visible straight away, but debounce the
   * save so rapid changes are one write instead of ten.
   */
  function change(patch: Partial<AppearancePrefs>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    applyTheme(next)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      savePrefs(next).catch((e) =>
        toast(e instanceof Error ? e.message : 'Could not save your look', true))
    }, 500)
  }

  function resetAll() {
    setResetAsk(false)
    const next = { ...DEFAULT_PREFS }
    setDraft(next)
    applyTheme(next)
    savePrefs(next)
      .then(() => toast('Back to the original look'))
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not save', true))
  }

  return (
    <div className="screen screen--narrow stack-l">
      <div className="row">
        <button className="icon-btn" aria-label="Back" onClick={() => navigate('settings')}>
          <Icon name="back" size={22} />
        </button>
        <div className="grow">
          <h1 style={{ fontSize: 'calc(24px * var(--fs))' }}>Appearance</h1>
        </div>
      </div>

      <Banner icon="sparkle">
        Everything here saves to your account, so it follows you to any phone or
        computer you sign in on.
      </Banner>

      {/* ------------------------------------------------------- preview -- */}
      <div className="stack-s">
        <p className="section-label">Preview</p>
        <div className="preview">
          <div className="row">
            <span className="dot dot--workout"><Icon name="workout" size={20} /></span>
            <span className="grow">
              <span className="bold" style={{ display: 'block' }}>Legs</span>
              <span className="meta"><span>55 min</span><span>hard</span></span>
            </span>
          </div>
          <div className="wrap">
            <Chip on>Breakfast</Chip>
            <Chip>Lunch</Chip>
          </div>
          <Button variant="primary" block>Add workout</Button>
        </div>
      </div>

      {/* --------------------------------------------------------- colour -- */}
      <div className="stack-l">
        <p className="section-label">Colour</p>

        <Choice<ThemeMode>
          label="Light or dark"
          value={draft.theme}
          onChange={(theme) => change({ theme })}
          options={[
            { v: 'system', label: 'Match device' },
            { v: 'light', label: 'Light' },
            { v: 'dark', label: 'Dark' },
          ]}
        />

        <Swatches
          label="Accent colour"
          value={draft.accent}
          options={ACCENTS}
          onChange={(accent) => change({ accent })}
        />

        <Choice<Tint>
          label="Background"
          hint="The overall warmth of the greys behind everything."
          value={draft.tint}
          onChange={(tint) => change({ tint })}
          options={[
            { v: 'warm', label: 'Warm' },
            { v: 'neutral', label: 'Neutral' },
            { v: 'cool', label: 'Cool' },
          ]}
        />
      </div>

      {/* ----------------------------------------------------------- type -- */}
      <div className="stack-l">
        <p className="section-label">Text</p>

        <Choice<TextSize>
          label="Text size"
          value={draft.textSize}
          onChange={(textSize) => change({ textSize })}
          options={[
            { v: 'small', label: 'Small' },
            { v: 'default', label: 'Default' },
            { v: 'large', label: 'Large' },
            { v: 'xlarge', label: 'Largest' },
          ]}
        />

        <Choice<FontChoice>
          label="Font"
          value={draft.font}
          onChange={(font) => change({ font })}
          options={(Object.keys(FONTS) as FontChoice[]).map((k) => ({
            v: k,
            label: FONTS[k].label,
            style: { fontFamily: FONTS[k].stack },
          }))}
        />

        <Card className="card--tint">
          <p className="font-sample">
            The quick brown fox jumped over the lazy dog, then logged 55 minutes
            at the gym and felt pretty good about it.
          </p>
        </Card>
      </div>

      {/* ---------------------------------------------------------- shape -- */}
      <div className="stack-l">
        <p className="section-label">Shape &amp; spacing</p>

        <Choice<Corners>
          label="Corners"
          value={draft.corners}
          onChange={(corners) => change({ corners })}
          options={[
            { v: 'sharp', label: 'Sharp' },
            { v: 'soft', label: 'Soft' },
            { v: 'round', label: 'Round' },
          ]}
        />

        <Choice<Density>
          label="Spacing"
          hint="How tightly everything is packed together."
          value={draft.density}
          onChange={(density) => change({ density })}
          options={[
            { v: 'compact', label: 'Compact' },
            { v: 'comfortable', label: 'Comfortable' },
            { v: 'spacious', label: 'Spacious' },
          ]}
        />

        <Choice<CardStyle>
          label="Cards"
          value={draft.cardStyle}
          onChange={(cardStyle) => change({ cardStyle })}
          options={[
            { v: 'elevated', label: 'Raised' },
            { v: 'flat', label: 'Flat' },
            { v: 'outlined', label: 'Outlined' },
          ]}
        />
      </div>

      {/* ------------------------------------------------------ categories -- */}
      <div className="stack-l">
        <p className="section-label">Category colours</p>
        <Swatches label="Meals" value={draft.catFood}
          options={CATEGORY_COLORS} onChange={(catFood) => change({ catFood })} />
        <Swatches label="Workouts" value={draft.catWorkout}
          options={CATEGORY_COLORS} onChange={(catWorkout) => change({ catWorkout })} />
        <Swatches label="Tasks" value={draft.catTask}
          options={CATEGORY_COLORS} onChange={(catTask) => change({ catTask })} />
        <Swatches label="How your day went" value={draft.catDay}
          options={CATEGORY_COLORS} onChange={(catDay) => change({ catDay })} />
      </div>

      {/* --------------------------------------------------------- extras -- */}
      <div className="stack-s">
        <p className="section-label">Other</p>

        <Card style={{ padding: '2px 14px' }}>
          <SwitchRow
            icon="eye"
            title="Higher contrast"
            desc="Stronger text and borders, easier to read in bright light."
            on={draft.contrast === 'high'}
            onChange={(v) => change({ contrast: (v ? 'high' : 'normal') as Contrast })}
          />
          <SwitchRow
            icon="sparkle"
            title="Reduce motion"
            desc="Turns off the sliding and fading animations."
            on={draft.motion === 'reduced'}
            onChange={(v) => change({ motion: v ? 'reduced' : 'full' })}
          />
        </Card>

        <Card>
          <Field label="What this app is called" hint="Shows in the tab title and on the sign-in screen.">
            <Input
              value={draft.appName}
              maxLength={24}
              placeholder="Daily"
              onChange={(e) => change({ appName: e.target.value })}
              onBlur={() => { if (!draft.appName.trim()) change({ appName: DEFAULT_PREFS.appName }) }}
            />
          </Field>
        </Card>
      </div>

      <Button variant="quiet" block icon="back" onClick={() => setResetAsk(true)}>
        Reset everything to the original look
      </Button>

      <Confirm
        open={resetAsk}
        title="Reset the look?"
        body="Every appearance choice goes back to how it started. Nothing you have logged is affected."
        confirmLabel="Reset"
        onCancel={() => setResetAsk(false)}
        onConfirm={resetAll}
      />
    </div>
  )
}
