const FIELD_ALIASES = {
  position: ['puesto', 'posicion', 'position', 'pos', 'rank', 'clasificacion'],
  name: ['nombre', 'participante', 'jugador', 'equipo', 'familia', 'name'],
  points: ['puntos', 'pts', 'points', 'total', 'marcador'],
  hits: ['aciertos', 'correctos', 'hits'],
}

export async function getLeaderboardData() {
  const source = (import.meta.env.VITE_DATA_SOURCE || 'csv').toLowerCase()

  try {
    if (source === 'excel' || source === 'csv') {
      return {
        players: await loadCsvLeaderboard(),
        sourceLabel: source === 'excel' ? 'Excel CSV' : 'CSV',
        updatedAt: new Date(),
      }
    }

    if (source === 'google_sheets_csv' || source === 'sheets_csv') {
      return {
        players: await loadGoogleSheetsCsvLeaderboard(),
        sourceLabel: 'Google Sheets',
        updatedAt: new Date(),
      }
    }

    if (source === 'google_sheets_api' || source === 'sheets_api') {
      return {
        players: await loadGoogleSheetsApiLeaderboard(),
        sourceLabel: 'Google Sheets API',
        updatedAt: new Date(),
      }
    }

    if (source === 'json') {
      return {
        players: await loadJsonLeaderboard(),
        sourceLabel: 'API JSON',
        updatedAt: new Date(),
      }
    }

    throw new Error(`Fuente de datos no soportada: ${source}`)
  } catch (error) {
    return {
      players: [],
      sourceLabel: 'Sin conectar',
      updatedAt: null,
      error: error instanceof Error ? error.message : 'No se pudieron cargar los datos',
    }
  }
}

async function loadCsvLeaderboard() {
  const path = import.meta.env.VITE_EXCEL_CSV_PATH || '/porra.csv'
  const response = await fetch(path)

  if (!response.ok) {
    throw new Error(`No se pudo leer el CSV desde ${path}`)
  }

  return normalizeRows(csvToObjects(await response.text()))
}

async function loadGoogleSheetsCsvLeaderboard() {
  const response = await fetch(getGoogleSheetsCsvUrl())

  if (!response.ok) {
    throw new Error('No se pudo leer Google Sheets como CSV')
  }

  return normalizeRows(csvToObjects(await response.text()))
}

async function loadGoogleSheetsApiLeaderboard() {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY
  const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID
  const range = import.meta.env.VITE_GOOGLE_SHEET_RANGE || 'Clasificacion!A:D'

  if (!apiKey || !sheetId) {
    throw new Error('Faltan VITE_GOOGLE_SHEETS_API_KEY o VITE_GOOGLE_SHEET_ID')
  }

  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`)
  url.searchParams.set('key', apiKey)

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('No se pudo leer Google Sheets API')
  }

  const payload = await response.json()
  return normalizeRows(tableToObjects(payload.values || []))
}

async function loadJsonLeaderboard() {
  const url = import.meta.env.VITE_LEADERBOARD_JSON_URL

  if (!url) {
    throw new Error('Falta VITE_LEADERBOARD_JSON_URL')
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('No se pudo leer la API JSON')
  }

  const payload = await response.json()
  return normalizeRows(Array.isArray(payload) ? payload : payload.players || [])
}

function getGoogleSheetsCsvUrl() {
  const explicitUrl = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL

  if (explicitUrl) {
    return explicitUrl
  }

  const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID
  const gid = import.meta.env.VITE_GOOGLE_SHEET_GID || '0'

  if (!sheetId) {
    throw new Error('Falta VITE_GOOGLE_SHEET_CSV_URL o VITE_GOOGLE_SHEET_ID')
  }

  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
}

function normalizeRows(rows) {
  const mapped = rows
    .map((row, index) => {
      const rawPosition = toNumber(readField(row, 'position'))
      const points = toNumber(readField(row, 'points')) || 0
      const hits = toNumber(readField(row, 'hits'))
      const name = String(readField(row, 'name') || '').trim()

      return {
        position: rawPosition || index + 1,
        rawPosition,
        name,
        points,
        hits,
      }
    })
    .filter((player) => player.name)

  const hasPositions = mapped.some((player) => player.rawPosition)
  const sorted = mapped.sort((a, b) => {
    if (hasPositions) {
      return (a.rawPosition || Number.MAX_SAFE_INTEGER) - (b.rawPosition || Number.MAX_SAFE_INTEGER)
    }

    return b.points - a.points
  })

  return sorted.map((player, index) => ({
    position: player.rawPosition || index + 1,
    name: player.name,
    points: player.points,
    hits: player.hits,
  }))
}

function readField(row, fieldName) {
  const aliases = FIELD_ALIASES[fieldName]
  const key = Object.keys(row).find((candidate) => aliases.includes(normalizeKey(candidate)))
  return key ? row[key] : ''
}

function normalizeKey(key) {
  return String(key)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function toNumber(value) {
  const normalized = String(value ?? '').replace(',', '.').trim()
  const number = Number(normalized)
  return Number.isFinite(number) ? number : undefined
}

function tableToObjects(values) {
  const [headers = [], ...rows] = values
  return rows.map((row) =>
    headers.reduce((record, header, index) => {
      record[header] = row[index] ?? ''
      return record
    }, {}),
  )
}

function csvToObjects(csv) {
  const [headers = [], ...rows] = parseCsv(csv)
  return rows.map((row) =>
    headers.reduce((record, header, index) => {
      record[header] = row[index] ?? ''
      return record
    }, {}),
  )
}

function parseCsv(csv) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    const next = csv[index + 1]

    if (char === '"' && quoted && next === '"') {
      field += '"'
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === ',' && !quoted) {
      row.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') {
        index += 1
      }

      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }

    field += char
  }

  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((entries) => entries.some((entry) => String(entry).trim()))
}
