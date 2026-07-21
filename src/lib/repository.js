import { EMPTY_COMPETITION } from './constants.js'
import { isSupabaseConfigured, supabase } from './supabase.js'
import { normalizeSnapshot } from './tournament.js'

const MAINTENANCE_TOKEN_KEY = 'porra-ezpeleta-maintenance-access'

export const EMPTY_SNAPSHOT = normalizeSnapshot({
  competition: EMPTY_COMPETITION,
  participants: [],
  teams: [],
  groups: [],
  groupTeams: [],
  matches: [],
  candidates: [],
  entries: [],
  groupPredictions: [],
  knockoutPredictions: [],
  awardPredictions: [],
  actualGroupResults: [],
  actualMatchResults: [],
  awardResult: null,
})

export async function loadPublicSnapshot() {
  if (!isSupabaseConfigured) return { ...EMPTY_SNAPSHOT, configured: false }

  const { data: competition, error } = await supabase
    .from('competitions')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  if (!competition) return { ...EMPTY_SNAPSHOT, configured: true }

  const [
    participants,
    teams,
    groups,
    groupTeams,
    matches,
    candidates,
    entries,
    groupPredictions,
    knockoutPredictions,
    awardPredictions,
    actualGroupResults,
    actualMatchResults,
    awardResult,
  ] = await Promise.all([
    read('public_participants', (query) => query.eq('competition_id', competition.id)),
    read('teams', (query) => query.eq('competition_id', competition.id)),
    read('groups', (query) => query.eq('competition_id', competition.id)),
    read('group_teams', (query) => query.eq('competition_id', competition.id)),
    read('knockout_matches', (query) => query.eq('competition_id', competition.id)),
    read('award_candidates', (query) => query.eq('competition_id', competition.id)),
    read('prediction_entries', (query) => query.eq('competition_id', competition.id).eq('status', 'submitted')),
    read('group_predictions', (query) => query.eq('competition_id', competition.id)),
    read('knockout_predictions', (query) => query.eq('competition_id', competition.id)),
    read('award_predictions', (query) => query.eq('competition_id', competition.id)),
    read('actual_group_results', (query) => query.eq('competition_id', competition.id)),
    read('actual_match_results', (query) => query.eq('competition_id', competition.id)),
    readOne('award_results', (query) => query.eq('competition_id', competition.id)),
  ])

  return normalizeSnapshot({
    configured: true,
    competition,
    participants,
    teams,
    groups,
    groupTeams,
    matches,
    candidates,
    entries,
    groupPredictions,
    knockoutPredictions,
    awardPredictions,
    actualGroupResults,
    actualMatchResults,
    awardResult,
  })
}

export async function requestLoginCode(participantId) {
  ensureConfigured()
  const { data, error } = await supabase.functions.invoke('request-login', {
    body: { participantId },
  })
  if (error) throw new Error(await readFunctionError(error, 'No se pudo enviar el codigo'))
  if (!data?.email) throw new Error(data?.error || 'No se pudo enviar el codigo')
  return data.email
}

export async function checkMaintenanceAccess() {
  if (!isSupabaseConfigured) return { enabled: false, unlocked: true }
  const token = readMaintenanceToken()
  const { data, error } = await supabase.functions.invoke('maintenance-access', {
    body: { action: 'status', token },
  })
  if (error) throw new Error(await readFunctionError(error, 'No se pudo comprobar el acceso'))
  if (!data?.enabled) removeMaintenanceToken()
  return data
}

export async function unlockMaintenanceAccess(password) {
  ensureConfigured()
  const { data, error } = await supabase.functions.invoke('maintenance-access', {
    body: { action: 'verify', password },
  })
  if (error) throw new Error(await readFunctionError(error, 'No se pudo comprobar la contraseña'))
  if (data?.token) writeMaintenanceToken(data.token)
  return data
}

export async function getMaintenanceConfig() {
  ensureConfigured()
  const { data, error } = await supabase.functions.invoke('maintenance-access', {
    body: { action: 'admin-status' },
  })
  if (error) throw new Error(await readFunctionError(error, 'No se pudo cargar el acceso de mantenimiento'))
  return data
}

export async function saveMaintenanceConfig({ enabled, password }) {
  ensureConfigured()
  const { data, error } = await supabase.functions.invoke('maintenance-access', {
    body: { action: 'configure', enabled, password },
  })
  if (error) throw new Error(await readFunctionError(error, 'No se pudo guardar el acceso de mantenimiento'))
  if (data?.token) writeMaintenanceToken(data.token)
  else removeMaintenanceToken()
  return data
}

export async function verifyLoginCode(email, token) {
  ensureConfigured()
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
  return data.session
}

export async function getCurrentSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthChange(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut()
}

