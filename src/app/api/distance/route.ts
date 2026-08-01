import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { addresses } = await req.json()

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

  const params = new URLSearchParams({
    origin,
    destination,
    key: apiKey,
    units: 'metric',
  })
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.join('|'))
  }

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`)
    const data = await res.json()

    if (data.status !== 'OK' || !data.routes?.[0]) {
      return NextResponse.json({ error: data.error_message || data.status || 'Route not found' }, { status: 400 })
    }

    const legs = data.routes[0].legs
    const totalMeters = legs.reduce((sum: number, leg: { distance: { value: number } }) => sum + leg.distance.value, 0)
    const totalSeconds = legs.reduce((sum: number, leg: { duration: { value: number } }) => sum + leg.duration.value, 0)

    return NextResponse.json({
      distanceKm: Math.round((totalMeters / 1000) * 10) / 10,
      durationMinutes: Math.round(totalSeconds / 60),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reach mapping service' }, { status: 500 })
  }
}
