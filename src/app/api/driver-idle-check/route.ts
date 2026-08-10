import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/sms'

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// Called opportunistically each time the driver's location pings (while the
// job is in progress) — checks whether they've stayed within a small radius
// for the configured idle window, and if so, alerts admin once per idle spell.
// There's no reliable free-tier cron on Vercel to do this on a fixed schedule,
// so it piggybacks on the pings that already happen every 15s while the
// driver's app is open and sharing location.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { jobId, lat, lng } = await req.json()
  if (!jobId || lat == null || lng == null) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: job } = await supabase
    .from('jobs')
    .select('status, idle_since, idle_alert_sent_at, vehicle_year, vehicle_make, vehicle_model, package_description, pickup_address, dropoff_address, driver:driver_id(full_name)')
    .eq('id', jobId)
    .single()

  if (!job || job.status !== 'in_progress') {
    if (job && (job.idle_since || job.idle_alert_sent_at)) {
      await supabase.from('jobs').update({ idle_since: null, idle_alert_sent_at: null }).eq('id', jobId)
    }
    return NextResponse.json({ ok: true, idle: false })
  }

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('idle_alert_minutes, admin_alert_phone')
    .eq('id', 1)
    .single()
  const idleMinutes = settings?.idle_alert_minutes ?? 20

  const { data: oldPing } = await supabase
    .from('job_location_pings')
    .select('lat, lng')
    .eq('job_id', jobId)
    .lte('created_at', new Date(Date.now() - idleMinutes * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!oldPing) {
    return NextResponse.json({ ok: true, idle: false })
  }

  const distanceKm = haversineKm(lat, lng, oldPing.lat, oldPing.lng)
  const isIdle = distanceKm < 0.1

  if (!isIdle) {
    if (job.idle_since || job.idle_alert_sent_at) {
      await supabase.from('jobs').update({ idle_since: null, idle_alert_sent_at: null }).eq('id', jobId)
    }
    return NextResponse.json({ ok: true, idle: false })
  }

  if (!job.idle_since) {
    await supabase.from('jobs').update({ idle_since: new Date(Date.now() - idleMinutes * 60 * 1000).toISOString() }).eq('id', jobId)
  }

  if (job.idle_alert_sent_at) {
    return NextResponse.json({ ok: true, idle: true, alreadyNotified: true })
  }

  if (settings?.admin_alert_phone) {
    const driverInfo = Array.isArray(job.driver) ? job.driver[0] : job.driver
    const vehicleDesc = job.package_description || [job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')
    const body = `⚠️ ${driverInfo?.full_name || 'A driver'} has been idle for ${idleMinutes}+ min on the ${vehicleDesc || 'delivery'} (${job.pickup_address} → ${job.dropoff_address}). Worth checking in.`
    const result = await sendSms(settings.admin_alert_phone, body)
    if (result.ok) {
      await supabase.from('jobs').update({ idle_alert_sent_at: new Date().toISOString() }).eq('id', jobId)
    }
  }

  return NextResponse.json({ ok: true, idle: true })
}
