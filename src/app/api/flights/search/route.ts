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

const PROVINCE_CODES = ['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU']

// Extracts plausible city-name candidates from a street address for airport
// lookup, most-specific first. Handles both comma-separated addresses
// ("123 Main St, Coquitlam, BC V3B 1A1") and plain ones without commas
// ("19237 122A Ave Pitt Meadows BC").
function guessCityCandidates(address: string): string[] {
  const commaParts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (commaParts.length >= 2) {
    // e.g. ["123 Main St", "Coquitlam", "BC V3B 1A1"] -> "Coquitlam"
    return [commaParts[commaParts.length - 2]]
  }

  // No commas — strip postal code and province code off the end, then try
  // progressively shorter word groups from what's left.
  let stripped = address
    .replace(/[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d\s*$/, '') // Canadian postal code
    .replace(/\b\d{5}(-\d{4})?\s*$/, '') // US zip code
    .trim()

  const words = stripped.split(/\s+/)
  const last = words[words.length - 1]?.toUpperCase().replace(/[^A-Z]/g, '')
  if (last && PROVINCE_CODES.includes(last)) {
    words.pop()
  }

  const candidates: string[] = []
  if (words.length >= 2) candidates.push(words.slice(-2).join(' '))
  if (words.length >= 1) candidates.push(words[words.length - 1])
  return candidates.length > 0 ? candidates : [address]
}

// Uses Google's Geocoding API (already used elsewhere in the app for the
// live map) to reliably pull the city name out of an arbitrary address —
// far more robust than guessing from raw text.
async function geocodeCity(address: string): Promise<string | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return null

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  )
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== 'OK') {
    console.error('Google Geocoding failed:', data.status, data.error_message)
    return null
  }

  const components = data.results?.[0]?.address_components ?? []
  const findType = (type: string) => components.find((c: { types: string[] }) => c.types.includes(type))?.long_name

  return findType('locality') || findType('postal_town') || findType('administrative_area_level_3') || null
}

async function findAirportCode(token: string, address: string): Promise<{ code: string; name: string } | { error: string }> {
  const geocodedCity = await geocodeCity(address)
  const candidates = geocodedCity ? [geocodedCity, ...guessCityCandidates(address)] : guessCityCandidates(address)
  let lastError = ''

  for (const query of candidates) {
    const res = await duffelFetch(`/places/suggestions?query=${encodeURIComponent(query)}`, token)
    if (!res.ok) {
      lastError = await res.text().catch(() => `HTTP ${res.status}`)
      console.error(`Duffel places lookup failed for "${query}":`, lastError)
      continue
    }
    const data = await res.json()
    const suggestion = data?.data?.[0]
    if (suggestion?.iata_code) {
      return { code: suggestion.iata_code, name: suggestion.name }
    }
  }

  return {
    error:
      lastError ||
      (geocodedCity
        ? `No airport match found near "${geocodedCity}"`
        : `Could not determine a city for that address, and no airport match found for: ${candidates.join(', ')}`),
  }
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

  if ('error' in origin) {
    return NextResponse.json({ error: `Origin airport: ${origin.error}` }, { status: 404 })
  }
  if ('error' in destination) {
    return NextResponse.json({ error: `Destination airport: ${destination.error}` }, { status: 404 })
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
