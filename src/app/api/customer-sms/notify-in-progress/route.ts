import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/sms'

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
    .select('customer_phone, customer_full_name, tracking_token, vehicle_year, vehicle_make, vehicle_model, dropoff_address, driver_lat, driver_lng, package_description, job_types(name)')
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
  const isCourier = jobTypeName === 'Courier / Package'

  // Give a real ETA window based on current traffic-aware drive time from the
  // driver's live position. Window runs from the raw ETA forward by a % buffer
  // of the drive time (configurable in Admin -> Pricing) — a flat window reads
  // wrong on short local hops and too tight on long hauls, so scaling by drive
  // time keeps it sensible either way. Must be shown in the DESTINATION's local
  // timezone, not the server's, or a Vancouver->local delivery reads hours off.
  let etaText = ''
  if (job.driver_lat != null && job.driver_lng != null) {
    try {
      const [distanceRes, settingsRes] = await Promise.all([
        fetch(`${protocol}://${host}/api/distance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses: [`${job.driver_lat},${job.driver_lng}`, job.dropoff_address] }),
        }),
        supabase.from('pricing_settings').select('eta_window_buffer_percent').eq('id', 1).single(),
      ])
      const distanceData = await distanceRes.json()
      const bufferPercent = settingsRes.data?.eta_window_buffer_percent
      if (distanceRes.ok && distanceData.durationMinutes != null) {
        const windowStart = new Date(Date.now() + distanceData.durationMinutes * 60 * 1000)
        const bufferMinutes = distanceData.durationMinutes * ((Number.isFinite(bufferPercent) ? bufferPercent : 20) / 100)
        const windowEnd = new Date(windowStart.getTime() + bufferMinutes * 60 * 1000)
        const tz = distanceData.destinationTimeZone as string | undefined
        const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...(tz && { timeZone: tz }) })
        etaText = ` Estimated arrival: ${fmt(windowStart)}–${fmt(windowEnd)}.`
      }
    } catch {
      // ETA is a nice-to-have on top of the tracking link — don't block the text over it.
    }
  }

  const body = isCustomerRide
    ? `${job.customer_full_name ? `Hi ${job.customer_full_name}, y` : 'Y'}our driver is on the way!${etaText} Track here: ${link} — reply to this text anytime to reach your driver.`
    : isCourier
      ? `${job.customer_full_name ? `Hi ${job.customer_full_name}, y` : 'Y'}our package${job.package_description ? ` (${job.package_description})` : ''} has been picked up and is on its way!${etaText} Track here: ${link} — reply to this text anytime to reach your driver.`
      : `${job.customer_full_name ? `Hi ${job.customer_full_name}, y` : 'Y'}our ${vehicleDesc || 'vehicle'} is on its way!${etaText} Track the delivery here: ${link} — reply to this text anytime to reach your driver.`

  const result = await sendSms(job.customer_phone, body)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.error === 'not_configured' ? 501 : 502 })
  }

  await supabase.from('customer_messages').insert({ job_id: jobId, direction: 'to_customer', body })

  return NextResponse.json({ ok: true })
}
