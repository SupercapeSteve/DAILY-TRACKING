import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import * as api from '../../lib/api'
import { relativeTime } from '../../lib/dates'
import type { Feedback } from '../../lib/types'
import { Button, Card, Confirm, Empty, Icon, Spinner, toast } from '../../components/ui'

export default function Notes() {
  const { user, link } = useAuth()
  const [notes, setNotes] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<Feedback | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    try { setNotes(await api.listFeedback(user.id)) }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { void load() }, [load])

  if (!user) return <Spinner full />

  async function react(n: Feedback) {
    const next = n.reaction === 'heart' ? null : 'heart'
    try {
      await api.reactToFeedback(n.id, next)
      setNotes((cur) => cur.map((x) => (x.id === n.id ? { ...x, reaction: next } : x)))
    } catch { toast('Could not save that', true) }
  }

  return (
    <div className="screen stack-l">
      <div>
        <h1 className="page-title">Notes for you</h1>
        <p className="muted small">Encouragement from your partner.</p>
      </div>

      {loading ? (
        <div className="row" style={{ justifyContent: 'center', padding: 24 }}><Spinner /></div>
      ) : !link?.partner_id ? (
        <Card className="card--flat">
          <Empty icon="link" title="No one is connected yet"
            hint="Share your code from Settings and their notes will show up here." />
        </Card>
      ) : notes.length === 0 ? (
        <Card className="card--flat">
          <Empty icon="message" title="No notes yet"
            hint="When your partner sends you a note, it lands here." />
        </Card>
      ) : (
        <div className="stack-s">
          {notes.map((n) => (
            <div key={n.id} className="note stack-s">
              <p className="pre-wrap">{n.body}</p>
              <div className="row-between">
                <span className="tiny mute-2">{relativeTime(n.created_at)}</span>
                <div className="row" style={{ gap: 2 }}>
                  <button
                    className="icon-btn"
                    aria-label={n.reaction === 'heart' ? 'Remove heart' : 'Heart this'}
                    onClick={() => react(n)}
                    style={{ color: n.reaction === 'heart' ? 'var(--blush)' : undefined }}
                  >
                    <Icon name="heart" size={20}
                      style={{ fill: n.reaction === 'heart' ? 'var(--blush)' : 'none' }} />
                  </button>
                  <button className="icon-btn" aria-label="Delete note"
                    onClick={() => setRemoving(n)}>
                    <Icon name="trash" size={19} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <p className="tiny mute-2 center">
          You can delete any note here. It disappears for both of you.
        </p>
      )}

      {link?.partner_id && notes.length === 0 && !loading && (
        <Button variant="ghost" block icon="message" onClick={() => void load()}>
          Check for new notes
        </Button>
      )}

      <Confirm
        open={Boolean(removing)}
        title="Delete this note?"
        body="It will be removed for both of you."
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          try {
            await api.deleteFeedback(removing.id)
            setNotes((cur) => cur.filter((x) => x.id !== removing.id))
            toast('Deleted')
          } catch { toast('Could not delete', true) }
          setRemoving(null)
        }}
      />
    </div>
  )
}
