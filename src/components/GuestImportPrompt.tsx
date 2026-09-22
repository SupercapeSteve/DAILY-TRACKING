import { useState } from 'react'
import { useAuth } from '../lib/auth'
import * as guest from '../lib/guest'
import { importGuestData } from '../lib/guestImport'
import { Button, Icon, Sheet, toast } from './ui'

const ASKED_KEY = 'daily-guest-import-asked'

function markAsked() {
  try { sessionStorage.setItem(ASKED_KEY, '1') } catch { /* fine */ }
}
function alreadyAsked(): boolean {
  try { return sessionStorage.getItem(ASKED_KEY) === '1' } catch { return false }
}

/**
 * Offered once per session after signing in, when there is something logged
 * from before the account existed.
 *
 * "Not now" never deletes anything - the local copy stays put and the offer
 * returns next time. Nothing a person logged should disappear because they
 * tapped the wrong button while half awake.
 */
export default function GuestImportPrompt() {
  const { user, isGuest, refresh } = useAuth()
  const [dismissed, setDismissed] = useState(alreadyAsked)
  const [busy, setBusy] = useState(false)

  const counts = guest.counts()
  const show = Boolean(user) && !isGuest && counts.total > 0 && !dismissed
  if (!show) return null

  async function bringOver() {
    if (!user) return
    setBusy(true)
    try {
      const res = await importGuestData(user.id)
      markAsked()
      setDismissed(true)
      await refresh()
      toast(`Added ${res.entries + res.days} ${res.entries + res.days === 1 ? 'thing' : 'things'}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not bring it over', true)
    } finally {
      setBusy(false)
    }
  }

  function notNow() {
    markAsked()
    setDismissed(true)
  }

  return (
    <Sheet open onClose={notNow} title="Bring your log with you?">
      <div className="stack">
        <div className="row">
          <span className="dot" style={{ background: 'var(--primary)' }}>
            <Icon name="sparkle" size={20} />
          </span>
          <div className="grow">
            <p className="bold">
              {counts.total} {counts.total === 1 ? 'thing' : 'things'} from before you signed up
            </p>
            <p className="small muted">
              {counts.entries} logged {counts.entries === 1 ? 'entry' : 'entries'}
              {counts.days > 0 && <> and {counts.days} {counts.days === 1 ? 'day' : 'days'} of check-ins</>}
              {' '}are still saved in this browser.
            </p>
          </div>
        </div>

        <Button variant="primary" size="lg" block busy={busy} onClick={bringOver}>
          Add them to my account
        </Button>
        <Button variant="quiet" block disabled={busy} onClick={notNow}>
          Not now
        </Button>

        <p className="tiny mute-2 center">
          Nothing is deleted either way. If you skip this, the offer comes back
          next time you sign in.
        </p>
      </div>
    </Sheet>
  )
}
