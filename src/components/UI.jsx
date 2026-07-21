import { X } from 'lucide-react'
import { countryFlag } from '../lib/constants'

export function Modal({ open, onClose, title, eyebrow, children, wide = false }) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal-panel${wide ? ' modal-panel--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            {eyebrow && <p className="section-kicker">{eyebrow}</p>}
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  )
}
export function TeamFlag({ team, size = 'normal' }) {
  const fallback = countryFlag(team?.country_code)
  if (team?.flag_url) {
    return <img className={`team-flag team-flag--${size}`} src={team.flag_url} alt="" />
  }
  return (
    <span className={`team-flag-fallback team-flag-fallback--${size}`} aria-hidden="true">
      {fallback || '·'}
    </span>
  )
}

export function TeamLabel({ team, muted = false }) {
  return (
    <span className={`team-label${muted ? ' team-label--muted' : ''}`}>
      {team ? <TeamFlag team={team} /> : <span className="team-slot-dot" />}
      <span>{team?.name || 'Por decidir'}</span>
    </span>
  )
}

export function EmptyNotice({ title, children }) {
  return (
    <div className="empty-notice">
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  )
}

export function LoadingScreen() {
  return (
    <main className="loading-screen" aria-label="Cargando Porra Ezpeleta">
      <span className="loading-mark">PE</span>
      <p>Cargando la porra</p>
    </main>
  )
}
