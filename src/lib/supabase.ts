import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * False when the two env vars are missing OR still hold the placeholders from
 * .env.example, so the app shows a readable setup screen rather than a blank
 * page or a pile of network errors.
 */
export const isConfigured =
  Boolean(url && key) &&
  url!.startsWith('http') &&
  !url!.includes('yourproject') &&
  !key!.startsWith('your-')

export const supabase = createClient(url ?? 'https://placeholder.supabase.co', key ?? 'placeholder', {
  auth: {
    // Keeps her signed in in a normal browser tab, across days and restarts,
    // so she only ever types a password once. This is the whole reason the
    // "just tap the link" flow works.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'daily-auth',
  },
})
