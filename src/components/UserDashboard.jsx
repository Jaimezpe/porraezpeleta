import { LogOut, ShieldCheck } from 'lucide-react'
import { PredictionEditor } from './PredictionEditor'
import { ResultsPanel } from './AdminDashboard'
import { PredictionImage } from './PredictionImage'
import { useState } from 'react'

export function UserDashboard({ snapshot, onSave, onSignOut, onRefresh }) {
  const [results,setResults]=useState(false)
  const [notice,setNotice]=useState('')
  async function run(action,message) {
    try {await action();await onRefresh();setNotice(message)} catch(error){setNotice(error.message)}
  }
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
        {snapshot.viewer.role==='scorer' && <button className="secondary-button" onClick={()=>setResults(!results)}>{results?'Volver a mi apuesta':'Anotar resultados'}</button>}
        {results ? <>{notice && <p role="status">{notice}</p>}<ResultsPanel snapshot={snapshot} run={run}/></> : <>
          <PredictionImage snapshot={snapshot} participantId={snapshot.viewer.id}/>
          <PredictionEditor snapshot={snapshot} participantId={snapshot.viewer.id} onSave={onSave}/>
        </>}
      </section>
    </main>
  )
}
