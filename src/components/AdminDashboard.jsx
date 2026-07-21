import { useEffect, useMemo, useState } from 'react'
import {
  Award,
  Check,
  ClipboardCheck,
  Eye,
  EyeOff,
  Flag,
  GitBranch,
  LayoutGrid,
  LogOut,
  LockKeyhole,
  Plus,
  Save,
  Settings,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { COUNTRIES, DEFAULT_SCORING, LANDING_MODES, STAGES, countryFlag } from '../lib/constants'
import {
  deletePrediction,
  deleteRecord,
  getMaintenanceConfig,
  replaceGroupTeams,
  saveMaintenanceConfig,
  saveRecord,
  upsertRecord,
  uploadImage,
} from '../lib/repository'
import { getPredictionForParticipant } from '../lib/tournament'
import { PredictionEditor } from './PredictionEditor'
import { EmptyNotice, TeamFlag } from './UI'

const ADMIN_TABS = [
  { id: 'settings', label: 'Configuracion', icon: Settings },
  { id: 'participants', label: 'Participantes', icon: Users },
  { id: 'teams', label: 'Selecciones', icon: Flag },
  { id: 'groups', label: 'Grupos', icon: LayoutGrid },
  { id: 'bracket', label: 'Eliminatorias', icon: GitBranch },
  { id: 'award', label: 'Bota de Oro', icon: Award },
  { id: 'results', label: 'Resultados', icon: ClipboardCheck },
  { id: 'predictions', label: 'Porras', icon: Check },
]

export function AdminDashboard({ snapshot, onRefresh, onSavePrediction, onSignOut }) {
  const [tab, setTab] = useState('settings')
  const [notice, setNotice] = useState(null)

  async function run(action, successMessage) {
    setNotice(null)
    try {
      await action()
      setNotice({ message: successMessage, error: false })
      await onRefresh()
    } catch (error) {
      setNotice({ message: error.message || 'No se pudo guardar el cambio', error: true })
    }
  }

  const panelProps = { snapshot, run }

  return (
    <main className="dashboard-shell admin-shell">
      <header className="dashboard-topbar">
        <div className="brand-lockup brand-lockup--dark">
          <span className="brand-monogram">PE</span>
          <span><strong>Porra Ezpeleta</strong><small>Administracion</small></span>
        </div>
        <div className="dashboard-user">
          <span><small>Organizacion</small><strong>{snapshot.viewer.display_name}</strong></span>
          <button className="icon-button icon-button--light" type="button" onClick={onSignOut} aria-label="Cerrar sesion" title="Cerrar sesión"><LogOut size={19} /></button>
        </div>
      </header>
      <div className="admin-layout">
        <nav className="admin-nav" aria-label="Administracion">
          {ADMIN_TABS.map((item) => {
            const Icon = item.icon
            return (
              <button className={tab === item.id ? 'active' : ''} type="button" onClick={() => setTab(item.id)} key={item.id}>
                <Icon size={18} /><span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <section className="admin-content">
          {notice && <div className={`notice${notice.error ? ' error' : ''}`}>{notice.message}</div>}
          {tab === 'settings' && <SettingsPanel {...panelProps} />}
          {tab === 'participants' && <ParticipantsPanel {...panelProps} />}
          {tab === 'teams' && <TeamsPanel {...panelProps} />}
          {tab === 'groups' && <GroupsPanel {...panelProps} />}
          {tab === 'bracket' && <BracketPanel {...panelProps} />}
          {tab === 'award' && <AwardPanel {...panelProps} />}
          {tab === 'results' && <ResultsPanel {...panelProps} />}
          {tab === 'predictions' && (
            <PredictionsPanel
              {...panelProps}
              onSavePrediction={async (...args) => {
                await onSavePrediction(...args)
                setNotice({ message: 'Porra actualizada', error: false })
              }}
            />
          )}
        </section>
      </div>
    </main>
  )
}

function PanelHeader({ eyebrow, title, description, action }) {
  return (
    <header className="panel-heading">
      <div><p className="section-kicker">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>
      {action}
    </header>
  )
}

function SettingsPanel({ snapshot, run }) {
  const [form, setForm] = useState({
    name: snapshot.competition.name,
    landing_mode: snapshot.competition.landing_mode,
    winner_name: snapshot.competition.winner_name,
    prediction_deadline: toDateTimeInput(snapshot.competition.prediction_deadline),
    max_participants: snapshot.competition.max_participants,
    wildcard_count: snapshot.competition.wildcard_count,
    scoring: { ...DEFAULT_SCORING, ...(snapshot.competition.scoring || {}) },
  })
  const [access, setAccess] = useState({
    loading: true,
    enabled: false,
    hasPassword: false,
    password: '',
    confirm: '',
    error: '',
  })
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    let active = true
    getMaintenanceConfig()
      .then((config) => {
        if (!active) return
        setAccess((current) => ({
          ...current,
          loading: false,
          enabled: config.enabled,
          hasPassword: config.hasPassword,
          error: '',
        }))
      })
      .catch((error) => {
        if (!active) return
        setAccess((current) => ({
          ...current,
          loading: false,
          error: error.message || 'No se pudo cargar el acceso de mantenimiento',
        }))
      })
    return () => { active = false }
  }, [])

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <>
      <PanelHeader eyebrow="General" title="Configuracion" description="Controla qué ve la familia y cuándo se cierra la porra." />
      <form className="admin-form" onSubmit={(event) => {
        event.preventDefault()
        if (access.password !== access.confirm) {
          run(() => Promise.reject(new Error('Las contraseñas no coinciden')), '')
          return
        }
        run(async () => {
          await saveRecord('competitions', {
            id: snapshot.competition.id,
            name: form.name.trim(),
            landing_mode: form.landing_mode,
            winner_name: form.winner_name.trim(),
            prediction_deadline: form.prediction_deadline ? new Date(form.prediction_deadline).toISOString() : null,
            max_participants: Number(form.max_participants),
            wildcard_count: Number(form.wildcard_count),
            scoring: Object.fromEntries(Object.entries(form.scoring).map(([key, value]) => [key, Number(value)])),
          })
          const nextAccess = await saveMaintenanceConfig({
            enabled: access.enabled,
            password: access.password,
          })
          setAccess((current) => ({
            ...current,
            enabled: nextAccess.enabled,
            hasPassword: nextAccess.hasPassword,
            password: '',
            confirm: '',
            error: '',
          }))
        }, 'Configuracion guardada')
      }}>
        <div className="form-section">
          <h2>Portada y campeonato</h2>
          <div className="form-grid">
            <label><span>Nombre del campeonato</span><input value={form.name} onChange={(event) => update('name', event.target.value)} required /></label>
            <label><span>Modo de portada</span><select value={form.landing_mode} onChange={(event) => update('landing_mode', event.target.value)}>{LANDING_MODES.map((mode) => <option value={mode.value} key={mode.value}>{mode.label}</option>)}</select></label>
            <label><span>Ganador mostrado</span><input value={form.winner_name} onChange={(event) => update('winner_name', event.target.value)} required /></label>
            <label><span>Fecha y hora limite</span><input type="datetime-local" value={form.prediction_deadline} onChange={(event) => update('prediction_deadline', event.target.value)} /></label>
            <label><span>Maximo de participantes</span><input type="number" min="1" max="16" value={form.max_participants} onChange={(event) => update('max_participants', event.target.value)} /></label>
            <label><span>Terceros que clasifican</span><input type="number" min="0" value={form.wildcard_count} onChange={(event) => update('wildcard_count', event.target.value)} /></label>
          </div>
        </div>
        <div className="form-section maintenance-admin-section">
          <div className="maintenance-admin-heading">
            <div>
              <span className="maintenance-admin-icon"><LockKeyhole size={18} /></span>
              <div><h2>Acceso de mantenimiento</h2><p>Bloquea toda la web con una contraseña mientras preparas la siguiente porra.</p></div>
            </div>
            <span className={`maintenance-admin-status${access.enabled ? ' active' : ''}`}>
              {access.enabled ? 'Activado' : 'Desactivado'}
            </span>
          </div>
          <label className="maintenance-toggle">
            <input
              type="checkbox"
              checked={access.enabled}
              onChange={(event) => setAccess((current) => ({ ...current, enabled: event.target.checked }))}
              disabled={access.loading}
            />
            <span className="maintenance-toggle__control" aria-hidden="true" />
            <span><strong>Solicitar contraseña para entrar</strong><small>Se aplicará a la portada, el acceso y los paneles.</small></span>
          </label>
          <div className="form-grid maintenance-password-grid">
            <label>
              <span>{access.hasPassword ? 'Cambiar contraseña' : 'Crear contraseña'}</span>
              <div className="admin-password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  minLength="6"
                  value={access.password}
                  onChange={(event) => setAccess((current) => ({ ...current, password: event.target.value }))}
                  placeholder={access.hasPassword ? 'Dejar en blanco para mantener' : 'Mínimo 6 caracteres'}
                  autoComplete="new-password"
                  required={access.enabled && !access.hasPassword}
                  disabled={access.loading}
                />
                <button
                  className="icon-button icon-button--light"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <label>
              <span>Repetir contraseña</span>
              <input
                type={showPassword ? 'text' : 'password'}
                minLength="6"
                value={access.confirm}
                onChange={(event) => setAccess((current) => ({ ...current, confirm: event.target.value }))}
                placeholder="Repite la nueva contraseña"
                autoComplete="new-password"
                required={Boolean(access.password)}
                disabled={access.loading || !access.password}
              />
            </label>
          </div>
          {access.error && <p className="form-error">{access.error}</p>}
        </div>
        <div className="form-section">
          <h2>Puntuacion</h2>
          <div className="score-input-grid">
            {Object.entries({ groupExact: 'Grupo: posicion exacta', groupQualified: 'Grupo: clasifica', round32: 'Dieciseisavos', round16: 'Octavos', quarterfinal: 'Cuartos', semifinal: 'Semifinales', thirdPlace: 'Tercer puesto', champion: 'Campeon', goldenBoot: 'Bota de Oro' }).map(([key, label]) => (
              <label key={key}><span>{label}</span><input type="number" min="0" value={form.scoring[key]} onChange={(event) => setForm((current) => ({ ...current, scoring: { ...current.scoring, [key]: event.target.value } }))} /></label>
            ))}
          </div>
        </div>
        <div className="form-actions"><button className="primary-button" type="submit" disabled={access.loading}><Save size={17} /> Guardar configuracion</button></div>
      </form>
    </>
  )
}

function ParticipantsPanel({ snapshot, run }) {
  const [newParticipant, setNewParticipant] = useState({ display_name: '', email: '', role: 'player' })
  const activeCount = snapshot.participants.filter((item) => item.active).length
  return (
    <>
      <PanelHeader eyebrow="Accesos" title="Participantes" description={`${activeCount} de ${snapshot.competition.max_participants} plazas ocupadas.`} />
      <form className="quick-add-form" onSubmit={(event) => {
        event.preventDefault()
        run(() => saveRecord('participants', { ...newParticipant, email: newParticipant.email.trim().toLowerCase(), display_name: newParticipant.display_name.trim(), competition_id: snapshot.competition.id, active: true }), 'Participante añadido')
        setNewParticipant({ display_name: '', email: '', role: 'player' })
      }}>
        <label><span>Nombre</span><input value={newParticipant.display_name} onChange={(event) => setNewParticipant((current) => ({ ...current, display_name: event.target.value }))} required /></label>
        <label><span>Correo</span><input type="email" value={newParticipant.email} onChange={(event) => setNewParticipant((current) => ({ ...current, email: event.target.value }))} required /></label>
        <label><span>Tipo</span><select value={newParticipant.role} onChange={(event) => setNewParticipant((current) => ({ ...current, role: event.target.value }))}><option value="player">Participante</option><option value="admin">Organizador</option></select></label>
        <button className="primary-button" type="submit" disabled={activeCount >= snapshot.competition.max_participants}><Plus size={17} /> Añadir</button>
      </form>
      <div className="data-list">
        {snapshot.participants.map((participant) => <ParticipantRow participant={participant} run={run} key={participant.id} />)}
      </div>
    </>
  )
}

function ParticipantRow({ participant, run }) {
  const [form, setForm] = useState(participant)
  return (
    <article className="data-row participant-row">
      <span className="person-avatar">{form.display_name.slice(0, 1).toUpperCase()}</span>
      <input aria-label="Nombre" value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} />
      <input aria-label="Correo" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      <select aria-label="Tipo" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="player">Participante</option><option value="admin">Organizador</option></select>
      <label className="toggle-label"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span>Activo</span></label>
      <button className="icon-button icon-button--light" type="button" title="Guardar" onClick={() => run(() => saveRecord('participants', { id: form.id, display_name: form.display_name.trim(), email: form.email.trim().toLowerCase(), role: form.role, active: form.active }), 'Participante actualizado')}><Save size={17} /></button>
      <button className="icon-button icon-button--danger" type="button" title="Eliminar" onClick={() => run(() => deleteRecord('participants', participant.id), 'Participante eliminado')}><Trash2 size={17} /></button>
    </article>
  )
}

function TeamsPanel({ snapshot, run }) {
  const [countryCode, setCountryCode] = useState('')
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)

  function selectCountry(code) {
    setCountryCode(code)
    setName(COUNTRIES.find((country) => country.code === code)?.name || '')
  }

  return (
    <>
      <PanelHeader eyebrow="Catalogo" title="Selecciones" description="Añade cualquier país y sustituye su bandera cuando lo necesites." />
      <form className="quick-add-form team-add-form" onSubmit={(event) => {
        event.preventDefault()
        run(async () => {
          const flagUrl = file ? await uploadImage('porra-assets', file, 'flags') : null
          await saveRecord('teams', { competition_id: snapshot.competition.id, name: name.trim(), country_code: countryCode || null, flag_url: flagUrl })
        }, 'Seleccion añadida')
        setCountryCode(''); setName(''); setFile(null); event.currentTarget.reset()
      }}>
        <label><span>País</span><select value={countryCode} onChange={(event) => selectCountry(event.target.value)}><option value="">Selección personalizada</option>{COUNTRIES.map((country) => <option value={country.code} key={country.code}>{countryFlag(country.code)} {country.name}</option>)}</select></label>
        <label><span>Nombre visible</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label><span>Bandera opcional</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <button className="primary-button" type="submit"><Plus size={17} /> Añadir</button>
      </form>
      <div className="team-admin-grid">
        {snapshot.teams.map((team) => <TeamAdminCard team={team} run={run} key={team.id} />)}
      </div>
    </>
  )
}

