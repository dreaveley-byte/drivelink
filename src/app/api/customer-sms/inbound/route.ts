import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'

// Verifies the request actually came from Twilio using their signature scheme:
// HMAC-SHA1 of (full URL + sorted form params) using the auth token as the key.
function isValidTwilioRequest(url: string, params: Record<string, string>, signature: string | null, authToken: string) {
  if (!signature) return false
  const sortedKeys = Object.keys(params).sort()
  let data = url
  for (const key of sortedKeys) {
    data += key + params[key]
  }
  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64')
  return expected === signature
}

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const formData = await req.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => {
    params[key] = value.toString()
  })

  if (authToken) {
    const signature = req.headers.get('x-twilio-signature')
    const fullUrl = req.url
    if (!isValidTwilioRequest(fullUrl, params, signature, authToken)) {
      return new NextResponse('Invalid signature', { status: 403 })
    }
  }

  const from = params.From
  const body = params.Body
  const messageSid = params.MessageSid

  if (from && body) {
    const supabase = await createClient()
    await supabase.rpc('record_inbound_customer_message', {
      p_phone: from,
      p_body: body,
      p_twilio_sid: messageSid ?? null,
    })
  }

  return new NextResponse('<Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}
