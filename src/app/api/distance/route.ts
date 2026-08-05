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
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok || !data.routes?.[0]) {
      return NextResponse.json({ error: data.error?.message || 'Route not found' }, { status: 400 })
    }

    const route = data.routes[0]
    const durationSeconds = parseInt(String(route.duration).replace('s', ''), 10)

    return NextResponse.json({
      distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10,
      durationMinutes: Math.round(durationSeconds / 60),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reach mapping service' }, { status: 500 })
  }
}
