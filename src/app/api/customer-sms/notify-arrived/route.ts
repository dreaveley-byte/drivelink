import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/sms'
import { firstNameProperCase } from '@/lib/formatName'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { jobId } = await req.json()
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })
  }

  // RLS already restricts this to the job's own driver/dealer/admin
  const { data: job } = await supabase
    .from('jobs')
    .select('customer_phone, customer_full_name, vehicle_year, vehicle_make, vehicle_model, id_verification_token, driver:driver_id(full_name), job_types(name), package_description')
    .eq('id', jobId)
    .single()

  if (!job) {
    return NextResponse.json({ error: 'Job not found or not accessible' }, { status: 404 })
  }
  if (!job.customer_phone) {
    return NextResponse.json({ ok: false, skipped: 'no_customer_phone' })
  }

  const host = req.headers.get('host')
  const protocol = host?.includes('localhost') ? 'http' : 'https'
  const link = `${protocol}://${host}/verify/${job.id_verification_token}`
  const vehicleDesc = [job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')
  const driverInfo = Array.isArray(job.driver) ? job.driver[0] : job.driver
  const driverName = firstNameProperCase(driverInfo?.full_name) || 'your driver'
  const customerFirstName = firstNameProperCase(job.customer_full_name)
  const jobTypeName = Array.isArray(job.job_types) ? job.job_types[0]?.name : (job.job_types as { name: string } | null)?.name
  const isCustomerRide = jobTypeName === 'Customer Pick Up' || jobTypeName === 'Customer Drop Off'
  const isCourier = jobTypeName === 'Courier / Package'

  const body = isCustomerRide
    ? `${customerFirstName ? `${customerFirstName}, y` : 'Y'}our driver ${driverName} has arrived!`
    : isCourier
      ? `${customerFirstName ? `${customerFirstName}, y` : 'Y'}our package${job.package_description ? ` (${job.package_description})` : ''} has arrived! Please meet ${driverName} outside.`
      : `${customerFirstName ? `${customerFirstName}, y` : 'Y'}our new ${vehicleDesc || 'vehicle'} has arrived! ` +
        `Please meet ${driverName} outside to get your keys. Before we hand over the keys we ask that you verify your ` +
        `identity one more time — please complete these few simple steps. Click the link below now to verify: ${link}`

  const result = await sendSms(job.customer_phone, body)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.error === 'not_configured' ? 501 : 502 })
  }

  await supabase.from('customer_messages').insert({ job_id: jobId, direction: 'to_customer', body })
  await supabase.from('jobs').update({ id_verification_sent_at: new Date().toISOString() }).eq('id', jobId)

  // Thank-you + rate-your-driver follow-up, sent right after the arrival
  // notice. Reuses the same tracking link the customer already has - the
  // rating form lives right there on that page.
  const { data: trackingRow } = await supabase.from('jobs').select('tracking_token').eq('id', jobId).single()
  if (trackingRow?.tracking_token) {
    const trackingLink = `${protocol}://${host}/track/${trackingRow.tracking_token}`
    const thankYouBody =
      `${customerFirstName ? `Thanks ${customerFirstName} f` : 'F'}or using Drivflo! ` +
      `How did ${driverName} do? Leave a quick rating here: ${trackingLink}`
    const thankYouResult = await sendSms(job.customer_phone, thankYouBody)
    if (thankYouResult.ok) {
      await supabase.from('customer_messages').insert({ job_id: jobId, direction: 'to_customer', body: thankYouBody })
    }
  }

  return NextResponse.json({ ok: true })
}
