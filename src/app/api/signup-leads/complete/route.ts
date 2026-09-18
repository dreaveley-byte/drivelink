import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set — signup completion cannot work without it.')
    return null
  }
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  const { type, leadId, token, password } = await req.json()
  if ((type !== 'driver' && type !== 'dealer') || !leadId || !token || !password || password.length < 8) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const supabase = serviceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Account setup is not available right now. Please try again shortly.' }, { status: 500 })
  }

  const checkFn = type === 'driver' ? 'check_driver_signup_setup_token' : 'check_dealer_signup_setup_token'
  const { data: checkData } = await supabase.rpc(checkFn, { p_lead_id: leadId, p_token: token })
  const email = checkData?.[0]?.email
  if (!email) {
    return NextResponse.json({ error: 'This link has expired or already been used. Please start your application again.' }, { status: 400 })
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { intended_role: type },
  })

  if (createError) {
    // Most likely: this email already has an account (e.g. a second
    // attempt after already completing setup once).
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  const markFn = type === 'driver' ? 'mark_driver_setup_token_used' : 'mark_dealer_setup_token_used'
  await supabase.rpc(markFn, { p_lead_id: leadId })

  return NextResponse.json({ ok: true, userId: created.user?.id })
}
