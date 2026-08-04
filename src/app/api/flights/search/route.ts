import { NextRequest, NextResponse } from 'next/server'

const DUFFEL_BASE = 'https://api.duffel.com'

// Major Canadian airports (plus a few key US border ones) with coordinates,
// used to find the nearest real airport to any address — much more reliable
// than trying to text-match a city name against an airline database, since
// most people don't live in a city that has its own airport.
const AIRPORTS: { code: string; name: string; lat: number; lng: number }[] = [
  { code: 'YVR', name: 'Vancouver', lat: 49.1967, lng: -123.1815 },
  { code: 'YXX', name: 'Abbotsford', lat: 49.0253, lng: -122.3606 },
  { code: 'YKA', name: 'Kamloops', lat: 50.7022, lng: -120.4442 },
  { code: 'YLW', name: 'Kelowna', lat: 49.9561, lng: -119.3778 },
  { code: 'YXS', name: 'Prince George', lat: 53.8894, lng: -122.6789 },
  { code: 'YYJ', name: 'Victoria', lat: 48.6469, lng: -123.4258 },
  { code: 'YQQ', name: 'Comox', lat: 49.7108, lng: -124.8867 },
  { code: 'YXJ', name: 'Fort St. John', lat: 56.2381, lng: -120.7397 },
  { code: 'YDQ', name: 'Dawson Creek', lat: 55.7422, lng: -120.1828 },
  { code: 'YCG', name: 'Castlegar', lat: 49.2964, lng: -117.6317 },
  { code: 'YYC', name: 'Calgary', lat: 51.1215, lng: -114.0076 },
  { code: 'YEG', name: 'Edmonton', lat: 53.3097, lng: -113.5801 },
  { code: 'YQL', name: 'Lethbridge', lat: 49.6303, lng: -112.7997 },
  { code: 'YMM', name: 'Fort McMurray', lat: 56.6531, lng: -111.2225 },
  { code: 'YQU', name: 'Grande Prairie', lat: 55.1797, lng: -118.8858 },
  { code: 'YXE', name: 'Saskatoon', lat: 52.1708, lng: -106.6997 },
  { code: 'YQR', name: 'Regina', lat: 50.4319, lng: -104.6658 },
  { code: 'YWG', name: 'Winnipeg', lat: 49.9100, lng: -97.2399 },
  { code: 'YYZ', name: 'Toronto', lat: 43.6777, lng: -79.6248 },
  { code: 'YOW', name: 'Ottawa', lat: 45.3225, lng: -75.6692 },
  { code: 'YUL', name: 'Montreal', lat: 45.4706, lng: -73.7408 },
  { code: 'YHZ', name: 'Halifax', lat: 44.8808, lng: -63.5086 },
  { code: 'YFC', name: 'Fredericton', lat: 45.8689, lng: -66.5372 },
  { code: 'YQM', name: 'Moncton', lat: 46.1122, lng: -64.6786 },
  { code: 'YYT', name: "St. John's", lat: 47.6186, lng: -52.7519 },
  { code: 'YXY', name: 'Whitehorse', lat: 60.7096, lng: -135.0679 },
  { code: 'YZF', name: 'Yellowknife', lat: 62.4628, lng: -114.4403 },
  { code: 'SEA', name: 'Seattle', lat: 47.4502, lng: -122.3088 },
  { code: 'BLI', name: 'Bellingham', lat: 48.7928, lng: -122.5375 },
  { code: 'GEG', name: 'Spokane', lat: 47.6199, lng: -117.5338 },
]

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return null
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`)
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== 'OK') {
    console.error('Google Geocoding failed:', data.status, data.error_message)
    return null
  }
  const loc = data.results?.[0]?.geometry?.location
  return loc ? { lat: loc.lat, lng: loc.lng } : null
}

async function nearestAirport(address: string): Promise<{ code: string; name: string } | { error: string }> {
  const coords = await geocodeAddress(address)
  if (!coords) return { error: `Could not locate "${address}" on the map.` }

  let closest = AIRPORTS[0]
  let closestDist = Infinity
  for (const airport of AIRPORTS) {
    const dist = haversineKm(coords.lat, coords.lng, airport.lat, airport.lng)
    if (dist < closestDist) {
      closestDist = dist
      closest = airport
    }
  }
  return { code: closest.code, name: closest.name }
}

async function duffelFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${DUFFEL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Duffel-Version': 'v2',
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init?.headers,
    },
  })
}

export async function POST(req: NextRequest) {
  const token = process.env.DUFFEL_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Flight search isn\u2019t set up yet.' }, { status: 501 })
  }

  const { originAddress, destinationAddress, departureDate } = await req.json()
  if (!originAddress || !destinationAddress) {
    return NextResponse.json({ error: 'Missing origin or destination address.' }, { status: 400 })
  }

  // The flight is the RETURN leg — the driver drives from originAddress
  // (pickup) to destinationAddress (dropoff), then flies back. So the flight
  // itself goes destination airport -> origin airport.
  const [flightFrom, flightTo] = await Promise.all([
    nearestAirport(destinationAddress),
    nearestAirport(originAddress),
  ])

  if ('error' in flightFrom) {
    return NextResponse.json({ error: `Departure airport: ${flightFrom.error}` }, { status: 404 })
  }
  if ('error' in flightTo) {
    return NextResponse.json({ error: `Return airport: ${flightTo.error}` }, { status: 404 })
  }

  const date = departureDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const offerRequestRes = await duffelFetch('/air/offer_requests?return_offers=true', token, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        slices: [{ origin: flightFrom.code, destination: flightTo.code, departure_date: date }],
        passengers: [{ type: 'adult' }],
        cabin_class: 'economy',
      },
    }),
  })

  if (!offerRequestRes.ok) {
    const detail = await offerRequestRes.text()
    console.error('Duffel offer request failed:', detail)
    return NextResponse.json({ error: 'Could not search flights right now.' }, { status: 502 })
  }

  const offerRequestData = await offerRequestRes.json()
  const offers = offerRequestData?.data?.offers ?? []

  if (offers.length === 0) {
    return NextResponse.json({ origin: flightFrom, destination: flightTo, flight: null })
  }

  // Prefer a direct flight; if none exist, prefer the fewest total stops.
  // Within the same stop-count, prefer the cheapest.
  type Offer = { total_amount: string; total_currency: string; slices: { segments: unknown[]; duration?: string }[] }
  const stopCount = (offer: Offer) =>
    offer.slices.reduce((sum, slice) => sum + Math.max(slice.segments.length - 1, 0), 0)

  const sorted = [...(offers as Offer[])].sort((a, b) => {
    const stopsDiff = stopCount(a) - stopCount(b)
    if (stopsDiff !== 0) return stopsDiff
    return parseFloat(a.total_amount) - parseFloat(b.total_amount)
  })

  const best = sorted[0]

  // Duffel returns slice duration as an ISO 8601 duration string, e.g. "PT2H15M"
  function parseIsoDurationMinutes(iso: string | undefined): number {
    if (!iso) return 0
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
    const hours = parseInt(match?.[1] ?? '0', 10)
    const minutes = parseInt(match?.[2] ?? '0', 10)
    return hours * 60 + minutes
  }

  const flightDurationMinutes = parseIsoDurationMinutes(best.slices[0]?.duration)
  const AIRPORT_BUFFER_MINUTES = 3 * 60

  return NextResponse.json({
    origin: flightFrom,
    destination: flightTo,
    flight: {
      priceCents: Math.round(parseFloat(best.total_amount) * 100),
      currency: best.total_currency,
      stops: stopCount(best),
      isDirect: stopCount(best) === 0,
      flightDurationMinutes,
      hoursToAdd: Math.round(((flightDurationMinutes + AIRPORT_BUFFER_MINUTES) / 60) * 100) / 100,
    },
  })
}
