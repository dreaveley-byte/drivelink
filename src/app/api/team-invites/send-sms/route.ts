import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/sms'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { phone, link, fullName } = await req.json()
  if (!phone || !link) {
    return NextResponse.json({ error: 'Missing phone or link' }, { status: 400 })
  }

  const body = `${fullName ? `Hi ${fullName}, y` : 'Y'}ou've been invited to join Drivflo. Tap to finish setting up your account: ${link}`

  const result = await sendSms(phone, body)
  if (!result.ok) {
    if (result.error === 'not_configured') {
      return NextResponse.json({ error: 'SMS sending is not configured yet.' }, { status: 501 })
    }
    if (result.error === 'invalid_number') {
      return NextResponse.json({ error: `"${phone}" doesn't look like a valid phone number.` }, { status: 400 })
    }
    return NextResponse.json({ error: 'Could not send the text.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
