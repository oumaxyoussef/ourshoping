import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { hydrateStoreCaches } from './lib/store.js'

const rootEl = document.getElementById('root')

function renderApp() {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

hydrateStoreCaches().then(renderApp).catch(() => {
  renderApp()
})
