import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/sms'
import { firstNameProperCase } from '@/lib/formatName'

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
    .select('status, idle_since, idle_alert_sent_at, vehicle_year, vehicle_make, vehicle_model, package_description, pickup_address, dropoff_address, customer_phone, customer_full_name, pickup_lat, pickup_lng, two_min_away_alert_sent_at, arrived_at_pickup_alert_sent_at, tracking_token, job_types(name), driver:driver_id(full_name)')
    .eq('id', jobId)
    .single()

  const jobTypeName = job ? (Array.isArray(job.job_types) ? job.job_types[0]?.name : (job.job_types as { name: string } | null)?.name) : null
  const isCustomerRide = jobTypeName === 'Customer Pick Up' || jobTypeName === 'Customer Drop Off'

  // Proximity-to-pickup alerts for customer rides - "picked up" for these
  // means the driver is actively en route to get the customer (see the
  // tracking-map fix), so this is the window where "2 minutes away" and
  // "driver has arrived" alerts make sense, distinct from the idle-check
  // logic below which only applies to in_progress.
  if (job && isCustomerRide && job.status === 'picked_up' && job.customer_phone) {
    let pickupLat = job.pickup_lat
    let pickupLng = job.pickup_lng

    if (pickupLat == null || pickupLng == null) {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY
      if (apiKey) {
        try {
          const geoRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(job.pickup_address)}&key=${apiKey}`
          )
          const geoData = await geoRes.json()
          const loc = geoData?.results?.[0]?.geometry?.location
          if (loc) {
            pickupLat = loc.lat
            pickupLng = loc.lng
            await supabase.from('jobs').update({ pickup_lat: pickupLat, pickup_lng: pickupLng }).eq('id', jobId)
          }
        } catch {
          // If geocoding fails here, just skip proximity alerts for this
          // ping - it'll retry on the next one rather than blocking anything.
        }
      }
    }

    if (pickupLat != null && pickupLng != null) {
      const distanceKm = haversineKm(lat, lng, pickupLat, pickupLng)
      // Rough city-driving estimate rather than a full routing call on every
      // single ping (which would be both slow and expensive) - about 1.2km
      // is a reasonable stand-in for "2 minutes away" at typical city speeds.
      const driverInfo = Array.isArray(job.driver) ? job.driver[0] : job.driver
      const driverFirstName = firstNameProperCase((driverInfo as { full_name: string } | null)?.full_name)
      const customerFirstName = firstNameProperCase(job.customer_full_name)

      if (distanceKm <= 0.15 && !job.arrived_at_pickup_alert_sent_at) {
        // Atomic claim: only proceed if this request is the one that actually
        // flips the flag from null - if two pings arrive close together and
        // both read it as null before either finishes writing, only one of
        // them gets a non-empty result back here, which is what was causing
        // the alert to occasionally send twice.
        const { data: claimed } = await supabase
          .from('jobs')
          .update({ arrived_at_pickup_alert_sent_at: new Date().toISOString() })
          .eq('id', jobId)
          .is('arrived_at_pickup_alert_sent_at', null)
          .select('id')
        if (claimed && claimed.length > 0) {
          const body = `${customerFirstName ? `${customerFirstName}, y` : 'Y'}our driver ${driverFirstName} has arrived!`
          await sendSms(job.customer_phone, body)
        }
      } else if (distanceKm <= 1.2 && !job.two_min_away_alert_sent_at) {
        const { data: claimed } = await supabase
          .from('jobs')
          .update({ two_min_away_alert_sent_at: new Date().toISOString() })
          .eq('id', jobId)
          .is('two_min_away_alert_sent_at', null)
          .select('id')
        if (claimed && claimed.length > 0) {
          const body = `${customerFirstName ? `${customerFirstName}, y` : 'Y'}our driver ${driverFirstName} is about 2 minutes away!`
          await sendSms(job.customer_phone, body)
        }
      }
    }
  }

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
