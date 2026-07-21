import { useMemo, useState } from 'react'
import { ArrowRight, Eye, LogIn, Trophy } from 'lucide-react'
import { Countdown } from './Countdown'
import { EmptyNotice } from './UI'
import { calculateLeaderboard } from '../lib/tournament'

export function Landing({ snapshot, onLogin, onViewPrediction }) {
  const [selectedParticipant, setSelectedParticipant] = useState('')
  const competition = snapshot.competition
  const leaderboard = useMemo(() => calculateLeaderboard(snapshot), [snapshot])
  const submittedIds = new Set(snapshot.entries.filter((entry) => entry.status === 'submitted').map((entry) => entry.participant_id))
  const visibleParticipants = snapshot.participants.filter((participant) => submittedIds.has(participant.id))
  const mode = competition.landing_mode || 'winner'

  return (
    <main className={`landing landing--${mode}`}>
      <div className="landing-background" aria-hidden="true" />
      <div className="landing-overlay" aria-hidden="true" />

      <header className="landing-header">
        <a className="brand-lockup" href="#inicio" aria-label="Porra Ezpeleta, inicio">
          <span className="brand-monogram">PE</span>
          <span>
            <strong>Porra Ezpeleta</strong>
            <small>{competition.name}</small>
          </span>
        </a>
        <button className="login-button" type="button" onClick={onLogin}>
          <LogIn size={18} />
          Iniciar sesion
        </button>
      </header>

      <section className="landing-main" id="inicio">
        <div className="hero-copy">
          <p className="hero-kicker">La porra de la familia</p>
          {mode === 'winner' ? (
            <>
              <h1>El ganador de la porra fue <span>{competition.winner_name || 'Jaime'}</span></h1>
              <p className="hero-lead">La próxima edición ya se prepara. Entra para revisar tu espacio o consulta las porras de la familia.</p>
              <div className="winner-stamp">
                <Trophy size={23} />
                <span><small>Campeon vigente</small><strong>{competition.winner_name || 'Jaime'}</strong></span>
              </div>
            </>
          ) : (
            <>
              <h1>{mode === 'live' ? 'La clasificación, en directo.' : 'Haz tu porra antes de que cierre el plazo.'}</h1>
              <p className="hero-lead">{competition.name}. Un cuadro, una Bota de Oro y hasta 300 puntos en juego.</p>
              {mode === 'predictions' && (
                <div className="hero-countdown">
                  <small>Tiempo para enviar tu porra</small>
                  <Countdown deadline={competition.prediction_deadline} />
                </div>
              )}
            </>
          )}
          <button className="primary-button hero-action" type="button" onClick={onLogin}>
            Entrar en mi porra <ArrowRight size={18} />
          </button>
        </div>

        <aside className="landing-side" aria-label={mode === 'live' ? 'Clasificacion' : 'Edicion actual'}>
          {mode === 'live' ? (
            <>
              <div className="ranking-title-row">
                <div><p className="section-kicker">Top 5</p><h2>Clasificacion</h2></div>
                <span>300 pts max.</span>
              </div>
              {leaderboard.length ? (
                <ol className="compact-ranking">
                  {leaderboard.slice(0, 5).map((row) => (
                    <li key={row.participantId}>
                      <span className="compact-rank">{row.position}</span>
                      <strong>{row.name}</strong>
                      <span>{row.points} pts</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyNotice title="La clasificación aún no ha empezado">Aparecerá cuando haya resultados reales.</EmptyNotice>
              )}
            </>
          ) : (
            <div className="edition-poster">
              <img src="/lo-mundial-2026-2.jpg" alt="Imagen de la edición de la Porra Ezpeleta" />
              <div>
                <p className="section-kicker">Proxima edicion</p>
                <h2>{competition.name}</h2>
                {competition.prediction_deadline ? (
                  <span className="poster-deadline"><Countdown deadline={competition.prediction_deadline} compact /></span>
                ) : (
                  <span className="poster-deadline">Fecha por anunciar</span>
                )}
              </div>
            </div>
          )}
        </aside>
      </section>

      <footer className="landing-footer">
        <div className="public-prediction-control">
          <Eye size={17} />
          <label htmlFor="public-prediction">Ver porra de</label>
          <select
            id="public-prediction"
            value={selectedParticipant}
            onChange={(event) => {
              const value = event.target.value
              setSelectedParticipant(value)
              if (value) onViewPrediction(value)
            }}
          >
            <option value="">Selecciona participante</option>
            {visibleParticipants.map((participant) => (
              <option value={participant.id} key={participant.id}>{participant.display_name}</option>
            ))}
          </select>
        </div>
        <span className="landing-credit">Hasta 16 participantes · 300 puntos</span>
      </footer>
    </main>
  )
}