export async function loadAuthenticatedSnapshot(userId) {
  const base = await loadPublicSnapshot()
  if (!userId || !base.competition?.id) return { ...base, viewer: null }

  const { data: viewer, error } = await supabase
    .from('participants')
    .select('*')
    .eq('user_id', userId)
    .eq('competition_id', base.competition.id)
    .eq('active', true)
    .maybeSingle()
  if (error) throw error
  if (!viewer) return { ...base, viewer: null }

  if (viewer.role === 'admin') {
    return loadAdminSnapshot(base.competition.id, viewer)
  }

  const { data: ownEntry, error: ownError } = await supabase
    .from('prediction_entries')
    .select('*')
    .eq('competition_id', base.competition.id)
    .eq('participant_id', viewer.id)
    .maybeSingle()
  if (ownError) throw ownError

  if (!ownEntry || base.entries.some((entry) => entry.id === ownEntry.id)) {
    return { ...base, viewer }
  }

  const [groupPicks, knockoutPicks, awardPick] = await Promise.all([
    read('group_predictions', (query) => query.eq('entry_id', ownEntry.id)),
    read('knockout_predictions', (query) => query.eq('entry_id', ownEntry.id)),
    readOne('award_predictions', (query) => query.eq('entry_id', ownEntry.id)),
  ])

  return normalizeSnapshot({
    ...base,
    viewer,
    entries: [...base.entries, ownEntry],
    groupPredictions: [...base.groupPredictions, ...groupPicks],
    knockoutPredictions: [...base.knockoutPredictions, ...knockoutPicks],
    awardPredictions: awardPick ? [...base.awardPredictions, awardPick] : base.awardPredictions,
  })
}

async function loadAdminSnapshot(competitionId, viewer) {
  const [competition, participants, teams, groups, groupTeams, matches, candidates, entries, groupPredictions, knockoutPredictions, awardPredictions, actualGroupResults, actualMatchResults, awardResult] =
    await Promise.all([
      readOne('competitions', (query) => query.eq('id', competitionId)),
      read('participants', (query) => query.eq('competition_id', competitionId)),
      read('teams', (query) => query.eq('competition_id', competitionId)),
      read('groups', (query) => query.eq('competition_id', competitionId)),
      read('group_teams', (query) => query.eq('competition_id', competitionId)),
      read('knockout_matches', (query) => query.eq('competition_id', competitionId)),
      read('award_candidates', (query) => query.eq('competition_id', competitionId)),
      read('prediction_entries', (query) => query.eq('competition_id', competitionId)),
      read('group_predictions', (query) => query.eq('competition_id', competitionId)),
      read('knockout_predictions', (query) => query.eq('competition_id', competitionId)),
      read('award_predictions', (query) => query.eq('competition_id', competitionId)),
      read('actual_group_results', (query) => query.eq('competition_id', competitionId)),
      read('actual_match_results', (query) => query.eq('competition_id', competitionId)),
      readOne('award_results', (query) => query.eq('competition_id', competitionId)),
    ])

  return normalizeSnapshot({
    configured: true,
    viewer,
    competition,
    participants,
    teams,
    groups,
    groupTeams,
    matches,
    candidates,
    entries,
    groupPredictions,
    knockoutPredictions,
    awardPredictions,
    actualGroupResults,
    actualMatchResults,
    awardResult,
  })
}

export async function savePrediction(participantId, prediction, submit = false) {
  ensureConfigured()
  const { data, error } = await supabase.rpc('save_prediction', {
    p_participant_id: participantId,
    p_group_picks: prediction.groupPicks,
    p_knockout_picks: prediction.knockoutPicks,
    p_award_pick: prediction.awardPick || {},
    p_submit: submit,
  })
  if (error) throw error
  return data
}

export async function deletePrediction(participantId) {
  const { error } = await supabase.rpc('delete_prediction', { p_participant_id: participantId })
  if (error) throw error
}

export async function saveRecord(table, payload) {
  ensureConfigured()
  const query = payload.id
    ? supabase.from(table).update(payload).eq('id', payload.id).select().single()
    : supabase.from(table).insert(payload).select().single()
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function upsertRecord(table, payload, onConflict) {
  ensureConfigured()
  const { data, error } = await supabase.from(table).upsert(payload, { onConflict }).select().single()
  if (error) throw error
  return data
}

export async function deleteRecord(table, id) {
  ensureConfigured()
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

export async function replaceGroupTeams(competitionId, groupId, teamIds) {
  ensureConfigured()
  const { error: deleteError } = await supabase.from('group_teams').delete().eq('group_id', groupId)
  if (deleteError) throw deleteError
  if (!teamIds.length) return
  const { error } = await supabase.from('group_teams').insert(
    teamIds.map((teamId, index) => ({
      competition_id: competitionId,
      group_id: groupId,
      team_id: teamId,
      sort_order: index + 1,
    })),
  )
  if (error) throw error
}

export async function uploadImage(bucket, file, folder) {
  ensureConfigured()
  const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${folder}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

async function read(table, apply = (query) => query) {
  const { data, error } = await apply(supabase.from(table).select('*'))
  if (error) throw error
  return data || []
}

async function readOne(table, apply = (query) => query) {
  const { data, error } = await apply(supabase.from(table).select('*')).maybeSingle()
  if (error) throw error
  return data || null
}

function ensureConfigured() {
  if (!supabase) throw new Error('Supabase todavia no esta configurado')
}

async function readFunctionError(error, fallback) {
  try {
    const payload = await error.context?.json()
    return payload?.error || fallback
  } catch {
    return fallback
  }
}

function readMaintenanceToken() {
  try {
    return localStorage.getItem(MAINTENANCE_TOKEN_KEY)
  } catch {
    return null
  }
}

function writeMaintenanceToken(token) {
  try {
    localStorage.setItem(MAINTENANCE_TOKEN_KEY, token)
  } catch {
    // Private browsing can disable storage; access still works until reload.
  }
}

function removeMaintenanceToken() {
  try {
    localStorage.removeItem(MAINTENANCE_TOKEN_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
