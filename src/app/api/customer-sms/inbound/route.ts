import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notifyDrivers } from '@/lib/pushNotifications'

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

    // Tell the job's driver a customer text arrived (push + in-app), so they
    // don't have to keep opening the conversation to check.
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) {
        const admin = createServiceClient(url, key)
        const last10 = from.replace(/\D/g, '').slice(-10)
        const { data: jobs } = await admin
          .from('jobs')
          .select('id, driver_id, customer_phone')
          .in('status', ['assigned', 'picked_up', 'in_progress', 'delivered'])
          .not('driver_id', 'is', null)
          .not('customer_phone', 'is', null)
        for (const j of (jobs ?? []).filter((j) => (j.customer_phone ?? '').replace(/\D/g, '').slice(-10) === last10)) {
          await notifyDrivers([j.driver_id as string], { kind: 'customer_sms', title: 'Customer text message', body: body.slice(0, 140), jobId: j.id })
        }
      }
    } catch {
      // never fail Twilio's webhook over a notification problem
    }
  }

  return new NextResponse('<Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}
