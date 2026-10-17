import { NextRequest, NextResponse } from 'next/server'

// Returns the planned driving route between two addresses as an encoded
// polyline, for drawing the blue route line on the tracking map. Uses the
// newer Routes API (the same one /api/distance already uses) instead of the
// old browser-side Directions service, which Google refuses with
// REQUEST_DENIED on newer Google Cloud projects.
export async function POST(req: NextRequest) {
  const { origin, destination } = await req.json().catch(() => ({}))
  if (
    typeof origin !== 'string' || typeof destination !== 'string' ||
    !origin.trim() || !destination.trim() ||
    origin.length > 300 || destination.length > 300
  ) {
    return NextResponse.json({ error: 'Need an origin and a destination' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Maps not configured' }, { status: 500 })
  }

  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Only the line itself - keeps this on the cheapest Routes tier.
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address: destination },
        travelMode: 'DRIVE',
        units: 'METRIC',
      }),
    })
    const data = await res.json()
    const encoded = data.routes?.[0]?.polyline?.encodedPolyline
    if (!res.ok || !encoded) {
      return NextResponse.json({ error: data.error?.message || 'Route not found' }, { status: 400 })
    }
    return NextResponse.json({ encodedPolyline: encoded })
  } catch {
    return NextResponse.json({ error: 'Failed to reach mapping service' }, { status: 500 })
  }
}
