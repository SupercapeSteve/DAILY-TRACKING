import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import * as api from './api'
import type { PartnerLink, Profile, ShareSettings } from './types'
import {
  applyTheme, cachePrefs, clearCachedPrefs, DEFAULT_PREFS, readCachedPrefs,
  sanitizePrefs, type AppearancePrefs,
} from './theme'
import * as guestLib from './guest'

/**
 * A stand-in so every screen can keep using `user.id` unchanged. It is never
 * sent anywhere: each function in api.ts checks guest mode and answers from
 * localStorage before it can reach Supabase.
 */
const GUEST_USER = {
  id: guestLib.GUEST_ID,
  aud: 'guest',
  app_metadata: {},
  user_metadata: {},
  created_at: '',
} as unknown as User

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
  /** Using it without an account. Data is in this browser only. */
  isGuest: boolean
  /** Start looking around without signing up. */
  enterGuest: () => void
  /** Leave guest mode. Keeps what was logged unless `wipe`. */
  exitGuest: (wipe?: boolean) => void
  /** This account's saved look. Lives in the database, so it follows the
   *  account onto any device. */
  prefs: AppearancePrefs
  savePrefs: (next: AppearancePrefs) => Promise<void>
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
  // Start from the cached look so the right theme paints immediately instead
  // of flashing the default. The database overwrites this once it loads.
  const [prefs, setPrefs] = useState<AppearancePrefs>(() => readCachedPrefs() ?? DEFAULT_PREFS)
  const [guestMode, setGuestMode] = useState(() => guestLib.isGuest())
  const loadingRef = useRef(false)

  // A real session always wins over guest mode.
  const user = session?.user ?? (guestMode ? GUEST_USER : null)

  const loadContext = useCallback(async (u: User | null) => {
    if (!u) {
      setProfile(null); setLink(null); setShare(null)
      return
    }

    // The look is per-account, so load it before anything else - it decides
    // what the very first painted frame looks like.
    try {
      const raw = await api.getAppearance(u.id)
      const resolved = raw ? sanitizePrefs(raw) : (readCachedPrefs(u.id) ?? DEFAULT_PREFS)
      setPrefs(resolved)
      applyTheme(resolved)
      cachePrefs(u.id, resolved)
    } catch {
      // A missing appearance table just means an older database. Not fatal:
      // fall back to defaults so the app still works.
      const fallback = readCachedPrefs(u.id) ?? DEFAULT_PREFS
      setPrefs(fallback)
      applyTheme(fallback)
    }
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const p = await api.getProfile(u.id)
      setProfile(p)

      const l = await api.getLink(u.id, p?.role).catch(() => null)
      setLink(l)

      // A guest has no account, so there is nothing to share and nobody to
      // share with. Skip both rather than letting an insert reach the server.
      if (guestLib.isGuest()) {
        setShare(null)
      } else if (p && p.role === 'owner') {
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
      if (data.session?.user) await loadContext(data.session.user)
      else if (guestLib.isGuest()) await loadContext(GUEST_USER)
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

  // When the look is set to follow the device, react to the device changing.
  useEffect(() => {
    if (prefs.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(prefs)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [prefs])

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

  const savePrefs = useCallback(async (next: AppearancePrefs) => {
    // Apply first so it feels instant, then persist. The database is still
    // the source of truth; this is only ordering.
    setPrefs(next)
    applyTheme(next)
    if (user) {
      cachePrefs(user.id, next)
      await api.saveAppearance(user.id, next)
    }
  }, [user])

  const enterGuest = useCallback(() => {
    guestLib.enterGuest()
    // Set the profile synchronously: loadContext is async, and for one frame
    // a missing profile would read as "needs onboarding" and flash that screen.
    setProfile(guestLib.getProfile())
    setGuestMode(true)
    void loadContext(GUEST_USER)
  }, [loadContext])

  const exitGuest = useCallback((wipe = false) => {
    guestLib.leaveGuest(wipe)
    setGuestMode(false)
    setProfile(null); setLink(null); setShare(null)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null); setLink(null); setShare(null)
    guestLib.leaveGuest()
    setGuestMode(false)
    // Do not leave one account's look behind for the next person to sign in.
    clearCachedPrefs()
    setPrefs(DEFAULT_PREFS)
    applyTheme(DEFAULT_PREFS)
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
      isGuest: guestMode && !session,
      enterGuest,
      exitGuest,
      prefs,
      savePrefs,
      needsOnboarding: Boolean(user) && (!profile || !profile.onboarded),
      refresh,
      setShareLocal: setShare,
      signIn,
      signUp,
      signOut,
    }
  }, [loading, user, profile, link, share, prefs, savePrefs, guestMode, session,
      enterGuest, exitGuest, refresh, signIn, signUp, signOut])

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
