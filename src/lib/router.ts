import { useEffect, useState, useCallback } from 'react'

// A deliberately tiny hash router. Hash routing means the site works on any
// static host with no server rewrite rules, and it makes the phone's back
// button move between tabs instead of leaving the app.

export function currentRoute(): string {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h || 'today'
}

export function navigate(route: string, replace = false) {
  const target = `#/${route.replace(/^\/+/, '')}`
  if (window.location.hash === target) return
  if (replace) window.history.replaceState(null, '', target)
  else window.location.hash = target
  // replaceState does not fire hashchange, so tell listeners ourselves
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function useRoute(): [string, (r: string, replace?: boolean) => void] {
  const [route, setRoute] = useState(currentRoute)

  useEffect(() => {
    const onChange = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const go = useCallback((r: string, replace = false) => navigate(r, replace), [])
  return [route, go]
}

/** The first path segment, e.g. "settings" from "#/settings/sharing". */
export function routeBase(route: string): string {
  return route.split('/')[0] ?? 'today'
}