function TeamAdminCard({ team, run }) {
  const [form, setForm] = useState(team)
  const [file, setFile] = useState(null)
  return (
    <article className="team-admin-card team-admin-card--editable">
      <TeamFlag team={{ ...team, flag_url: form.flag_url }} size="large" />
      <div>
        <input aria-label="Nombre de la seleccion" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <select aria-label="Pais" value={form.country_code || ''} onChange={(event) => setForm({ ...form, country_code: event.target.value || null })}>
          <option value="">Personalizada</option>
          {COUNTRIES.map((country) => <option value={country.code} key={country.code}>{countryFlag(country.code)} {country.name}</option>)}
        </select>
      </div>
      <label className="file-icon-button" title="Cambiar bandera">
        <Upload size={17} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </label>
      <button className="icon-button icon-button--light" type="button" title="Guardar" onClick={() => run(async () => {
        const flagUrl = file ? await uploadImage('porra-assets', file, 'flags') : form.flag_url
        await saveRecord('teams', { id: form.id, name: form.name.trim(), country_code: form.country_code || null, flag_url: flagUrl || null })
      }, 'Seleccion actualizada')}><Save size={17} /></button>
      <button className="icon-button icon-button--danger" type="button" title="Eliminar" onClick={() => run(() => deleteRecord('teams', team.id), 'Seleccion eliminada')}><Trash2 size={17} /></button>
    </article>
  )
}

