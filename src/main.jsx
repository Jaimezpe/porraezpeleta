import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

const pathname = window.location.pathname.replace(/\/+$/, '')

if (pathname === '/webantigua') {
  window.location.replace('/webantigua/index.html')
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
