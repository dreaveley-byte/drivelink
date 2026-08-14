import { NextRequest, NextResponse } from 'next/server'

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type PlaceResult = {
  name: string
  formatted_address?: string
  vicinity?: string
  place_id: string
  geometry?: { location?: { lat: number; lng: number } }
}

// Finds First Nations reserves/bands near a given address using Google
// Places' own, actively maintained geographic data — there are ~1,500+
// reserves in BC alone (across 200+ Nations), far too many and too
// detail-sensitive for a hand-maintained list here to be reliable.
//
// Uses Nearby Search (not Text Search) with several different keywords,
// since Nearby Search actually restricts results to the given radius rather
// than merely biasing toward it, and place names like "Katzie First Nation"
// often don't literally contain the word "reserve" at all - a single fixed
// phrase easily misses real, nearby results.
export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Places search isn\u2019t configured.' }, { status: 501 })
  }

  const { address } = await req.json()
  if (!address) {
    return NextResponse.json({ error: 'Missing address.' }, { status: 400 })
  }

  const geocodeRes = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
  )
  const geocodeData = await geocodeRes.json()
  if (geocodeData.status !== 'OK') {
    console.error('Geocode failed:', geocodeData.status, geocodeData.error_message)
    return NextResponse.json({ error: `Could not locate "${address}" (${geocodeData.status}).` }, { status: 404 })
  }
  const location = geocodeData.results[0].geometry.location

  const keywords = ['First Nation', 'Indian reserve', 'First Nations band office', 'First Nation reserve']
  const allResults: PlaceResult[] = []
  const statuses: string[] = []

  for (const keyword of keywords) {
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=100000&keyword=${encodeURIComponent(keyword)}&key=${apiKey}`
    )
    const searchData = await searchRes.json()
    statuses.push(`${keyword}: ${searchData.status}`)
    if (searchData.status === 'OK' && Array.isArray(searchData.results)) {
      allResults.push(...searchData.results)
    } else if (searchData.status !== 'ZERO_RESULTS') {
      console.error('Nearby search failed:', keyword, searchData.status, searchData.error_message)
    }
  }

  const seen = new Set<string>()
  const results = allResults.filter((r) => {
    if (seen.has(r.place_id)) return false
    seen.add(r.place_id)
    return true
  })

  const withDistance = results
    .filter((r) => r.geometry?.location)
    .map((r) => ({
      name: r.name,
      address: r.formatted_address ?? r.vicinity ?? '',
      placeId: r.place_id,
      distanceKm: Math.round(haversineKm(location.lat, location.lng, r.geometry!.location!.lat, r.geometry!.location!.lng)),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 10)

  if (withDistance.length === 0) {
    console.error('No reserves found. Search statuses:', statuses.join(', '))
  }

  return NextResponse.json({ reserves: withDistance })
}
