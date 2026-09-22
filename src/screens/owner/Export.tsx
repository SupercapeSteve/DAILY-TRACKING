import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { navigate } from '../../lib/router'
import * as api from '../../lib/api'
import {
  buildFile, gather, isEmpty, openInTab, shareOrDownload,
  type ExportFormat, type ExportRange,
} from '../../lib/export'
import {
  Banner, Button, Card, Chip, Icon, SwitchRow, Spinner, toast,
} from '../../components/ui'

const FORMATS: { v: ExportFormat; label: string; icon: 'book' | 'chart' | 'copy'; desc: string }[] = [
  {
    v: 'html', label: 'Readable page', icon: 'book',
    desc: 'One web page you can open on any device, print, or save as a PDF. Best for keeping or showing someone.',
  },
  {
    v: 'csv', label: 'Spreadsheet', icon: 'chart',
    desc: 'Opens in Excel, Numbers or Google Sheets. One row per thing logged, so you can sort and filter it yourself.',
  },
  {
    v: 'json', label: 'Full backup', icon: 'copy',
    desc: 'Every field exactly as stored. Not pretty, but nothing is left out - use this if you want a true backup.',
  },
]

const RANGES: { v: ExportRange; label: string }[] = [
  { v: 'all', label: 'Everything' },
  { v: '365', label: 'Last year' },
  { v: '90', label: 'Last 90 days' },
  { v: '30', label: 'Last 30 days' },
]

export default function Export() {
  const { user, profile, link, isPartner, prefs } = useAuth()

  const [format, setFormat] = useState<ExportFormat>('html')
  const [range, setRange] = useState<ExportRange>('all')
  const [includeJournal, setIncludeJournal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ownerName, setOwnerName] = useState(profile?.display_name || 'Me')
  const [shared, setShared] = useState<string[] | undefined>(undefined)

  const ownerId = isPartner ? (link?.owner_id ?? null) : (user?.id ?? null)

  // The partner needs the other person's name, and which categories were on.
  useEffect(() => {
    if (!isPartner) { setOwnerName(profile?.display_name || 'Me'); return }
    let alive = true
    api.getPartnerViewState().then((v) => {
      if (!alive || !v) return
      setOwnerName(v.owner_name || 'Your partner')
      setShared([
        v.food && 'meals', v.workouts && 'workouts', v.tasks && 'tasks',
        v.day && 'how their day went', v.goals && 'goals', v.body && 'body basics',
      ].filter(Boolean) as string[])
    }).catch(() => { /* the export still works, just without the labels */ })
    return () => { alive = false }
  }, [isPartner, profile?.display_name])

  if (!user) return <Spinner full />

  async function run(action: 'save' | 'open') {
    if (!ownerId) { toast('Nothing to export yet', true); return }
    setBusy(true)
    try {
      const bundle = await gather({
        ownerId,
        ownerName,
        units: profile?.units ?? 'imperial',
        range,
        includeJournal,
        asPartner: isPartner,
        sharedCategories: shared,
      })

      if (isEmpty(bundle)) {
        toast('There is nothing logged in that range yet', true)
        return
      }

      const file = buildFile(bundle, format)

      if (action === 'open') {
        if (!openInTab(file.content, file.mime)) {
          toast('Your browser blocked the new tab - try Save instead', true)
        }
        return
      }

      const how = await shareOrDownload(
        file.filename, file.content, file.mime,
        `${ownerName} - ${prefs.appName} export`,
      )
      toast(how === 'shared' ? 'Ready to send' : `Saved as ${file.filename}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not build the file', true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen screen--narrow stack-l">
      <div className="row">
        <button className="icon-btn" aria-label="Back" onClick={() => navigate('settings')}>
          <Icon name="back" size={22} />
        </button>
        <div className="grow">
          <h1 style={{ fontSize: 'calc(24px * var(--fs))' }}>Export</h1>
        </div>
      </div>

      {isPartner ? (
        <Banner icon="eye">
          This saves <strong>only what {ownerName} is sharing with you</strong>
          {shared?.length ? <> right now: {shared.join(', ')}.</> : '.'}
          {' '}Anything they marked private is not included, and their journal never is.
        </Banner>
      ) : (
        <Banner icon="lock">
          Everything is put together on your own device. The file is never uploaded
          anywhere, and nobody else gets a copy unless you send them one.
        </Banner>
      )}

      {/* ------------------------------------------------------- format -- */}
      <div className="stack-s">
        <p className="section-label">What kind of file</p>
        {FORMATS.map((f) => (
          <Card key={f.v} style={{ padding: 0 }}>
            <button
              className="entry"
              style={{ padding: 15 }}
              aria-pressed={format === f.v}
              onClick={() => setFormat(f.v)}
            >
              <span
                className="dot"
                style={{ background: format === f.v ? 'var(--primary)' : 'var(--surface-2)',
                         color: format === f.v ? 'var(--on-primary)' : 'var(--text-mute)' }}
              >
                <Icon name={f.icon} size={19} />
              </span>
              <span className="grow">
                <span className="bold" style={{ display: 'block' }}>{f.label}</span>
                <span className="small muted">{f.desc}</span>
              </span>
              {format === f.v && <Icon name="check" size={20} style={{ color: 'var(--primary)' }} />}
            </button>
          </Card>
        ))}
      </div>

      {/* -------------------------------------------------------- range -- */}
      <div className="stack-s">
        <p className="section-label">How much</p>
        <div className="wrap">
          {RANGES.map((r) => (
            <Chip key={r.v} on={range === r.v} onClick={() => setRange(r.v)}>{r.label}</Chip>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------ journal -- */}
      {!isPartner && (
        <div className="stack-s">
          <p className="section-label">Private journal</p>
          <Card style={{ padding: '2px 14px' }}>
            <SwitchRow
              icon="book"
              title="Include my journal"
              desc="Off by default, so you never send it to someone by accident."
              on={includeJournal}
              onChange={setIncludeJournal}
            />
          </Card>
          {includeJournal && (
            <Banner kind="warn">
              Your journal will be inside this file. Be careful where you save or
              send it.
            </Banner>
          )}
        </div>
      )}

      {/* -------------------------------------------------------- actions -- */}
      <div className="stack-s">
        <Button variant="primary" size="lg" block icon="send" busy={busy}
          onClick={() => run('save')}>
          Save my file
        </Button>
        {format === 'html' && (
          <Button variant="ghost" block icon="eye" disabled={busy}
            onClick={() => run('open')}>
            Just show me it first
          </Button>
        )}
        <p className="tiny mute-2 center">
          On a phone this opens the share sheet, so you can send it to yourself,
          save it to Files, or put it in Drive.
        </p>
      </div>

      {isPartner && (
        <Banner icon="heart">
          A saved copy stays on your device even if {ownerName} later changes what
          they share. It is still their information - look after it.
        </Banner>
      )}
    </div>
  )
}
