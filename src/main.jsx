import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { RemovalGuard } from './components/RemovalGuard'

const pathname = window.location.pathname.replace(/\/+$/, '')

if (pathname === '/webantigua') {
  window.location.replace('/webantigua/index.html')
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <RemovalGuard><App /></RemovalGuard>
    </StrictMode>,
  )
}
