import { useMemo, useState } from 'react'
import { Award, GitBranch, LayoutGrid } from 'lucide-react'
import { STAGES } from '../lib/constants'
import { getPredictionForParticipant, resolveMatchTeams } from '../lib/tournament'
import { EmptyNotice, TeamFlag, TeamLabel } from './UI'

export function PredictionView({ snapshot, participantId }) {
  const [tab, setTab] = useState('groups')
  const participant = snapshot.participants.find((item) => item.id === participantId)
  const prediction = useMemo(
    () => getPredictionForParticipant(snapshot, participantId),
    [snapshot, participantId],
  )

  if (!prediction) {
    return <EmptyNotice title="Esta porra todavía no se ha enviado">Cuando esté completa aparecerá aquí.</EmptyNotice>
  }

  const context = {
    ...snapshot,
    groupPicks: prediction.groupPicks,
    knockoutPicks: prediction.knockoutPicks,
  }

  return (
    <div className="prediction-view">
      <div className="prediction-owner">
        <span>Apuesta de</span>
        <strong>{participant?.display_name || 'Participante'}</strong>
      </div>
      <div className="segmented-tabs" role="tablist" aria-label="Secciones de la porra">
        <button className={tab === 'groups' ? 'active' : ''} type="button" onClick={() => setTab('groups')}>
          <LayoutGrid size={16} /> Grupos
        </button>
        <button className={tab === 'bracket' ? 'active' : ''} type="button" onClick={() => setTab('bracket')}>
          <GitBranch size={16} /> Cuadro
        </button>
        <button className={tab === 'award' ? 'active' : ''} type="button" onClick={() => setTab('award')}>
          <Award size={16} /> Bota de Oro
        </button>
      </div>

      {tab === 'groups' && <ReadOnlyGroups snapshot={snapshot} picks={prediction.groupPicks} />}
      {tab === 'bracket' && <ReadOnlyBracket snapshot={snapshot} context={context} />}
      {tab === 'award' && <ReadOnlyAward snapshot={snapshot} pick={prediction.awardPick} />}
    </div>
  )
}
function ReadOnlyGroups({ snapshot, picks }) {
  if (!snapshot.groups.length) return <EmptyNotice title="No hay grupos configurados" />
  return (
    <div className="groups-grid groups-grid--readonly">
      {snapshot.groups.map((group) => (
        <article className="group-card" key={group.id}>
          <header><strong>{group.name}</strong></header>
          {[1, 2, 3].map((position) => {
            const pick = picks.find((item) => item.group_id === group.id && item.position === position)
            const team = snapshot.teams.find((item) => item.id === pick?.team_id)
            return (
              <div className="group-result-row" key={position}>
                <span>{position === 1 ? '1º' : position === 2 ? '2º' : '3º'}</span>
                {team ? <TeamLabel team={team} /> : <em>No clasifica</em>}
              </div>
            )
          })}
        </article>
      ))}
    </div>
  )
}

function ReadOnlyBracket({ snapshot, context }) {
  if (!snapshot.matches.length) return <EmptyNotice title="El cuadro todavía no está configurado" />
  return (
    <div className="bracket-scroll">
      <div className="bracket-grid">
        {STAGES.map((stage) => {
          const matches = snapshot.matches.filter((match) => match.stage === stage.value)
          if (!matches.length) return null
          return (
            <section className="bracket-stage" key={stage.value}>
              <header><span>{String(matches.length).padStart(2, '0')}</span><strong>{stage.label}</strong></header>
              <div className="bracket-stage-matches">
                {matches.map((match) => {
                  const teams = resolveMatchTeams(match, context)
                  const winnerId = context.knockoutPicks.find((item) => item.match_id === match.id)?.winner_team_id
                  return (
                    <article className="bracket-match" key={match.id}>
                      <small>{match.label || `${stage.label} ${match.slot_index}`}</small>
                      {teams.map((team, index) => (
                        <div className={team?.id === winnerId ? 'winner' : ''} key={`${match.id}-${index}`}>
                          <TeamLabel team={team} muted={!team} />
                        </div>
                      ))}
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function ReadOnlyAward({ snapshot, pick }) {
  const candidate = snapshot.candidates.find((item) => item.id === pick?.candidate_id)
  const team = snapshot.teams.find((item) => item.id === candidate?.team_id)
  return (
    <div className="award-result-card">
      {candidate?.photo_url ? (
        <img src={candidate.photo_url} alt="" />
      ) : (
        <span className="award-avatar">{(candidate?.name || pick?.custom_name || '?').slice(0, 1).toUpperCase()}</span>
      )}
      <div>
        <span>Máximo goleador</span>
        <strong>{candidate?.name || pick?.custom_name || 'Sin elegir'}</strong>
        {team && <span className="award-team"><TeamFlag team={team} /> {team.name}</span>}
      </div>
    </div>
  )
}
