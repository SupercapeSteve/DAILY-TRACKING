import { useEffect } from 'react'
import { useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { routeBase, useRoute } from './lib/router'
import { Icon, Spinner, ToastHost, type IconName } from './components/ui'

import Auth, { NotConfigured } from './screens/Auth'
import Onboarding from './screens/Onboarding'
import Today from './screens/owner/Today'
import Progress from './screens/owner/Progress'
import Notes from './screens/owner/Notes'
import Settings from './screens/owner/Settings'
import Journal from './screens/owner/Journal'
import Appearance from './screens/owner/Appearance'
import Export from './screens/owner/Export'
import GuestImportPrompt from './components/GuestImportPrompt'
import { PartnerDashboard, PartnerNotes, PartnerSettings } from './screens/partner/PartnerHome'

const OWNER_TABS: { key: string; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Today', icon: 'home' },
  { key: 'progress', label: 'Progress', icon: 'chart' },
  { key: 'notes', label: 'Notes', icon: 'message' },
  { key: 'settings', label: 'Me', icon: 'user' },
]

// Solo has no partner, so the notes-from-your-partner tab would always be empty.
const SOLO_TABS: { key: string; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Today', icon: 'home' },
  { key: 'progress', label: 'Progress', icon: 'chart' },
  { key: 'settings', label: 'Me', icon: 'user' },
]

const PARTNER_TABS: { key: string; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Progress', icon: 'chart' },
  { key: 'notes', label: 'Send note', icon: 'message' },
  { key: 'settings', label: 'Settings', icon: 'user' },
]

export default function App() {
  const { loading, user, needsOnboarding, isPartner, isSolo, prefs } = useAuth()
  const [route, go] = useRoute()
  const base = routeBase(route)

  // Land on a known tab rather than whatever stale hash was in the URL.
  useEffect(() => {
    const keys = (isPartner ? PARTNER_TABS : isSolo ? SOLO_TABS : OWNER_TABS).map((t) => t.key)
    // Reachable but not a tab of their own. The journal is owner-only, so a
    // partner landing on it would otherwise get a blank screen.
    const extra = isPartner ? ['appearance', 'export'] : ['journal', 'appearance', 'export']
    if (user && !needsOnboarding && !keys.includes(base) && !extra.includes(base)) {
      go('today', true)
    }
  }, [user, needsOnboarding, isPartner, isSolo, base, go])

  if (!isConfigured) return <NotConfigured />
  if (loading) return <Spinner full label="Loading..." />
  if (!user) return <><Auth /><ToastHost /></>
  if (needsOnboarding) return <><Onboarding /><ToastHost /></>

  const tabs = isPartner ? PARTNER_TABS : isSolo ? SOLO_TABS : OWNER_TABS

  return (
    <div className="app">
      {isPartner ? (
        <>
          {base === 'today' && <PartnerDashboard />}
          {base === 'notes' && <PartnerNotes />}
          {base === 'settings' && <PartnerSettings />}
          {base === 'appearance' && <Appearance />}
          {base === 'export' && <Export />}
        </>
      ) : (
        <>
          {base === 'today' && <Today />}
          {base === 'progress' && <Progress />}
          {base === 'notes' && !isSolo && <Notes />}
          {base === 'settings' && <Settings />}
          {base === 'journal' && <Journal />}
          {base === 'appearance' && <Appearance />}
          {base === 'export' && <Export />}
        </>
      )}

      <nav className="nav" aria-label="Main">
        {/* only visible once the nav becomes a sidebar on wide screens */}
        <div className="nav__brand" aria-hidden="true">
          <span><Icon name="heart" size={19} /></span>
          <span className="truncate">{prefs.appName}</span>
        </div>
        {tabs.map((t) => (
          <button
            key={t.key}
            className="nav__item"
            data-on={base === t.key
              || (t.key === 'settings'
                  && ['journal', 'appearance', 'export'].includes(base))}
            onClick={() => go(t.key)}
            aria-current={base === t.key ? 'page' : undefined}
          >
            <Icon name={t.icon} size={24} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <GuestImportPrompt />
      <ToastHost />
    </div>
  )
}
