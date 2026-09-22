import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './lib/auth'
import { applyTheme, DEFAULT_PREFS, readCachedPrefs } from './lib/theme'
import './index.css'

// Paint the saved look before React mounts, so a returning visitor never sees
// a flash of the default theme. The database still has the last word.
applyTheme(readCachedPrefs() ?? DEFAULT_PREFS)

const el = document.getElementById('root')
if (!el) throw new Error('Missing #root element')

createRoot(el).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
