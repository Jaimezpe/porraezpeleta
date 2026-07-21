import { DEFAULT_SCORING, STAGES } from './constants.js'

export function normalizeSnapshot(snapshot = {}) {
  const groups = (snapshot.groups || [])
    .map((group) => ({
      ...group,
      teams: (snapshot.groupTeams || [])
        .filter((item) => item.group_id === group.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => snapshot.teams?.find((team) => team.id === item.team_id))
        .filter(Boolean),
    }))
    .sort((a, b) => a.sort_order - b.sort_order)

  return {
    ...snapshot,
    groups,
    teams: (snapshot.teams || []).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    matches: (snapshot.matches || []).sort((a, b) => {
      const stageA = STAGES.findIndex((stage) => stage.value === a.stage)
      const stageB = STAGES.findIndex((stage) => stage.value === b.stage)
      return stageA - stageB || a.slot_index - b.slot_index
    }),
    participants: (snapshot.participants || []).sort((a, b) =>
      a.display_name.localeCompare(b.display_name, 'es'),
    ),
  }
}

export function resolveSource(source, context) {
  if (!source?.type) return null

  if (source.type === 'team') {
    return context.teams.find((team) => team.id === source.teamId) || null
  }

  if (source.type === 'group_position') {
    const pick = context.groupPicks.find(
      (item) => item.group_id === source.groupId && item.position === Number(source.position),
    )
    return context.teams.find((team) => team.id === pick?.team_id) || null
  }

  if (source.type === 'third_pool') {
    const thirdPicks = context.groups
      .map((group) =>
        context.groupPicks.find((item) => item.group_id === group.id && item.position === 3),
      )
      .filter((item) => item?.team_id)
    const pick = thirdPicks[Number(source.index || 1) - 1]
    return context.teams.find((team) => team.id === pick?.team_id) || null
  }

  if (source.type === 'match_winner' || source.type === 'match_loser') {
    const sourceMatch = context.matches.find((match) => match.id === source.matchId)
    if (!sourceMatch) return null
    const winnerId = context.knockoutPicks.find((item) => item.match_id === source.matchId)?.winner_team_id
    if (source.type === 'match_winner') {
      return context.teams.find((team) => team.id === winnerId) || null
    }
    const sourceTeams = resolveMatchTeams(sourceMatch, context)
    return sourceTeams.find((team) => team && team.id !== winnerId) || null
  }

  return null
}

export function resolveMatchTeams(match, context) {
  return [resolveSource(match.home_source, context), resolveSource(match.away_source, context)]
}

export function invalidateDependentPicks(matches, knockoutPicks, context) {
  let current = [...knockoutPicks]
  let changed = true

  while (changed) {
    changed = false
    current = current.filter((pick) => {
      const match = matches.find((item) => item.id === pick.match_id)
      if (!match) return false
      const allowed = resolveMatchTeams(match, { ...context, knockoutPicks: current })
        .filter(Boolean)
        .map((team) => team.id)
      const valid = allowed.includes(pick.winner_team_id)
      if (!valid) changed = true
      return valid
    })
  }

  return current
}

export function calculateLeaderboard(snapshot) {
  const scoring = { ...DEFAULT_SCORING, ...(snapshot.competition?.scoring || {}) }
  const actualGroup = snapshot.actualGroupResults || []
  const actualMatches = snapshot.actualMatchResults || []
  const awardResult = snapshot.awardResult

  return (snapshot.entries || [])
    .filter((entry) => entry.status === 'submitted')
    .map((entry) => {
      const groupPicks = (snapshot.groupPredictions || []).filter(
        (pick) => pick.entry_id === entry.id,
      )
      const knockoutPicks = (snapshot.knockoutPredictions || []).filter(
        (pick) => pick.entry_id === entry.id,
      )
      const awardPick = (snapshot.awardPredictions || []).find(
        (pick) => pick.entry_id === entry.id,
      )
      const breakdown = {
        group: 0,
        exactGroupPositions: 0,
        round32: 0,
        round16: 0,
        quarterfinal: 0,
        semifinal: 0,
        thirdPlace: 0,
        champion: 0,
        goldenBoot: 0,
      }

      groupPicks.forEach((pick) => {
        const exact = actualGroup.find(
          (result) => result.group_id === pick.group_id && result.position === pick.position,
        )
        if (exact?.team_id === pick.team_id) {
          breakdown.group += scoring.groupExact
          breakdown.exactGroupPositions += 1
          return
        }
        if (actualGroup.some((result) => result.group_id === pick.group_id && result.team_id === pick.team_id)) {
          breakdown.group += scoring.groupQualified
        }
      })

      knockoutPicks.forEach((pick) => {
        const match = snapshot.matches.find((item) => item.id === pick.match_id)
        const result = actualMatches.find((item) => item.match_id === pick.match_id)
        if (!match || result?.winner_team_id !== pick.winner_team_id) return

        if (match.stage === 'third_place') breakdown.thirdPlace += scoring.thirdPlace
        else if (match.stage === 'final') breakdown.champion += scoring.champion
        else breakdown[match.stage] += scoring[match.stage] || 0
      })

      const pickedAward = normalizeAwardName(awardPick, snapshot.candidates)
      const actualAward = normalizeAwardName(awardResult, snapshot.candidates)
      if (pickedAward && actualAward && pickedAward === actualAward) {
        breakdown.goldenBoot = scoring.goldenBoot
      }

      const participant = snapshot.participants.find((item) => item.id === entry.participant_id)
      const points = Object.entries(breakdown)
        .filter(([key]) => key !== 'exactGroupPositions')
        .reduce((total, [, value]) => total + value, 0)

      return {
        entryId: entry.id,
        participantId: entry.participant_id,
        name: participant?.display_name || 'Participante',
        points,
        breakdown,
        championCorrect: breakdown.champion > 0,
        goldenBootCorrect: breakdown.goldenBoot > 0,
        thirdCorrect: breakdown.thirdPlace > 0,
      }
    })
    .sort(compareScores)
    .map((row, index) => ({ ...row, position: index + 1 }))
}

function compareScores(a, b) {
  return (
    b.points - a.points ||
    Number(b.championCorrect) - Number(a.championCorrect) ||
    Number(b.goldenBootCorrect) - Number(a.goldenBootCorrect) ||
    Number(b.thirdCorrect) - Number(a.thirdCorrect) ||
    b.breakdown.semifinal - a.breakdown.semifinal ||
    b.breakdown.quarterfinal - a.breakdown.quarterfinal ||
    b.breakdown.round16 - a.breakdown.round16 ||
    b.breakdown.round32 - a.breakdown.round32 ||
    b.breakdown.exactGroupPositions - a.breakdown.exactGroupPositions ||
    a.name.localeCompare(b.name, 'es')
  )
}

function normalizeAwardName(award, candidates = []) {
  if (!award) return ''
  const candidate = candidates.find((item) => item.id === award.candidate_id)
  return String(candidate?.name || award.custom_name || award.winner_name || '')
    .trim()
    .toLocaleLowerCase('es')
}

export function getPredictionForParticipant(snapshot, participantId) {
  const entry = snapshot.entries?.find((item) => item.participant_id === participantId)
  if (!entry) return null
  return {
    entry,
    groupPicks: snapshot.groupPredictions.filter((item) => item.entry_id === entry.id),
    knockoutPicks: snapshot.knockoutPredictions.filter((item) => item.entry_id === entry.id),
    awardPick: snapshot.awardPredictions.find((item) => item.entry_id === entry.id) || null,
  }
}
