import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'MÃ©todo nÃ£o permitido.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'AutenticaÃ§Ã£o necessÃ¡ria.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !publishableKey || !serviceRoleKey) return json({ error: 'ConfiguraÃ§Ã£o segura do Supabase ausente.' }, 500)

  const { email, redirectTo } = await request.json().catch(() => ({}))
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalizedEmail || !redirectTo || typeof redirectTo !== 'string') return json({ error: 'E-mail e URL de retorno sÃ£o obrigatÃ³rios.' }, 400)

  // Primeiro valida o JWT e cria o convite respeitando as regras de famÃ­lia do
  // banco. A chave administrativa sÃ³ Ã© usada depois disso, para enviar e-mail.
  const caller = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } })
  const { data: callerData, error: callerError } = await caller.auth.getUser()
  if (callerError || !callerData.user) return json({ error: 'SessÃ£o invÃ¡lida.' }, 401)

  const { data: invitationRows, error: invitationError } = await caller.rpc('create_family_invitation', { p_email: normalizedEmail })
  if (invitationError) return json({ error: invitationError.message }, 400)
  const invitation = invitationRows?.[0]
  if (!invitation?.token) return json({ error: 'NÃ£o foi possÃ­vel criar o convite.' }, 500)

  const inviteUrl = new URL(redirectTo)
  inviteUrl.searchParams.set('family-invite', invitation.token)
  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } })
  const { error: sendError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: inviteUrl.toString(),
    data: { family_invitation: true },
  })

  // O endpoint administrativo convida somente quem ainda nÃ£o possui uma conta.
  // Para quem jÃ¡ possui, o navegador envia um magic link em seguida; clicar nele
  // confirma a identidade antes da pessoa aceitar o convite na interface.
  if (sendError) {
    if (/already.*(registered|exists)|already.*user/i.test(sendError.message || '')) return json({ token: invitation.token, existingUser: true })
    return json({ error: sendError.message || 'NÃ£o foi possÃ­vel enviar o convite.' }, 400)
  }
  return json({ token: invitation.token, existingUser: false })
})
