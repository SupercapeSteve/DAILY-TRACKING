import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './lib/auth'
import './index.css'

const el = document.getElementById('root')
if (!el) throw new Error('Missing #root element')

createRoot(el).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
