import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/sms'

// Called right after a job is created — checks whether it actually qualifies
// for the review hold (distance and/or flight trigger, same logic as the RLS
// policies use) and texts admin if so, so they know to go claim/review it
// during the hold window rather than finding out only once it's already live.
export async function POST(req: NextRequest) {
  const { jobId } = await req.json()
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: job } = await supabase
    .from('jobs')
    .select('estimated_distance_km, one_way_flight_back, vehicle_year, vehicle_make, vehicle_model, package_description, pickup_address, dropoff_address, organizations(name)')
    .eq('id', jobId)
    .single()

  if (!job) {
    return NextResponse.json({ ok: true, notified: false })
  }

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('admin_alert_phone, job_review_hold_minutes, job_review_hold_min_distance_km, job_review_hold_trigger_on_flight')
    .eq('id', 1)
    .single()

  if (!settings?.admin_alert_phone) {
    return NextResponse.json({ ok: true, notified: false })
  }

  const qualifiesByDistance = job.estimated_distance_km != null && job.estimated_distance_km >= (settings.job_review_hold_min_distance_km ?? 400)
  const qualifiesByFlight = !!settings.job_review_hold_trigger_on_flight && !!job.one_way_flight_back
  if (!qualifiesByDistance && !qualifiesByFlight) {
    return NextResponse.json({ ok: true, notified: false })
  }

  const orgInfo = Array.isArray(job.organizations) ? job.organizations[0] : job.organizations
  const vehicleDesc = job.package_description || [job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')
  const reason = qualifiesByFlight ? 'flight-back leg' : `${Math.round(job.estimated_distance_km ?? 0)}km`
  const holdMinutes = settings.job_review_hold_minutes ?? 5

  const body =
    `\ud83c\udd95 New job on hold for review (${reason}): ${vehicleDesc || 'delivery'} for ${orgInfo?.name ?? 'a dealer'}, ` +
    `${job.pickup_address} \u2192 ${job.dropoff_address}. Goes live to drivers in ${holdMinutes} min unless claimed and reviewed.`

  const result = await sendSms(settings.admin_alert_phone, body)

  return NextResponse.json({ ok: true, notified: result.ok })
}
