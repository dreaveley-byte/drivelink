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

// Finds First Nations reserves near a given address using Google Places'
// own, actively maintained geographic data — there are ~1,500+ reserves in
// BC alone (across 200+ Nations), far too many and too detail-sensitive for
// a hand-maintained list here to be reliable. This searches live instead.
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
  const location = geocodeData?.results?.[0]?.geometry?.location
  if (!location) {
    return NextResponse.json({ error: `Could not locate "${address}" on the map.` }, { status: 404 })
  }

  const searchRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent('First Nation reserve')}&location=${location.lat},${location.lng}&radius=150000&key=${apiKey}`
  )
  const searchData = await searchRes.json()
  const results = (searchData?.results ?? []) as Array<{
    name: string
    formatted_address: string
    place_id: string
    geometry?: { location?: { lat: number; lng: number } }
  }>

  const withDistance = results
    .filter((r) => r.geometry?.location)
    .map((r) => ({
      name: r.name,
      address: r.formatted_address,
      placeId: r.place_id,
      distanceKm: Math.round(haversineKm(location.lat, location.lng, r.geometry!.location!.lat, r.geometry!.location!.lng)),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8)

  return NextResponse.json({ reserves: withDistance })
}
