import { useEffect, useMemo, useState } from 'react'
import { Award, Check, GitBranch, LayoutGrid, LoaderCircle, Save } from 'lucide-react'
import { STAGES } from '../lib/constants'
import {
  getPredictionForParticipant,
  invalidateDependentPicks,
  resolveMatchTeams,
} from '../lib/tournament'
import { Countdown } from './Countdown'
import { EmptyNotice, TeamFlag, TeamLabel } from './UI'

export function PredictionEditor({ snapshot, participantId, onSave, adminMode = false }) {
  const existing = useMemo(
    () => getPredictionForParticipant(snapshot, participantId),
    [snapshot, participantId],
  )
  const [tab, setTab] = useState('groups')
  const [groupPicks, setGroupPicks] = useState(existing?.groupPicks || [])
  const [knockoutPicks, setKnockoutPicks] = useState(existing?.knockoutPicks || [])
  const [awardPick, setAwardPick] = useState(existing?.awardPick || null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setGroupPicks(existing?.groupPicks || [])
    setKnockoutPicks(existing?.knockoutPicks || [])
    setAwardPick(existing?.awardPick || null)
  }, [existing, participantId])

  const context = { ...snapshot, groupPicks, knockoutPicks }
  const deadlinePassed = snapshot.competition.prediction_deadline
    ? Date.now() > new Date(snapshot.competition.prediction_deadline).getTime()
    : false
  const locked = deadlinePassed && !adminMode
  const thirdCount = groupPicks.filter((pick) => pick.position === 3).length

  function chooseGroupTeam(groupId, position, teamId) {
    if (locked) return
    let next = groupPicks.filter(
      (pick) => !(pick.group_id === groupId && (pick.position === position || pick.team_id === teamId)),
    )
    if (teamId) next.push({ group_id: groupId, position, team_id: teamId })
    setGroupPicks(next)
    setKnockoutPicks((current) =>
      invalidateDependentPicks(snapshot.matches, current, { ...snapshot, groupPicks: next }),
    )
  }

  function chooseMatchWinner(matchId, teamId) {
    if (locked || !teamId) return
    const next = [...knockoutPicks.filter((pick) => pick.match_id !== matchId), { match_id: matchId, winner_team_id: teamId }]
    setKnockoutPicks(
      invalidateDependentPicks(snapshot.matches, next, { ...snapshot, groupPicks }),
    )
  }

  async function save(submit) {
    setSaving(true)
    setMessage('')
    try {
      await onSave(
        participantId,
        { groupPicks, knockoutPicks, awardPick },
        submit,
      )
      setMessage(submit ? 'Porra enviada correctamente' : 'Borrador guardado')
    } catch (error) {
      setMessage(error.message || 'No se pudo guardar la porra')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="prediction-editor">
      <div className="editor-toolbar">
        <div>
          <p className="section-kicker">Tu apuesta</p>
          <h2>{existing?.entry?.status === 'submitted' ? 'Porra enviada' : 'Completa tu porra'}</h2>
        </div>
        {!adminMode && (
          <div className="editor-deadline">
            <span>Plazo disponible</span>
            <Countdown deadline={snapshot.competition.prediction_deadline} compact />
          </div>
        )}
      </div>

      <div className="segmented-tabs editor-tabs" role="tablist">
        <button className={tab === 'groups' ? 'active' : ''} type="button" onClick={() => setTab('groups')}><LayoutGrid size={16} /> Grupos</button>
        <button className={tab === 'bracket' ? 'active' : ''} type="button" onClick={() => setTab('bracket')}><GitBranch size={16} /> Eliminatorias</button>
        <button className={tab === 'award' ? 'active' : ''} type="button" onClick={() => setTab('award')}><Award size={16} /> Bota de Oro</button>
      </div>

      <div className="editor-workspace">
        {tab === 'groups' && (
          <GroupEditor
            snapshot={snapshot}
            picks={groupPicks}
            onChange={chooseGroupTeam}
            disabled={locked}
            thirdCount={thirdCount}
          />
        )}
        {tab === 'bracket' && (
          <BracketEditor snapshot={snapshot} context={context} onChoose={chooseMatchWinner} disabled={locked} />
        )}
        {tab === 'award' && (
          <AwardEditor snapshot={snapshot} pick={awardPick} onChange={setAwardPick} disabled={locked} />
        )}
      </div>

      <footer className="editor-footer">
        <span className={message.includes('correctamente') || message.includes('guardado') ? 'form-success' : 'form-error'}>{message}</span>
        <div>
          <button className="secondary-button" type="button" onClick={() => save(false)} disabled={saving || locked}>
            <Save size={17} /> Guardar
          </button>
          <button className="primary-button" type="button" onClick={() => save(true)} disabled={saving || locked}>
            {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
            {adminMode ? 'Guardar porra' : 'Enviar porra'}
          </button>
        </div>
      </footer>
    </div>
  )
}

function GroupEditor({ snapshot, picks, onChange, disabled, thirdCount }) {
  if (!snapshot.groups.length) return <EmptyNotice title="La organización todavía no ha creado los grupos" />
  return (
    <>
      <div className="workspace-note">
        <span>Selecciona primero y segundo de cada grupo.</span>
        <strong>{thirdCount}/{snapshot.competition.wildcard_count} terceros clasificados</strong>
      </div>
      <div className="groups-grid">
        {snapshot.groups.map((group) => (
          <article className="group-card group-card--editable" key={group.id}>
            <header>
              <strong>{group.name}</strong>
              <span>{group.teams.length} equipos</span>
            </header>
            {[1, 2, 3].map((position) => {
              const pick = picks.find((item) => item.group_id === group.id && item.position === position)
              const usedIds = picks.filter((item) => item.group_id === group.id && item.position !== position).map((item) => item.team_id)
              const thirdLimitReached = position === 3 && thirdCount >= snapshot.competition.wildcard_count && !pick
              return (
                <label className="group-select-row" key={position}>
                  <span>{position === 1 ? '1º' : position === 2 ? '2º' : '3º'}</span>
                  <select
                    value={pick?.team_id || ''}
                    onChange={(event) => onChange(group.id, position, event.target.value)}
                    disabled={disabled || thirdLimitReached}
                  >
                    <option value="">{position === 3 ? 'No clasifica' : 'Seleccionar'}</option>
                    {group.teams.filter((team) => !usedIds.includes(team.id)).map((team) => (
                      <option value={team.id} key={team.id}>{team.name}</option>
                    ))}
                  </select>
                </label>
              )
            })}
          </article>
        ))}
      </div>
    </>
  )
}

function BracketEditor({ snapshot, context, onChoose, disabled }) {
  if (!snapshot.matches.length) return <EmptyNotice title="La organización todavía no ha creado el cuadro" />
  return (
    <div className="bracket-scroll bracket-scroll--editor">
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
                    <article className="bracket-match bracket-match--editable" key={match.id}>
                      <small>{match.label || `${stage.label} ${match.slot_index}`}</small>
                      {teams.map((team, index) => (
                        <button
                          className={team?.id === winnerId ? 'winner' : ''}
                          type="button"
                          disabled={disabled || !team}
                          onClick={() => onChoose(match.id, team?.id)}
                          key={`${match.id}-${index}`}
                        >
                          <TeamLabel team={team} muted={!team} />
                          {team?.id === winnerId && <Check size={15} />}
                        </button>
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

function AwardEditor({ snapshot, pick, onChange, disabled }) {
  const customSelected = Boolean(pick?.custom_name)
  return (
    <div className="award-editor">
      <div className="candidate-grid">
        {snapshot.candidates.map((candidate) => {
          const team = snapshot.teams.find((item) => item.id === candidate.team_id)
          const selected = pick?.candidate_id === candidate.id
          return (
            <button
              className={`candidate-card${selected ? ' selected' : ''}`}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ candidate_id: candidate.id, custom_name: '' })}
              key={candidate.id}
            >
              {candidate.photo_url ? <img src={candidate.photo_url} alt="" /> : <span className="candidate-avatar">{candidate.name.slice(0, 1)}</span>}
              <strong>{candidate.name}</strong>
              {team && <span><TeamFlag team={team} size="small" /> {team.name}</span>}
              {selected && <Check className="candidate-check" size={16} />}
            </button>
          )
        })}
      </div>
      <label className={`custom-candidate${customSelected ? ' selected' : ''}`}>
        <span>Otro jugador</span>
        <input
          type="text"
          value={pick?.custom_name || ''}
          onChange={(event) => onChange({ candidate_id: null, custom_name: event.target.value })}
          placeholder="Escribe nombre y selección"
          disabled={disabled}
        />
      </label>
    </div>
  )
}
