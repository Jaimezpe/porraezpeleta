export const LANDING_MODES = [
  { value: 'winner', label: 'Ganador anterior' },
  { value: 'predictions', label: 'Recepcion de porras' },
  { value: 'live', label: 'Clasificacion en directo' },
]

export const STAGES = [
  { value: 'round32', label: 'Dieciseisavos', pointsKey: 'round32' },
  { value: 'round16', label: 'Octavos', pointsKey: 'round16' },
  { value: 'quarterfinal', label: 'Cuartos', pointsKey: 'quarterfinal' },
  { value: 'semifinal', label: 'Semifinales', pointsKey: 'semifinal' },
  { value: 'third_place', label: 'Tercer puesto', pointsKey: 'thirdPlace' },
  { value: 'final', label: 'Final', pointsKey: 'champion' },
]

export const DEFAULT_SCORING = {
  groupExact: 2,
  groupQualified: 1,
  round32: 4,
  round16: 7,
  quarterfinal: 10,
  semifinal: 12,
  thirdPlace: 12,
  champion: 20,
  goldenBoot: 20,
}

export const EMPTY_COMPETITION = {
  id: null,
  name: 'Porra Ezpeleta',
  landing_mode: 'winner',
  winner_name: 'Jaime',
  prediction_deadline: null,
  max_participants: 16,
  wildcard_count: 8,
  scoring: DEFAULT_SCORING,
  is_active: true,
}

export const COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AL', 'AM', 'AO', 'AR', 'AT', 'AU', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF',
  'BG', 'BH', 'BI', 'BJ', 'BN', 'BO', 'BR', 'BS', 'BT', 'BW', 'BY', 'BZ', 'CA', 'CD', 'CF', 'CG',
  'CH', 'CI', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO',
  'DZ', 'EC', 'EE', 'EG', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FM', 'FR', 'GA', 'GB', 'GD', 'GE', 'GH',
  'GM', 'GN', 'GQ', 'GR', 'GT', 'GW', 'GY', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IN', 'IQ',
  'IR', 'IS', 'IT', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KZ',
  'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MG',
  'MH', 'MK', 'ML', 'MM', 'MN', 'MR', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NE',
  'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NZ', 'OM', 'PA', 'PE', 'PG', 'PH', 'PK', 'PL', 'PS', 'PT',
  'PW', 'PY', 'QA', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SI', 'SK', 'SL',
  'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SY', 'SZ', 'TD', 'TG', 'TH', 'TJ', 'TL', 'TM', 'TN',
  'TO', 'TR', 'TT', 'TV', 'TZ', 'UA', 'UG', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VN', 'VU', 'WS',
  'XK', 'YE', 'ZA', 'ZM', 'ZW', 'AI', 'AS', 'AW', 'BM', 'CK', 'CW', 'FO', 'GI', 'GU', 'HK', 'KY',
  'MO', 'MS', 'NC', 'PF', 'PR', 'TC', 'TW', 'VG', 'VI',
]

const displayNames = new Intl.DisplayNames(['es'], { type: 'region' })

const FOOTBALL_COUNTRIES = [
  { code: 'GB-ENG', name: 'Inglaterra' },
  { code: 'GB-NIR', name: 'Irlanda del Norte' },
  { code: 'GB-SCT', name: 'Escocia' },
  { code: 'GB-WLS', name: 'Gales' },
]

export const COUNTRIES = [
  ...COUNTRY_CODES.map((code) => ({ code, name: displayNames.of(code) || code })),
  ...FOOTBALL_COUNTRIES,
].sort((a, b) => a.name.localeCompare(b.name, 'es'))

const subdivisionFlags = {
  'GB-ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'GB-NIR': '🇬🇧',
  'GB-SCT': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'GB-WLS': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
}

export function countryFlag(code) {
  if (subdivisionFlags[code]) return subdivisionFlags[code]
  if (!code || code.length !== 2) return ''
  return code
    .toUpperCase()
    .split('')
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join('')
}
