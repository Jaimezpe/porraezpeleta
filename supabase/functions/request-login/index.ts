import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { participantId } = await request.json()
    if (!participantId) return json({ error: 'Selecciona un participante' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id, email, active')
      .eq('id', participantId)
      .eq('active', true)
      .maybeSingle()

    if (participantError || !participant) return json({ error: 'Participante no encontrado' }, 404)

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('login_requests')
      .select('id', { count: 'exact', head: true })
      .eq('participant_id', participant.id)
      .gte('requested_at', fiveMinutesAgo)

    if ((count || 0) >= 3) {
      return json({ error: 'Espera unos minutos antes de pedir otro codigo' }, 429)
    }

    await supabase.from('login_requests').insert({ participant_id: participant.id })

    const { data: listedUsers, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    if (listError) throw listError

    let authUser = listedUsers.users.find(
      (user) => user.email?.toLowerCase() === participant.email.toLowerCase(),
    )

    if (!authUser) {
      const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
        email: participant.email,
        email_confirm: true,
      })
      if (createError) throw createError
      authUser = createdUser.user
    }

    if (authUser) {
      await supabase.from('participants').update({ user_id: authUser.id }).eq('id', participant.id)
    }

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: participant.email,
      options: {
        shouldCreateUser: false,
        data: { participant_id: participant.id },
      },
    })

    if (authError) throw authError
    return json({ email: participant.email })
  } catch (error) {
    console.error(error)
    return json({ error: 'No se pudo enviar el codigo' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
