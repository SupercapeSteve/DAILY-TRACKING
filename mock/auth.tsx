// DEV-ONLY stand-in for src/lib/auth.tsx. Wired in only by vite.config.mock.ts.
// Append ?role=partner to the URL to preview the partner side.
import type { ReactNode } from 'react'
import type { PartnerLink, Profile, ShareSettings } from '../src/lib/types'

const OWNER = '00000000-0000-0000-0000-0000000000aa'
const PARTNER = '00000000-0000-0000-0000-0000000000bb'

const isPartner = new URLSearchParams(window.location.search).get('role') === 'partner'

const isSoloPreview = new URLSearchParams(window.location.search).get('role') === 'solo'

const profile: Profile = {
  id: isPartner ? PARTNER : OWNER,
  display_name: isPartner ? 'Alex' : 'Sam',
  role: isPartner ? 'partner' : 'owner',
  units: 'imperial',
  onboarded: true,
  solo: isSoloPreview,
  created_at: '2026-09-01T00:00:00Z',
}

const link: PartnerLink = {
  id: 'link-1', owner_id: OWNER, partner_id: PARTNER,
  invite_code: 'K7PQ4MRT', status: 'accepted',
  created_at: '2026-09-01T00:00:00Z', accepted_at: '2026-09-02T00:00:00Z',
}

const share: ShareSettings = {
  owner_id: OWNER,
  share_food: true, share_workouts: true, share_tasks: true,
  share_day: true, share_body: true, share_goals: true,
  sharing_paused: false, updated_at: '2026-09-01T00:00:00Z',
}

const value = {
  loading: false,
  user: { id: profile.id, email: isPartner ? 'alex@example.com' : 'sam@example.com' } as never,
  profile,
  link: isSoloPreview ? null : link,
  share: isPartner ? null : share,
  ownerId: OWNER,
  isOwner: !isPartner,
  isPartner,
  isSolo: !isPartner && isSoloPreview,
  needsOnboarding: false,
  refresh: async () => {},
  setShareLocal: () => {},
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useAuth() {
  return value
}
