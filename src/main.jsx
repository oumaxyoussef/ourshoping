import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { hydrateStoreCaches } from './lib/store.js'

const rootEl = document.getElementById('root')

// Render immediately — don't wait for Supabase
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Hydrate caches in background
hydrateStoreCaches().catch(() => {})
