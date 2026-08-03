import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Sends the team-invite link by text via Twilio. Returns 501 until Twilio
// credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER) are
// added to the environment — the invite link itself still works either way,
// this just automates handing it to the person.
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

  // Twilio requires E.164 format (e.g. +16045551234). Normalize common
  // North American formats like "(604) 555-1234" or "6045551234".
  const digits = phone.replace(/\D/g, '')
  let toNumber: string
  if (phone.trim().startsWith('+')) {
    toNumber = phone.trim()
  } else if (digits.length === 10) {
    toNumber = `+1${digits}`
  } else if (digits.length === 11 && digits.startsWith('1')) {
    toNumber = `+${digits}`
  } else {
    return NextResponse.json({ error: `"${phone}" doesn't look like a valid phone number.` }, { status: 400 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: 'SMS sending is not configured yet.' }, { status: 501 })
  }

  const body = `${fullName ? `Hi ${fullName}, y` : 'Y'}ou've been invited to join Drivflo. Tap to finish setting up your account: ${link}`

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: toNumber, From: fromNumber, Body: body }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error('Twilio send failed:', detail)
    let message = 'Could not send the text.'
    try {
      const parsed = JSON.parse(detail)
      if (parsed.message) message = parsed.message
    } catch {
      // Twilio didn't return JSON — fall back to the generic message
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
