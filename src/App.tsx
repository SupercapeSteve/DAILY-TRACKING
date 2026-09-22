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
import { PartnerDashboard, PartnerNotes, PartnerSettings } from './screens/partner/PartnerHome'

const OWNER_TABS: { key: string; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Today', icon: 'home' },
  { key: 'progress', label: 'Progress', icon: 'chart' },
  { key: 'notes', label: 'Notes', icon: 'message' },
  { key: 'settings', label: 'Me', icon: 'user' },
]

const PARTNER_TABS: { key: string; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Progress', icon: 'chart' },
  { key: 'notes', label: 'Send note', icon: 'message' },
  { key: 'settings', label: 'Settings', icon: 'user' },
]

export default function App() {
  const { loading, user, needsOnboarding, isPartner } = useAuth()
  const [route, go] = useRoute()
  const base = routeBase(route)

  // Land on a known tab rather than whatever stale hash was in the URL.
  useEffect(() => {
    const tabs = (isPartner ? PARTNER_TABS : OWNER_TABS).map((t) => t.key)
    if (user && !needsOnboarding && !tabs.includes(base) && base !== 'journal') {
      go('today', true)
    }
  }, [user, needsOnboarding, isPartner, base, go])

  if (!isConfigured) return <NotConfigured />
  if (loading) return <Spinner full label="Loading..." />
  if (!user) return <><Auth /><ToastHost /></>
  if (needsOnboarding) return <><Onboarding /><ToastHost /></>

  const tabs = isPartner ? PARTNER_TABS : OWNER_TABS

  return (
    <div className="app">
      {isPartner ? (
        <>
          {base === 'today' && <PartnerDashboard />}
          {base === 'notes' && <PartnerNotes />}
          {base === 'settings' && <PartnerSettings />}
        </>
      ) : (
        <>
          {base === 'today' && <Today />}
          {base === 'progress' && <Progress />}
          {base === 'notes' && <Notes />}
          {base === 'settings' && <Settings />}
          {base === 'journal' && <Journal />}
        </>
      )}

      <nav className="nav" aria-label="Main">
        {/* only visible once the nav becomes a sidebar on wide screens */}
        <div className="nav__brand" aria-hidden="true">
          <span><Icon name="heart" size={19} /></span>
          <span>Daily</span>
        </div>
        {tabs.map((t) => (
          <button
            key={t.key}
            className="nav__item"
            data-on={base === t.key || (t.key === 'settings' && base === 'journal')}
            onClick={() => go(t.key)}
            aria-current={base === t.key ? 'page' : undefined}
          >
            <Icon name={t.icon} size={24} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <ToastHost />
    </div>
  )
}
