import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/sms'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { jobId, body } = await req.json()
  if (!jobId || !body) {
    return NextResponse.json({ error: 'Missing jobId or body' }, { status: 400 })
  }

  // RLS on this select already restricts to job participants (driver/org/admin)
  const { data: job } = await supabase
    .from('jobs')
    .select('customer_phone, customer_full_name')
    .eq('id', jobId)
    .single()

  if (!job) {
    return NextResponse.json({ error: 'Job not found or not accessible' }, { status: 404 })
  }
  if (!job.customer_phone) {
    return NextResponse.json({ error: 'No customer phone number on file for this job.' }, { status: 400 })
  }

  const result = await sendSms(job.customer_phone, body)
  if (!result.ok) {
    if (result.error === 'not_configured') {
      return NextResponse.json({ error: 'SMS sending is not configured yet.' }, { status: 501 })
    }
    return NextResponse.json({ error: 'Could not send the text.' }, { status: 502 })
  }

  // Log it so it shows in the in-app thread too (RLS: only 'to_customer' inserts allowed here)
  const { error: insertError } = await supabase
    .from('customer_messages')
    .insert({ job_id: jobId, direction: 'to_customer', body })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