function GroupsPanel({ snapshot, run }) {
  const [name, setName] = useState('')
  return (
    <>
      <PanelHeader eyebrow="Primera fase" title="Grupos" description="Crea los grupos y asigna las selecciones participantes." />
      <form className="inline-add" onSubmit={(event) => {
        event.preventDefault()
        run(() => saveRecord('groups', { competition_id: snapshot.competition.id, name: name.trim(), sort_order: snapshot.groups.length + 1 }), 'Grupo creado')
        setName('')
      }}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Grupo A" required /><button className="primary-button" type="submit"><Plus size={17} /> Crear grupo</button></form>
      <div className="groups-admin-grid">
        {snapshot.groups.map((group) => <GroupAdminCard group={group} snapshot={snapshot} run={run} key={group.id} />)}
      </div>
    </>
  )
}

function GroupAdminCard({ group, snapshot, run }) {
  const [selected, setSelected] = useState(group.teams.map((team) => team.id))
  const [name, setName] = useState(group.name)
  const [sortOrder, setSortOrder] = useState(group.sort_order)
  return (
    <article className="group-admin-card">
      <header><div className="group-title-fields"><input aria-label="Nombre del grupo" value={name} onChange={(event) => setName(event.target.value)} /><input aria-label="Orden del grupo" type="number" min="1" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></div><button className="icon-button icon-button--danger" type="button" title="Eliminar grupo" onClick={() => run(() => deleteRecord('groups', group.id), 'Grupo eliminado')}><Trash2 size={16} /></button></header>
      <div className="team-check-list">
        {snapshot.teams.map((team) => {
          const checked = selected.includes(team.id)
          const assignedElsewhere = snapshot.groups.some((item) => item.id !== group.id && item.teams.some((entry) => entry.id === team.id))
          return <label className={assignedElsewhere && !checked ? 'disabled' : ''} key={team.id}><input type="checkbox" checked={checked} disabled={assignedElsewhere && !checked} onChange={(event) => setSelected((current) => event.target.checked ? [...current, team.id] : current.filter((id) => id !== team.id))} /><TeamFlag team={team} size="small" /><span>{team.name}</span></label>
        })}
      </div>
      <button className="secondary-button secondary-button--full" type="button" onClick={() => run(async () => {
        await saveRecord('groups', { id: group.id, name: name.trim(), sort_order: Number(sortOrder) })
        await replaceGroupTeams(snapshot.competition.id, group.id, selected)
      }, 'Grupo actualizado')}><Save size={16} /> Guardar grupo</button>
    </article>
  )
}

