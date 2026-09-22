import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { Button, Field, Icon, Input, Banner } from '../components/ui'

export default function Auth() {
  const { signIn, signUp, prefs } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(''); setNotice(''); setBusy(true)
    try {
      if (mode === 'in') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        // If the project requires email confirmation there is no session yet.
        // Say so plainly rather than leaving her on a dead screen.
        setNotice('Account created. If nothing happens in a moment, check your email for a confirmation link.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="brand">
        <div className="brand__mark"><Icon name="heart" size={40} /></div>
        <div>
          <h1>{prefs.appName}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Your day, your way - and you choose what gets shared.
          </p>
        </div>
      </div>

      <div className="seg" role="tablist">
        <button className="seg__btn" role="tab" data-on={mode === 'in'}
          onClick={() => { setMode('in'); setError('') }}>Sign in</button>
        <button className="seg__btn" role="tab" data-on={mode === 'up'}
          onClick={() => { setMode('up'); setError('') }}>Create account</button>
      </div>

      <form className="stack" onSubmit={submit}>
        <Field label="Email">
          <Input
            type="email" inputMode="email" autoComplete="email" required
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Password" hint={mode === 'up' ? 'At least 6 characters.' : undefined}>
          <div style={{ position: 'relative' }}>
            <Input
              type={showPw ? 'text' : 'password'}
              autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
              required minLength={6}
              placeholder={mode === 'up' ? 'Pick a password' : 'Your password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: 52 }}
            />
            <button
              type="button" className="icon-btn"
              style={{ position: 'absolute', right: 2, top: 0 }}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              onClick={() => setShowPw((v) => !v)}
            >
              <Icon name={showPw ? 'eyeOff' : 'eye'} size={20} />
            </button>
          </div>
        </Field>

        {error && <Banner kind="error">{error}</Banner>}
        {notice && <Banner kind="info">{notice}</Banner>}

        <Button type="submit" variant="primary" size="lg" block busy={busy}>
          {mode === 'in' ? 'Sign in' : 'Create my account'}
        </Button>
      </form>

      <Banner icon="lock">
        You stay signed in on this phone, so you should only ever have to do this once.
      </Banner>
    </div>
  )
}

/** Shown when the two environment variables were never filled in. */
export function NotConfigured() {
  return (
    <div className="auth-wrap">
      <div className="brand">
        <div className="brand__mark" style={{ background: 'linear-gradient(145deg,#e6b980,#c2833f)' }}>
          <Icon name="alert" size={38} />
        </div>
        <h1>Almost there</h1>
      </div>
      <Banner kind="warn">
        This app has not been connected to its database yet.
      </Banner>
      <div className="card stack-s">
        <p className="bold">If you are setting this up:</p>
        <p className="small muted">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> as environment
          variables where the site is hosted, then redeploy. Step-by-step instructions are in
          <strong> SETUP.md</strong> in the project folder.
        </p>
      </div>
    </div>
  )
}
