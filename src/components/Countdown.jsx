import { useEffect, useState } from 'react'

export function Countdown({ deadline, compact = false }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (!deadline) {
    return <span className="deadline-missing">Fecha pendiente</span>
  }

  const distance = new Date(deadline).getTime() - now
  if (distance <= 0) return <span className="deadline-closed">Plazo cerrado</span>

  const days = Math.floor(distance / 86400000)
  const hours = Math.floor((distance % 86400000) / 3600000)
  const minutes = Math.floor((distance % 3600000) / 60000)
  const seconds = Math.floor((distance % 60000) / 1000)
  const units = [
    ['dias', days],
    ['horas', hours],
    ['min', minutes],
    ['seg', seconds],
  ]

  return (
    <span className={`countdown${compact ? ' countdown--compact' : ''}`} aria-live="polite">
      {units.map(([label, value]) => (
        <span className="countdown-unit" key={label}>
          <strong>{String(value).padStart(2, '0')}</strong>
          <small>{label}</small>
        </span>
      ))}
    </span>
  )
}