function BracketPanel({ snapshot, run }) {
  const [stage, setStage] = useState('round32')
  const matchesInStage = snapshot.matches.filter((match) => match.stage === stage)
  return (
    <>
      <PanelHeader eyebrow="Cuadro configurable" title="Eliminatorias" description="Cada casilla puede venir de un grupo, de los mejores terceros o de otro partido." action={<button className="primary-button" type="button" onClick={() => run(() => saveRecord('knockout_matches', { competition_id: snapshot.competition.id, stage, slot_index: matchesInStage.length + 1, label: '', home_source: {}, away_source: {} }), 'Partido creado')}><Plus size={17} /> Partido</button>} />
      <div className="stage-filter">{STAGES.map((item) => <button className={stage === item.value ? 'active' : ''} type="button" onClick={() => setStage(item.value)} key={item.value}>{item.label}</button>)}</div>
      <div className="match-admin-list">
        {matchesInStage.map((match) => <MatchAdminRow match={match} snapshot={snapshot} run={run} key={match.id} />)}
        {!matchesInStage.length && <EmptyNotice title="No hay partidos en esta ronda">Crea el primero con el botón superior.</EmptyNotice>}
      </div>
    </>
  )
}

function MatchAdminRow({ match, snapshot, run }) {
  const [form, setForm] = useState({ ...match, label: match.label || '' })
  const options = useMemo(() => buildSourceOptions(snapshot), [snapshot])
  return (
    <article className="match-admin-row">
      <span className="match-index">{match.slot_index}</span>
      <input aria-label="Nombre del partido" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Nombre opcional" />
      <label><span>Equipo superior</span><select value={JSON.stringify(form.home_source || {})} onChange={(event) => setForm({ ...form, home_source: JSON.parse(event.target.value) })}>{options.map((option) => <option value={JSON.stringify(option.value)} key={`h-${option.label}`}>{option.label}</option>)}</select></label>
      <label><span>Equipo inferior</span><select value={JSON.stringify(form.away_source || {})} onChange={(event) => setForm({ ...form, away_source: JSON.parse(event.target.value) })}>{options.map((option) => <option value={JSON.stringify(option.value)} key={`a-${option.label}`}>{option.label}</option>)}</select></label>
      <input aria-label="Fecha del partido" type="datetime-local" value={toDateTimeInput(form.match_date)} onChange={(event) => setForm({ ...form, match_date: event.target.value ? new Date(event.target.value).toISOString() : null })} />
      <button className="icon-button icon-button--light" type="button" title="Guardar" onClick={() => run(() => saveRecord('knockout_matches', { id: form.id, label: form.label, home_source: form.home_source, away_source: form.away_source, match_date: form.match_date }), 'Partido actualizado')}><Save size={17} /></button>
      <button className="icon-button icon-button--danger" type="button" title="Eliminar" onClick={() => run(() => deleteRecord('knockout_matches', match.id), 'Partido eliminado')}><Trash2 size={17} /></button>
    </article>
  )
}

