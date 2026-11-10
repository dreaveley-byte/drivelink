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
    .select('customer_phone, customer_full_name, tracking_token, vehicle_year, vehicle_make, vehicle_model, pickup_address, dropoff_address, driver_lat, driver_lng, package_description, scheduled_for, estimated_duration_minutes, delivery_deadline, eta_sms_sent_at, job_types(name)')
    .eq('id', jobId)
    .single()

  if (!job) {
    return NextResponse.json({ error: 'Job not found or not accessible' }, { status: 404 })
  }
  if (!job.customer_phone) {
    return NextResponse.json({ ok: false, skipped: 'no_customer_phone' })
  }

  // One "on the way" text per job - going back and forth between statuses must not resend it.
  if (job.eta_sms_sent_at) {
    return NextResponse.json({ ok: true, skipped: 'already_sent' })
  }

  const host = req.headers.get('host')
  const protocol = host?.includes('localhost') ? 'http' : 'https'
  const link = `${protocol}://${host}/track/${job.tracking_token}`
  const vehicleDesc = [job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')
  const jobTypeName = Array.isArray(job.job_types) ? job.job_types[0]?.name : (job.job_types as { name: string } | null)?.name
  const isCustomerRide = jobTypeName === 'Customer Pick Up' || jobTypeName === 'Customer Drop Off'
  const isCourier = ['Courier / Package', 'Parts Delivery', 'Parts Pickup'].includes(jobTypeName ?? '')

  // Compute two independent estimates and use whichever lands LATER:
  // (1) the scheduled/booked time (scheduled_for + estimated duration) -
  //     needed because on long drives a driver sometimes leaves a day
  //     early to break the drive up with an overnight stay, which would
  //     make a live position-based ETA look unrealistically soon.
  // (2) a live, traffic-aware ETA from the driver's actual current
  //     position right now - needed because the scheduled estimate can
  //     itself be stale or wrong (e.g. if the job's estimated duration
  //     was miscalculated), and a live check catches that.
  // Taking the later of the two protects against both failure modes
  // rather than trusting either source blindly.
  //
  // Also critical: never format a time without an explicit, confirmed
  // timezone. If the timezone lookup fails for any reason, JS silently
  // falls back to the SERVER's own timezone (UTC on Vercel) instead of
  // the delivery's actual local time - on a same-province BC trip this
  // previously showed times roughly 7 hours later than reality, since it
  // was quietly displaying a UTC hour as if it were Pacific time.
  let etaText = ''
  let destinationTimeZone: string | undefined
  try {
    const [scheduledCallResult, liveCallResult] = await Promise.allSettled([
      job.scheduled_for && job.estimated_duration_minutes != null
        ? fetch(`${protocol}://${host}/api/distance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses: [job.pickup_address, isCustomerRide ? job.pickup_address : job.dropoff_address] }),
          }).then((r) => r.json())
        : Promise.resolve(null),
      job.driver_lat != null && job.driver_lng != null
        ? fetch(`${protocol}://${host}/api/distance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses: [`${job.driver_lat},${job.driver_lng}`, isCustomerRide ? job.pickup_address : job.dropoff_address] }),
          }).then((r) => r.json())
        : Promise.resolve(null),
    ])

    const scheduledData = scheduledCallResult.status === 'fulfilled' ? scheduledCallResult.value : null
    const liveData = liveCallResult.status === 'fulfilled' ? liveCallResult.value : null

    const scheduledTime =
      job.scheduled_for && job.estimated_duration_minutes != null
        ? new Date(new Date(job.scheduled_for).getTime() + job.estimated_duration_minutes * 60 * 1000)
        : null
    const liveTime =
      liveData?.durationMinutes != null ? new Date(Date.now() + liveData.durationMinutes * 60 * 1000) : null

    const candidates = [scheduledTime, liveTime].filter((t): t is Date => t != null)
    if (candidates.length > 0) {
      const etaTime = new Date(Math.max(...candidates.map((t) => t.getTime())))
      // Prefer whichever call actually returned a timezone; fall back to a
      // sensible BC default rather than ever letting the display fall
      // through to the server's own (UTC) timezone unlabelled.
      destinationTimeZone = (scheduledData?.destinationTimeZone || liveData?.destinationTimeZone || 'America/Vancouver') as string
      const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: destinationTimeZone })
      etaText = ` Estimated arrival: ${fmt(etaTime)}.`
    }
  } catch {
    // ETA is a nice-to-have on top of the tracking link — don't block the text over it.
  }

  // ORIGINAL ETA = the delivery date/time the dealer booked (delivery_deadline),
  // shown as a two-hour window starting at that time (e.g. 2:00-4:00 PM). It is
  // never replaced just because the calculator disagrees. A delay text is added
  // only when the live Google ETA lands AFTER the end of that window.
  let windowText = ''
  let delayText = ''
  let notifiedEta: Date | null = null
  if (job.delivery_deadline) {
    // Ask Google first - besides the live ETA it tells us the drop-off's own time zone.
    let live: { durationMinutes?: number; destinationTimeZone?: string } | null = null
    try {
      const dest = isCustomerRide ? job.pickup_address : job.dropoff_address
      const origin = job.driver_lat != null && job.driver_lng != null ? `${job.driver_lat},${job.driver_lng}` : job.pickup_address
      live = await fetch(`${protocol}://${host}/api/distance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: [origin, dest] }),
      }).then((r) => r.json())
    } catch {
      live = null
    }
    destinationTimeZone = destinationTimeZone || live?.destinationTimeZone
    const tz = destinationTimeZone || 'America/Vancouver'
    const start = new Date(job.delivery_deadline)
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
    const dateFmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz })
    const timeFmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })
    windowText = ` Scheduled delivery: ${dateFmt(start)}, between ${timeFmt(start)} and ${timeFmt(end)}.`
    if (live?.durationMinutes != null) {
      const liveEta = new Date(Date.now() + live.durationMinutes * 60 * 1000)
      if (liveEta.getTime() > end.getTime()) {
        notifiedEta = liveEta
        const sameDay = dateFmt(liveEta) === dateFmt(start)
        delayText = ` We're running behind - new estimated arrival: ${sameDay ? '' : `${dateFmt(liveEta)}, `}${timeFmt(liveEta)}. Sorry for the delay.`
      }
    }
  }

  const customerFirstName = firstNameProperCase(job.customer_full_name)
  if (windowText) etaText = `${windowText}${delayText}`
  const body = isCustomerRide
    ? `${customerFirstName ? `Hi ${customerFirstName}, y` : 'Y'}our driver is on the way!${etaText} Track here: ${link} — reply to this text anytime to reach your driver.`
    : isCourier
      ? `${customerFirstName ? `Hi ${customerFirstName}, y` : 'Y'}our package${job.package_description ? ` (${job.package_description})` : ''} has been picked up and is on its way!${etaText} Track here: ${link} — reply to this text anytime to reach your driver.`
      : `${customerFirstName ? `Hi ${customerFirstName}, y` : 'Y'}our ${vehicleDesc || 'vehicle'} is on its way!${etaText} Track the delivery here: ${link} — reply to this text anytime to reach your driver.`

  const result = await sendOrQueueCustomerSms(supabase, jobId, job.customer_phone, body, destinationTimeZone, false, notifiedEta ? 'delay' : 'eta')
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.error === 'not_configured' ? 501 : 502 })
  }
  // Mark sent/held so this text is never duplicated; remember the ETA we told them.
  await supabase
    .from('jobs')
    .update({
      eta_sms_sent_at: new Date().toISOString(),
      ...(notifiedEta ? { delay_sms_sent_at: new Date().toISOString(), last_notified_eta: notifiedEta.toISOString() } : {}),
    })
    .eq('id', jobId)
  if (result.queued) {
    return NextResponse.json({ ok: true, queued: true })
  }

  await supabase.from('customer_messages').insert({ job_id: jobId, direction: 'to_customer', body })

  return NextResponse.json({ ok: true })
}
