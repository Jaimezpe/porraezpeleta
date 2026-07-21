import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const encoder = new TextEncoder()
const passwordIterations = 210_000
const accessDurationSeconds = 30 * 24 * 60 * 60

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await request.json().catch(() => ({}))
    const action = body.action || 'status'
    const service = serviceClient()
    const settings = await getSettings(service)

    if (action === 'status') {
      const unlocked = !settings.enabled || await isValidToken(body.token, settings)
      return json({ enabled: settings.enabled, unlocked })
    }

    if (action === 'verify') {
      if (!settings.enabled) return json({ enabled: false, unlocked: true, token: null })
      const password = String(body.password || '')
      if (!password) return json({ error: 'Escribe la contraseña' }, 400)

      const fingerprint = await requestFingerprint(request)
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { count, error: countError } = await service
        .from('maintenance_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('fingerprint', fingerprint)
        .gte('attempted_at', since)
      if (countError) throw countError
      if ((count || 0) >= 8) return json({ error: 'Demasiados intentos. Espera unos minutos' }, 429)

      const valid = await verifyPassword(password, settings.password_salt, settings.password_hash)
      if (!valid) {
        await service.from('maintenance_attempts').insert({ fingerprint })
        return json({ error: 'La contraseña no es correcta' }, 401)
      }

      await service.from('maintenance_attempts').delete().eq('fingerprint', fingerprint)
      return json({ enabled: true, unlocked: true, token: await createToken(settings.version) })
    }

    const userId = await requireAdmin(request, service)

    if (action === 'admin-status') {
      return json({ enabled: settings.enabled, hasPassword: Boolean(settings.password_hash) })
    }

    if (action === 'configure') {
      const enabled = Boolean(body.enabled)
      const password = String(body.password || '')
      if (password && password.length < 6) {
        return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400)
      }
      if (enabled && !password && !settings.password_hash) {
        return json({ error: 'Crea una contraseña antes de activar el acceso' }, 400)
      }

      const passwordData = password ? await hashPassword(password) : null
      const nextVersion = settings.version + 1
      const update = {
        enabled,
        version: nextVersion,
        updated_at: new Date().toISOString(),
        updated_by: userId,
        ...(passwordData ? {
          password_hash: passwordData.hash,
          password_salt: passwordData.salt,
        } : {}),
      }

      const { error } = await service.from('maintenance_settings').update(update).eq('id', true)
      if (error) throw error

      return json({
        enabled,
        hasPassword: Boolean(passwordData || settings.password_hash),
        token: enabled ? await createToken(nextVersion) : null,
      })
    }

    return json({ error: 'Accion no valida' }, 400)
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : 'No se pudo gestionar el acceso'
    const status = message === 'Sin permiso' ? 403 : 500
    return json({ error: status === 403 ? message : 'No se pudo gestionar el acceso' }, status)
  }
})

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function getSettings(service: ReturnType<typeof createClient>) {
  const { data, error } = await service
    .from('maintenance_settings')
    .select('enabled, password_hash, password_salt, version')
    .eq('id', true)
    .single()
  if (error) throw error
  return data
}

async function requireAdmin(request: Request, service: ReturnType<typeof createClient>) {
  const authorization = request.headers.get('Authorization') || ''
  if (!authorization) throw new Error('Sin permiso')

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    },
  )
  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) throw new Error('Sin permiso')

  const { data: admin } = await service
    .from('participants')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .eq('active', true)
    .maybeSingle()
  if (!admin) throw new Error('Sin permiso')
  return user.id
}

async function hashPassword(password: string) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const hashBytes = await derivePassword(password, saltBytes)
  return { salt: toBase64Url(saltBytes), hash: toBase64Url(hashBytes) }
}

async function verifyPassword(password: string, salt: string | null, expectedHash: string | null) {
  if (!salt || !expectedHash) return false
  const actualHash = await derivePassword(password, fromBase64Url(salt))
  return constantTimeEqual(actualHash, fromBase64Url(expectedHash))
}

async function derivePassword(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: passwordIterations },
    material,
    256,
  )
  return new Uint8Array(bits)
}

async function createToken(version: number) {
  const expiresAt = Math.floor(Date.now() / 1000) + accessDurationSeconds
  const payload = `${version}:${expiresAt}`
  return `${version}.${expiresAt}.${await sign(payload)}`
}

async function isValidToken(token: unknown, settings: { version: number }) {
  if (typeof token !== 'string') return false
  const [versionText, expiresText, signature] = token.split('.')
  const version = Number(versionText)
  const expiresAt = Number(expiresText)
  if (!signature || version !== settings.version || !Number.isFinite(expiresAt)) return false
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false
  const expected = await sign(`${version}:${expiresAt}`)
  return constantTimeEqual(encoder.encode(signature), encoder.encode(expected))
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))))
}

async function requestFingerprint(request: Request) {
  const address = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || 'unknown'
  const agent = request.headers.get('user-agent') || 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${address}|${agent}`))
  return toBase64Url(new Uint8Array(digest))
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
