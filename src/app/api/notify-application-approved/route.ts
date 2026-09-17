import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

// Looks up the applicant's email through the auth admin API rather than a
// table column, since dealer_applications has no email column of its own
// (the dealer flow only ever collects email as part of the account itself)
// - this way one route correctly handles both application types.
function serviceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set — approval emails cannot be looked up without it.')
    return null
  }
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  const { applicationType, userId } = await req.json()
  if ((applicationType !== 'driver' && applicationType !== 'dealer') || !userId) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const supabase = serviceClient()
  if (!supabase) {
    return NextResponse.json({ ok: true, notified: false })
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)
  const email = userData?.user?.email
  if (userError || !email) {
    return NextResponse.json({ ok: true, notified: false })
  }

  const who = applicationType === 'driver' ? 'driver' : 'dealer'
  const subject = 'Your Drivflo application has been approved'
  const html = `
    <h2>You're approved!</h2>
    <p>Good news — your ${who} application with Drivflo has been reviewed and approved.</p>
    <p>You can log in now to get started: <a href="https://drivflo.ca/login">drivflo.ca/login</a></p>
    <p style="color:#888;font-size:13px;">If you have any questions, just reply to this email.</p>
  `
  const result = await sendEmail(email, subject, html)

  return NextResponse.json({ ok: true, notified: result.ok })
}
