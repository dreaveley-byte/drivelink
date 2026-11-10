import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/sms'

// Driver override: send a held automatic text right now, outside the normal
// sending hours. The pending row keeps who did it and when (sent_override_by /
// sent_override_at), and the text is logged in the customer thread.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { pendingId } = await req.json()
  if (!pendingId) return NextResponse.json({ error: 'Missing pendingId.' }, { status: 400 })

  // RLS: only visible for jobs this user can see; confirm they are the job's driver.
  const { data: msg } = await supabase
    .from('pending_customer_sms')
    .select('id, job_id, phone, body, sent_at, superseded_at')
    .eq('id', pendingId)
    .single()
  if (!msg) return NextResponse.json({ error: 'Message not found.' }, { status: 404 })
  if (msg.sent_at || msg.superseded_at) return NextResponse.json({ error: 'That message was already sent or replaced.' }, { status: 409 })

  const { data: job } = await supabase.from('jobs').select('driver_id').eq('id', msg.job_id).single()
  if (!job || job.driver_id !== user.id) return NextResponse.json({ error: 'Only the assigned driver can send this.' }, { status: 403 })

  const now = new Date().toISOString()
  const { data: claimed } = await supabase
    .from('pending_customer_sms')
    .update({ sent_at: now, sent_override_by: user.id, sent_override_at: now })
    .eq('id', msg.id)
    .is('sent_at', null)
    .is('superseded_at', null)
    .select('id')
  if (!claimed || claimed.length === 0) return NextResponse.json({ error: 'That message was already sent or replaced.' }, { status: 409 })

  const result = await sendSms(msg.phone, msg.body)
  if (!result.ok) {
    await supabase.from('pending_customer_sms').update({ sent_at: null, sent_override_by: null, sent_override_at: null }).eq('id', msg.id)
    return NextResponse.json({ error: 'The text could not be sent.' }, { status: 502 })
  }
  await supabase.from('customer_messages').insert({ job_id: msg.job_id, direction: 'to_customer', body: msg.body })
  return NextResponse.json({ ok: true })
}
