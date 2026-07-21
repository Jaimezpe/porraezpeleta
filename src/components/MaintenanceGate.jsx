import { useState } from 'react'
import { KeyRound, LoaderCircle, LockKeyhole } from 'lucide-react'

export function MaintenanceGate({ busy, error, onSubmit, onRetry }) {
  const [password, setPassword] = useState('')

  function submit(event) {
    event.preventDefault()
    if (password) onSubmit(password)
  }

  return (
    <main className="maintenance-gate">
      <div className="maintenance-gate__background" aria-hidden="true" />
      <section className="maintenance-gate__panel" aria-labelledby="maintenance-title">
        <div className="brand-lockup brand-lockup--maintenance">
          <span className="brand-monogram">PE</span>
          <span><strong>Porra Ezpeleta</strong><small>Acceso privado</small></span>
        </div>
        <span className="maintenance-gate__icon"><LockKeyhole size={24} /></span>
        <div>
          <p className="section-kicker">Mantenimiento</p>
          <h1 id="maintenance-title">Estamos preparando la próxima porra</h1>
          <p>Introduce la contraseña de acceso para continuar.</p>
        </div>
        <form className="maintenance-gate__form" onSubmit={submit}>
          <label className="field-label" htmlFor="maintenance-password">Contraseña</label>
          <div className="maintenance-password-input">
            <KeyRound size={18} aria-hidden="true" />
            <input
              id="maintenance-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button primary-button--full" type="submit" disabled={!password || busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}
            Acceder
          </button>
          {onRetry && (
            <button className="text-button" type="button" onClick={onRetry} disabled={busy}>
              Volver a comprobar
            </button>
          )}
        </form>
      </section>
    </main>
  )
}
