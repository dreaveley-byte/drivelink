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
    .select('customer_phone, customer_full_name, tracking_token, vehicle_year, vehicle_make, vehicle_model, dropoff_address, driver_lat, driver_lng')
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

  // Give a real ETA window based on current traffic-aware drive time from the
  // driver's live position — a single point estimate reads as more precise than
  // it is, so widen it into a realistic 2-hour arrival window instead.
  let etaText = ''
  if (job.driver_lat != null && job.driver_lng != null) {
    try {
      const distanceRes = await fetch(`${protocol}://${host}/api/distance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: [`${job.driver_lat},${job.driver_lng}`, job.dropoff_address] }),
      })
      const distanceData = await distanceRes.json()
      if (distanceRes.ok && distanceData.durationMinutes != null) {
        const etaCenter = new Date(Date.now() + distanceData.durationMinutes * 60 * 1000)
        const windowStart = new Date(etaCenter.getTime() - 60 * 60 * 1000)
        const windowEnd = new Date(etaCenter.getTime() + 60 * 60 * 1000)
        const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        etaText = ` Estimated arrival: ${fmt(windowStart)}–${fmt(windowEnd)}.`
      }
    } catch {
      // ETA is a nice-to-have on top of the tracking link — don't block the text over it.
    }
  }

  const body = `${job.customer_full_name ? `Hi ${job.customer_full_name}, y` : 'Y'}our ${vehicleDesc || 'vehicle'} is on its way!${etaText} Track the delivery here: ${link} — reply to this text anytime to reach your driver.`

  const result = await sendSms(job.customer_phone, body)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.error === 'not_configured' ? 501 : 502 })
  }

  await supabase.from('customer_messages').insert({ job_id: jobId, direction: 'to_customer', body })

  return NextResponse.json({ ok: true })
}
