import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import * as api from './api'
import type { PartnerLink, Profile, ShareSettings } from './types'

interface AuthValue {
  loading: boolean
  user: User | null
  profile: Profile | null
  link: PartnerLink | null
  share: ShareSettings | null
  /** The id of the person whose data we are looking at. */
  ownerId: string | null
  isOwner: boolean
  isPartner: boolean
  /** Using the app alone - nobody else is involved at all. */
  isSolo: boolean
  /** True until the profile row exists and onboarding has been completed. */
  needsOnboarding: boolean
  refresh: () => Promise<void>
  setShareLocal: (s: ShareSettings) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [link, setLink] = useState<PartnerLink | null>(null)
  const [share, setShare] = useState<ShareSettings | null>(null)
  const loadingRef = useRef(false)

  const user = session?.user ?? null

  const loadContext = useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null); setLink(null); setShare(null)
      return
    }
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const p = await api.getProfile(u.id)
      setProfile(p)

      const l = await api.getLink(u.id, p?.role).catch(() => null)
      setLink(l)

      // Only the owner can read her own switches; the partner never can.
      if (p && p.role === 'owner') {
        setShare(await api.ensureShareSettings(u.id).catch(() => null))
        // An owner always needs an invite code to show. A solo user does not:
        // minting one would be creating the very thing they opted out of.
        if (!l && !p.solo) setLink(await api.ensureLink(u.id).catch(() => null))
      } else {
        setShare(null)
      }
    } finally {
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      await loadContext(data.session?.user ?? null)
      if (!cancelled) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // TOKEN_REFRESHED fires often; re-fetching the profile every time would
      // cause needless spinners.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        void loadContext(s?.user ?? null)
      }
    })

    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [loadContext])

  const refresh = useCallback(async () => {
    await loadContext(user)
  }, [loadContext, user])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(), password,
    })
    if (error) throw new Error(friendlyAuthError(error.message))
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email: email.trim(), password })
    if (error) throw new Error(friendlyAuthError(error.message))
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null); setLink(null); setShare(null)
  }, [])

  const value = useMemo<AuthValue>(() => {
    const isPartner = profile?.role === 'partner'
    const isOwner = profile?.role === 'owner'
    const isSolo = isOwner && profile?.solo === true
    return {
      loading,
      user,
      profile,
      link,
      share,
      ownerId: isPartner ? (link?.owner_id ?? null) : (user?.id ?? null),
      isOwner,
      isPartner,
      isSolo,
      needsOnboarding: Boolean(user) && (!profile || !profile.onboarded),
      refresh,
      setShareLocal: setShare,
      signIn,
      signUp,
      signOut,
    }
  }, [loading, user, profile, link, share, refresh, signIn, signUp, signOut])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}

/** Supabase's wording is developer-facing. Hers should not be. */
function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'That email or password is not right. Try again.'
  if (m.includes('email not confirmed')) return 'This account still needs its email confirmed.'
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'There is already an account with that email. Try signing in instead.'
  }
  if (m.includes('password should be at least')) return 'Please use a password of at least 6 characters.'
  if (m.includes('unable to validate email') || m.includes('invalid format')) {
    return 'That does not look like a valid email address.'
  }
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Wait a minute and try again.'
  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return 'Could not reach the server. Check your internet connection.'
  }
  return msg
}
