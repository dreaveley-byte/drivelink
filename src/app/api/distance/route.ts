import { NextRequest, NextResponse } from 'next/server'

// Detects a "lat,lng" formatted string (used for the driver's live GPS position)
// vs. a normal street address, and builds the right waypoint shape for the Routes API.
function toWaypoint(point: string) {
  const match = point.trim().match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/)
  if (match) {
    return { location: { latLng: { latitude: parseFloat(match[1]), longitude: parseFloat(match[3]) } } }
  }
  return { address: point }
}

// Resolves the IANA timezone (e.g. "America/Edmonton") for a lat/lng, so pickup
// and delivery times can be interpreted/shown in the RIGHT local timezone rather
// than always assuming the browser's own timezone (which breaks for interprovincial
// deliveries — a driver in Vancouver delivering to Edmonton needs Edmonton's time).
// Rough North American timezone bands by longitude, with known DST exceptions
// handled (Saskatchewan doesn't observe DST, hence the separate Regina zone).
// Not exact at every provincial boundary, but close enough (~50km) to never be
// as wrong as falling back to the server's raw UTC offset would be.
function approximateNorthAmericanTimeZone(lat: number, lng: number): string {
  if (lat > 46.5 && lat < 61 && lng > -59.5 && lng < -52.5) return 'America/St_Johns'
  if (lng >= -68 && lng < -52.5) return 'America/Halifax'
  if (lng >= -90 && lng < -68) return 'America/Toronto'
  if (lng >= -102 && lng < -90) {
    if (lat > 48.5 && lat < 60 && lng > -110 && lng < -101.3) return 'America/Regina'
    return 'America/Winnipeg'
  }
  if (lng >= -120 && lng < -102) return 'America/Edmonton'
  return 'America/Vancouver'
}

async function resolveTimeZone(lat: number, lng: number, apiKey: string): Promise<string | null> {
  try {
    const timestamp = Math.floor(Date.now() / 1000)
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${apiKey}`
    )
    const data = await res.json()
    if (data.status !== 'OK') {
      console.error(`Timezone API failed for ${lat},${lng}: status=${data.status}, message=${data.errorMessage || 'none'} — using longitude-based fallback instead.`)
      return approximateNorthAmericanTimeZone(lat, lng)
    }
    return data.timeZoneId
  } catch (e) {
    console.error(`Timezone API request failed for ${lat},${lng}:`, e, '— using longitude-based fallback instead.')
    return approximateNorthAmericanTimeZone(lat, lng)
  }
}

export async function POST(req: NextRequest) {
  const { addresses, departureTime } = await req.json()

  if (!Array.isArray(addresses) || addresses.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 addresses' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Maps not configured' }, { status: 500 })
  }

  const origin = addresses[0]
  const destination = addresses[addresses.length - 1]
  const waypoints = addresses.slice(1, -1)

  // Predictive traffic needs a real future timestamp — if the scheduled time has
  // already passed (or wasn't provided), fall back to "now" rather than sending
  // Google a departure time in the past, which it will reject.
  const departureDate = departureTime ? new Date(departureTime) : null
  const useScheduledTime = departureDate && !isNaN(departureDate.getTime()) && departureDate.getTime() > Date.now()

  const body = {
    origin: toWaypoint(origin),
    destination: toWaypoint(destination),
    intermediates: waypoints.map(toWaypoint),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    units: 'METRIC',
    ...(useScheduledTime && { departureTime: departureDate.toISOString() }),
  }

  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.legs.startLocation,routes.legs.endLocation',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok || !data.routes?.[0]) {
      return NextResponse.json({ error: data.error?.message || 'Route not found' }, { status: 400 })
    }

    const route = data.routes[0]
    const durationSeconds = parseInt(String(route.duration).replace('s', ''), 10)

    const legs = route.legs ?? []
    const startPoint = legs[0]?.startLocation?.latLng
    const endPoint = legs[legs.length - 1]?.endLocation?.latLng

    const [originTimeZone, destinationTimeZone] = await Promise.all([
      startPoint ? resolveTimeZone(startPoint.latitude, startPoint.longitude, apiKey) : Promise.resolve(null),
      endPoint ? resolveTimeZone(endPoint.latitude, endPoint.longitude, apiKey) : Promise.resolve(null),
    ])

    return NextResponse.json({
      distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10,
      durationMinutes: Math.round(durationSeconds / 60),
      originTimeZone,
      destinationTimeZone,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reach mapping service' }, { status: 500 })
  }
}