function buildSourceOptions(snapshot) {
  const options = [{ label: 'Sin configurar', value: {} }]
  snapshot.groups.forEach((group) => {
    options.push({ label: `${group.name} · 1º`, value: { type: 'group_position', groupId: group.id, position: 1 } })
    options.push({ label: `${group.name} · 2º`, value: { type: 'group_position', groupId: group.id, position: 2 } })
  })
  Array.from({ length: snapshot.competition.wildcard_count }, (_, index) => index + 1).forEach((index) => options.push({ label: `Tercero clasificado ${index}`, value: { type: 'third_pool', index } }))
  snapshot.matches.forEach((match) => {
    options.push({ label: `Ganador · ${match.label || `${match.stage} ${match.slot_index}`}`, value: { type: 'match_winner', matchId: match.id } })
    if (match.stage === 'semifinal') options.push({ label: `Perdedor · ${match.label || `Semifinal ${match.slot_index}`}`, value: { type: 'match_loser', matchId: match.id } })
  })
  snapshot.teams.forEach((team) => options.push({ label: `Equipo fijo · ${team.name}`, value: { type: 'team', teamId: team.id } }))
  return options
}

function AwardPanel({ snapshot, run }) {
  const [name, setName] = useState('')
  const [teamId, setTeamId] = useState('')
  const [file, setFile] = useState(null)
  return (
    <>
      <PanelHeader eyebrow="Premio individual" title="Candidatos a Bota de Oro" description={`${snapshot.candidates.length} de 10 candidatos configurados.`} />
      <form className="quick-add-form" onSubmit={(event) => {
        event.preventDefault()
        run(async () => {
          const photoUrl = file ? await uploadImage('porra-assets', file, 'players') : null
          await saveRecord('award_candidates', { competition_id: snapshot.competition.id, name: name.trim(), team_id: teamId || null, photo_url: photoUrl, sort_order: snapshot.candidates.length + 1 })
        }, 'Candidato añadido')
        setName(''); setTeamId(''); setFile(null); event.currentTarget.reset()
      }}>
        <label><span>Jugador</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label><span>Seleccion</span><select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">Sin seleccion</option>{snapshot.teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
        <label><span>Fotografia opcional</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <button className="primary-button" type="submit" disabled={snapshot.candidates.length >= 10}><Plus size={17} /> Añadir</button>
      </form>
      <div className="candidate-admin-list">
        {snapshot.candidates.map((candidate) => <CandidateAdminRow candidate={candidate} snapshot={snapshot} run={run} key={candidate.id} />)}
      </div>
    </>
  )
}

