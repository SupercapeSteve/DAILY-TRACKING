import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import * as api from '../../lib/api'
import { friendlyDate, todayISO } from '../../lib/dates'
import { navigate } from '../../lib/router'
import type { JournalEntry } from '../../lib/types'
import {
  Banner, Button, Card, Confirm, Empty, Icon, Spinner, Textarea, toast,
} from '../../components/ui'

export default function Journal() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<JournalEntry | null>(null)

  const today = todayISO()

  const load = useCallback(async () => {
    if (!user) return
    try {
      const list = await api.listJournal(user.id)
      setEntries(list)
      setDraft(list.find((e) => e.log_date === today)?.body ?? '')
    } finally { setLoading(false) }
  }, [user, today])

  useEffect(() => { void load() }, [load])

  if (!user) return <Spinner full />

  async function save() {
    setSaving(true)
    try {
      await api.upsertJournal(user!.id, today, draft)
      toast('Saved')
      await load()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save', true) }
    finally { setSaving(false) }
  }

  const past = entries.filter((e) => e.log_date !== today && e.body.trim())

  return (
    <div className="screen stack-l">
      <div className="row">
        <button className="icon-btn" aria-label="Back" onClick={() => navigate('settings')}>
          <Icon name="back" size={22} />
        </button>
        <div className="grow">
          <h1 style={{ fontSize: 24 }}>My journal</h1>
        </div>
      </div>

      <Banner icon="lock">
        This is yours alone. It is never shared, there is no switch to share it,
        and your partner's app has no way to reach it.
      </Banner>

      <Card className="stack-s">
        <p className="bold">{friendlyDate(today)}</p>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Anything you want to get out of your head..."
          style={{ minHeight: 180 }}
          maxLength={20000}
        />
        <Button variant="primary" block busy={saving} onClick={save}>Save</Button>
      </Card>

      {loading ? (
        <div className="row" style={{ justifyContent: 'center' }}><Spinner /></div>
      ) : past.length === 0 ? (
        <Empty icon="book" title="Nothing earlier yet" />
      ) : (
        <div className="stack-s">
          <p className="section-label">Earlier</p>
          {past.map((e) => (
            <Card key={e.id} className="stack-s">
              <div className="row-between">
                <span className="bold small">{friendlyDate(e.log_date)}</span>
                <button className="icon-btn" aria-label="Delete entry"
                  onClick={() => setRemoving(e)}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
              <p className="pre-wrap small">{e.body}</p>
            </Card>
          ))}
        </div>
      )}

      <Confirm
        open={Boolean(removing)}
        title="Delete this entry?"
        body="This cannot be undone."
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          try { await api.deleteJournal(removing.id); await load(); toast('Deleted') }
          catch { toast('Could not delete', true) }
          setRemoving(null)
        }}
      />
    </div>
  )
}
