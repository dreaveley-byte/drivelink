import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
}

export async function POST(req: NextRequest) {
  const { type, leadId, origin } = await req.json()
  if ((type !== 'driver' && type !== 'dealer') || !leadId) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const supabase = anonClient()
  const rpcName = type === 'driver' ? 'create_driver_signup_setup_token' : 'create_dealer_signup_setup_token'
  const { data, error } = await supabase.rpc(rpcName, { p_lead_id: leadId })
  const row = data?.[0]

  if (error || !row?.token) {
    return NextResponse.json({ error: 'Could not start account setup. Please verify your phone again.' }, { status: 400 })
  }

  const email = type === 'driver' ? row.email : row.contact_email
  const name = type === 'driver' ? row.full_name : row.contact_full_name
  const applyPath = type === 'driver' ? '/driver/apply' : '/dashboard/apply'
  const link = `${origin}${applyPath}?lead=${leadId}&token=${row.token}`

  const result = await sendEmail(
    email,
    'Set your Drivflo password',
    `
      <h2>You're confirmed, ${name || 'there'} 👋</h2>
      <p>Click below to set your password and finish setting up your Drivflo account.</p>
      <p><a href="${link}">Set your password</a></p>
      <p style="color:#888;font-size:13px;">This link is valid for 24 hours. If you didn't request this, you can safely ignore this email.</p>
    `
  )

  return NextResponse.json({ ok: true, sent: result.ok })
}
