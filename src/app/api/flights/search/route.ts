import { NextRequest, NextResponse } from 'next/server'

const DUFFEL_BASE = 'https://api.duffel.com'

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

// Extracts a plausible city name from a street address for airport lookup —
// takes the segment before the province/postal code (e.g. "123 Main St,
// Coquitlam, BC V3B 1A1" -> "Coquitlam").
function guessCity(address: string): string {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) return parts[parts.length - 2]
  return parts[0] ?? address
}

async function findAirportCode(token: string, address: string): Promise<{ code: string; name: string } | null> {
  const query = guessCity(address)
  const res = await duffelFetch(`/places/suggestions?query=${encodeURIComponent(query)}`, token)
  if (!res.ok) return null
  const data = await res.json()
  const suggestion = data?.data?.[0]
  if (!suggestion?.iata_code) return null
  return { code: suggestion.iata_code, name: suggestion.name }
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

  const [origin, destination] = await Promise.all([
    findAirportCode(token, originAddress),
    findAirportCode(token, destinationAddress),
  ])

  if (!origin || !destination) {
    return NextResponse.json({ error: 'Could not find an airport near one of those addresses.' }, { status: 404 })
  }

  const date = departureDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const offerRequestRes = await duffelFetch('/air/offer_requests?return_offers=true', token, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        slices: [{ origin: origin.code, destination: destination.code, departure_date: date }],
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
    return NextResponse.json({ origin, destination, flight: null })
  }

  // Prefer a direct flight; if none exist, prefer the fewest total stops.
  // Within the same stop-count, prefer the cheapest.
  type Offer = { total_amount: string; total_currency: string; slices: { segments: unknown[] }[] }
  const stopCount = (offer: Offer) =>
    offer.slices.reduce((sum, slice) => sum + Math.max(slice.segments.length - 1, 0), 0)

  const sorted = [...(offers as Offer[])].sort((a, b) => {
    const stopsDiff = stopCount(a) - stopCount(b)
    if (stopsDiff !== 0) return stopsDiff
    return parseFloat(a.total_amount) - parseFloat(b.total_amount)
  })

  const best = sorted[0]

  return NextResponse.json({
    origin,
    destination,
    flight: {
      priceCents: Math.round(parseFloat(best.total_amount) * 100),
      currency: best.total_currency,
      stops: stopCount(best),
      isDirect: stopCount(best) === 0,
    },
  })
}
