import { useEffect, useMemo, useState } from 'react'
import { getLeaderboardData } from './data/leaderboard'
import './App.css'

const initialState = {
  status: 'loading',
  players: [],
  sourceLabel: 'Cargando',
  updatedAt: null,
  error: '',
}

function App() {
  const [leaderboard, setLeaderboard] = useState(initialState)

  useEffect(() => {
    let active = true

    getLeaderboardData().then((data) => {
      if (!active) {
        return
      }

      setLeaderboard({
        status: 'ready',
        players: data.players,
        sourceLabel: data.sourceLabel,
        updatedAt: data.updatedAt,
        error: data.error || '',
      })
    })

    return () => {
      active = false
    }
  }, [])

  const leader = leaderboard.players[0]
  const hasPlayers = leaderboard.players.length > 0
  const updatedText = useMemo(() => {
    if (leaderboard.error) {
      return 'Pendiente de datos'
    }

    if (!leaderboard.updatedAt) {
      return 'Actualizando datos'
    }

    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(leaderboard.updatedAt)
  }, [leaderboard.updatedAt])

  return (
    <main className="app-shell" aria-label="Porra Ezpeleta">
      <div className="ambient-image" aria-hidden="true" />
      <div className="ambient-tint" aria-hidden="true" />

      <section className="brand-area" aria-labelledby="page-title">
        <p className="eyebrow">Clasificacion familiar</p>
        <h1 id="page-title">Porra Ezpeleta</h1>
        <p className="lead">
        </p>

        <div className="leader-summary" aria-live="polite">
          <span>Lider</span>
          <strong>{leader?.name || 'Pendiente'}</strong>
          <small>{leader ? `${leader.points} puntos` : 'sin datos'}</small>
        </div>
      </section>

      <section className="ranking-area" aria-labelledby="ranking-title">
        <header className="ranking-header">
          <div>
            <p>Top 5</p>
            <h2 id="ranking-title">Clasificacion</h2>
          </div>
          <span>{leaderboard.sourceLabel}</span>
        </header>

        <ol className="ranking-list" aria-busy={leaderboard.status === 'loading'}>
          {hasPlayers ? (
            leaderboard.players.map((player) => (
              <li className="ranking-row" key={`${player.position}-${player.name}`}>
                <span className="rank-number">{String(player.position).padStart(2, '0')}</span>

                <div className="player-block">
                  <strong>{player.name}</strong>
                  {typeof player.hits === 'number' && <span>{player.hits} aciertos</span>}
                </div>

                <div className="score-block">
                  <strong>{player.points}</strong>
                  <span>puntos</span>
                </div>
              </li>
            ))
          ) : (
            <li className="empty-state">
              <strong>Sin resultados todavia</strong>
              <span>Cuando mi padre me pase el excel, lo activo.</span>
            </li>
          )}
        </ol>

        <footer className="ranking-footer">
          <span>{updatedText}</span>
          {leaderboard.error && <span>Fuente pendiente</span>}
        </footer>
      </section>
    </main>
  )
}

export default App
