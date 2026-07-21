import { LogOut, ShieldCheck } from 'lucide-react'
import { PredictionEditor } from './PredictionEditor'

export function UserDashboard({ snapshot, onSave, onSignOut }) {
  return (
    <main className="dashboard-shell">
      <header className="dashboard-topbar">
        <div className="brand-lockup brand-lockup--dark">
          <span className="brand-monogram">PE</span>
          <span><strong>Porra Ezpeleta</strong><small>{snapshot.competition.name}</small></span>
        </div>
        <div className="dashboard-user">
          <span><small>Participante</small><strong>{snapshot.viewer.display_name}</strong></span>
          <button className="icon-button icon-button--light" type="button" onClick={onSignOut} aria-label="Cerrar sesion" title="Cerrar sesión">
            <LogOut size={19} />
          </button>
        </div>
      </header>
      <section className="dashboard-content user-content">
        <div className="welcome-row">
          <div><p className="section-kicker">Panel personal</p><h1>Hola, {snapshot.viewer.display_name}.</h1></div>
          <span className="status-chip"><ShieldCheck size={15} /> Una porra activa</span>
        </div>
        <PredictionEditor snapshot={snapshot} participantId={snapshot.viewer.id} onSave={onSave} />
      </section>
    </main>
  )
}
