import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendOrQueueCustomerSms } from '@/lib/quietHours'
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
    .select('customer_phone, customer_full_name, tracking_token, vehicle_year, vehicle_make, vehicle_model, pickup_address, dropoff_address, driver_lat, driver_lng, package_description, scheduled_for, estimated_duration_minutes, job_types(name)')
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
  const link = `${protocol}://${host}/track/${job.tracking_token}`
  const vehicleDesc = [job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')
  const jobTypeName = Array.isArray(job.job_types) ? job.job_types[0]?.name : (job.job_types as { name: string } | null)?.name
  const isCustomerRide = jobTypeName === 'Customer Pick Up' || jobTypeName === 'Customer Drop Off'
  const isCourier = ['Courier / Package', 'Parts Delivery', 'Parts Pickup'].includes(jobTypeName ?? '')

  // Use the scheduled/booked dropoff time (scheduled_for + estimated
  // duration) rather than a live maps calculation from the driver's
  // current position - on long drives a driver sometimes leaves a day
  // early to break the drive up with an overnight stay, which would make
  // a live ETA from their current (far away) position wildly misleading.
  // The real, live ETA gets sent separately once the driver is genuinely
  // close (see the 45-minutes-away alert in driver-idle-check).
  let etaText = ''
  let destinationTimeZone: string | undefined
  if (job.scheduled_for && job.estimated_duration_minutes != null) {
    try {
      const dropoffTime = new Date(new Date(job.scheduled_for).getTime() + job.estimated_duration_minutes * 60 * 1000)
      const { data: distanceData } = await fetch(`${protocol}://${host}/api/distance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: [job.pickup_address, isCustomerRide ? job.pickup_address : job.dropoff_address] }),
      }).then((r) => r.json()).catch(() => ({ data: null }))
      destinationTimeZone = distanceData?.destinationTimeZone as string | undefined
      const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...(destinationTimeZone && { timeZone: destinationTimeZone }) })
      etaText = ` Estimated arrival: ${fmt(dropoffTime)}.`
    } catch {
      // ETA is a nice-to-have on top of the tracking link — don't block the text over it.
    }
  }

  const customerFirstName = firstNameProperCase(job.customer_full_name)
  const body = isCustomerRide
    ? `${customerFirstName ? `Hi ${customerFirstName}, y` : 'Y'}our driver is on the way!${etaText} Track here: ${link} — reply to this text anytime to reach your driver.`
    : isCourier
      ? `${customerFirstName ? `Hi ${customerFirstName}, y` : 'Y'}our package${job.package_description ? ` (${job.package_description})` : ''} has been picked up and is on its way!${etaText} Track here: ${link} — reply to this text anytime to reach your driver.`
      : `${customerFirstName ? `Hi ${customerFirstName}, y` : 'Y'}our ${vehicleDesc || 'vehicle'} is on its way!${etaText} Track the delivery here: ${link} — reply to this text anytime to reach your driver.`

  const result = await sendOrQueueCustomerSms(supabase, jobId, job.customer_phone, body, destinationTimeZone, false)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.error === 'not_configured' ? 501 : 502 })
  }
  if (result.queued) {
    return NextResponse.json({ ok: true, queued: true })
  }

  await supabase.from('customer_messages').insert({ job_id: jobId, direction: 'to_customer', body })

  return NextResponse.json({ ok: true })
}