function CandidateAdminRow({ candidate, snapshot, run }) {
  const [form, setForm] = useState(candidate)
  const [file, setFile] = useState(null)
  return (
    <article>
      {candidate.photo_url ? <img src={candidate.photo_url} alt="" /> : <span className="candidate-avatar">{candidate.name.slice(0, 1)}</span>}
      <div className="candidate-edit-fields">
        <input aria-label="Nombre del candidato" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <select aria-label="Seleccion del candidato" value={form.team_id || ''} onChange={(event) => setForm({ ...form, team_id: event.target.value || null })}><option value="">Sin seleccion</option>{snapshot.teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select>
      </div>
      <label className="file-icon-button" title="Cambiar fotografia"><Upload size={17} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
      <button className="icon-button icon-button--light" type="button" title="Guardar" onClick={() => run(async () => {
        const photoUrl = file ? await uploadImage('porra-assets', file, 'players') : form.photo_url
        await saveRecord('award_candidates', { id: form.id, name: form.name.trim(), team_id: form.team_id || null, photo_url: photoUrl || null, sort_order: form.sort_order })
      }, 'Candidato actualizado')}><Save size={17} /></button>
      <button className="icon-button icon-button--danger" type="button" title="Eliminar" onClick={() => run(() => deleteRecord('award_candidates', candidate.id), 'Candidato eliminado')}><Trash2 size={17} /></button>
    </article>
  )
}

function ResultsPanel({ snapshot, run }) {
  const [section, setSection] = useState('groups')
  return (
    <>
      <PanelHeader eyebrow="Marcador real" title="Resultados" description="Cada cambio recalcula automáticamente la clasificación pública." />
      <div className="stage-filter"><button className={section === 'groups' ? 'active' : ''} type="button" onClick={() => setSection('groups')}>Fase de grupos</button><button className={section === 'matches' ? 'active' : ''} type="button" onClick={() => setSection('matches')}>Eliminatorias</button><button className={section === 'award' ? 'active' : ''} type="button" onClick={() => setSection('award')}>Bota de Oro</button></div>
      {section === 'groups' && <ActualGroups snapshot={snapshot} run={run} />}
      {section === 'matches' && <ActualMatches snapshot={snapshot} run={run} />}
      {section === 'award' && <ActualAward snapshot={snapshot} run={run} />}
    </>
  )
}

function ActualGroups({ snapshot, run }) {
  return <div className="groups-grid">{snapshot.groups.map((group) => <article className="group-card group-card--editable" key={group.id}><header><strong>{group.name}</strong></header>{[1, 2, 3].map((position) => {
    const result = snapshot.actualGroupResults.find((item) => item.group_id === group.id && item.position === position)
    return <label className="group-select-row" key={position}><span>{position}º</span><select value={result?.team_id || ''} onChange={(event) => {
      const teamId = event.target.value
      if (!teamId && result) run(() => deleteRecord('actual_group_results', result.id), 'Resultado eliminado')
      else if (teamId) run(() => upsertRecord('actual_group_results', { id: result?.id, competition_id: snapshot.competition.id, group_id: group.id, position, team_id: teamId }, 'competition_id,group_id,position'), 'Resultado actualizado')
    }}><option value="">Pendiente</option>{group.teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
  })}</article>)}</div>
}

function ActualMatches({ snapshot, run }) {
  return <div className="actual-match-list">{snapshot.matches.map((match) => {
    const result = snapshot.actualMatchResults.find((item) => item.match_id === match.id)
    const stage = STAGES.find((item) => item.value === match.stage)
    return <label key={match.id}><span><small>{stage?.label}</small><strong>{match.label || `Partido ${match.slot_index}`}</strong></span><select value={result?.winner_team_id || ''} onChange={(event) => {
      const teamId = event.target.value
      if (!teamId && result) run(() => deleteRecord('actual_match_results', result.id), 'Resultado eliminado')
      else if (teamId) run(() => upsertRecord('actual_match_results', { id: result?.id, competition_id: snapshot.competition.id, match_id: match.id, winner_team_id: teamId }, 'competition_id,match_id'), 'Resultado actualizado')
    }}><option value="">Ganador pendiente</option>{snapshot.teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
  })}</div>
}

function ActualAward({ snapshot, run }) {
  const [candidateId, setCandidateId] = useState(snapshot.awardResult?.candidate_id || '')
  const [customName, setCustomName] = useState(snapshot.awardResult?.custom_name || '')
  return <form className="actual-award-form" onSubmit={(event) => { event.preventDefault(); run(() => upsertRecord('award_results', { id: snapshot.awardResult?.id, competition_id: snapshot.competition.id, candidate_id: candidateId || null, custom_name: candidateId ? null : customName.trim() }, 'competition_id'), 'Bota de Oro actualizada') }}><label><span>Candidato</span><select value={candidateId} onChange={(event) => setCandidateId(event.target.value)}><option value="">Otro jugador</option>{snapshot.candidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}</select></label>{!candidateId && <label><span>Nombre del ganador</span><input value={customName} onChange={(event) => setCustomName(event.target.value)} required /></label>}<button className="primary-button" type="submit"><Save size={17} /> Guardar resultado</button></form>
}

function PredictionsPanel({ snapshot, run, onSavePrediction }) {
  const [participantId, setParticipantId] = useState('')
  const prediction = participantId ? getPredictionForParticipant(snapshot, participantId) : null
  return (
    <>
      <PanelHeader eyebrow="Control de apuestas" title="Porras" description="Consulta, corrige o elimina cualquier porra." />
      <div className="prediction-admin-list">
        {snapshot.participants.filter((item) => item.active).map((participant) => {
          const current = getPredictionForParticipant(snapshot, participant.id)
          return <article className={participantId === participant.id ? 'selected' : ''} key={participant.id}><span className="person-avatar">{participant.display_name.slice(0, 1)}</span><div><strong>{participant.display_name}</strong><span>{current ? current.entry.status === 'submitted' ? 'Enviada' : 'Borrador' : 'Sin empezar'}</span></div><button className="secondary-button" type="button" onClick={() => setParticipantId(participant.id)}>Abrir</button>{current && <button className="icon-button icon-button--danger" type="button" title="Eliminar porra" onClick={() => run(() => deletePrediction(participant.id), 'Porra eliminada')}><Trash2 size={17} /></button>}</article>
        })}
      </div>
      {participantId && <div className="admin-prediction-editor"><PredictionEditor snapshot={snapshot} participantId={participantId} onSave={onSavePrediction} adminMode /></div>}
      {!participantId && <EmptyNotice title="Selecciona un participante">Su porra se abrirá aquí para revisarla.</EmptyNotice>}
    </>
  )
}

function toDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}
