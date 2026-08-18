import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  { code: 'YXT', name: 'Terrace', lat: 54.4683, lng: -128.5776 },
  { code: 'YYD', name: 'Smithers', lat: 54.8249, lng: -127.1826 },
  { code: 'YPR', name: 'Prince Rupert', lat: 54.2861, lng: -130.4451 },
  { code: 'YWL', name: 'Williams Lake', lat: 52.1831, lng: -122.0542 },
  { code: 'YQZ', name: 'Quesnel', lat: 52.9536, lng: -122.5108 },
  { code: 'YXC', name: 'Cranbrook', lat: 49.6103, lng: -115.7822 },
  { code: 'YYF', name: 'Penticton', lat: 49.4630, lng: -119.6022 },
  { code: 'YCD', name: 'Nanaimo', lat: 49.0553, lng: -123.8700 },
  { code: 'YBL', name: 'Campbell River', lat: 49.9508, lng: -125.2708 },
  { code: 'YPW', name: 'Powell River', lat: 49.8339, lng: -124.5006 },
  { code: 'YAZ', name: 'Tofino', lat: 49.0794, lng: -125.7758 },
  { code: 'YYE', name: 'Fort Nelson', lat: 58.8361, lng: -122.5967 },
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

async function nearbyAirports(address: string, maxCandidates: number, maxRadiusKm: number): Promise<{ code: string; name: string; lat: number; lng: number }[] | { error: string }> {
  const coords = await geocodeAddress(address)
  if (!coords) return { error: `Could not locate "${address}" on the map.` }

  const withDistance = AIRPORTS.map((a) => ({ ...a, dist: haversineKm(coords.lat, coords.lng, a.lat, a.lng) }))
    .sort((a, b) => a.dist - b.dist)

  // Always include the single nearest airport regardless of radius (need at
  // least one candidate even in remote areas), then add any others that are
  // still reasonably close — this is what actually catches cases like
  // Abbotsford vs. Vancouver, where the "closer" airport isn't necessarily
  // the cheaper one to fly from.
  const candidates = [withDistance[0], ...withDistance.slice(1).filter((a) => a.dist <= maxRadiusKm)]
  return candidates.slice(0, maxCandidates).map(({ code, name, lat, lng }) => ({ code, name, lat, lng }))
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

async function drivingLegToAirport(address: string, airport: { lat: number; lng: number }, departureTime?: string): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  const departureDate = departureTime ? new Date(departureTime) : null
  const useScheduledTime = departureDate && !isNaN(departureDate.getTime()) && departureDate.getTime() > Date.now()

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify({
      origin: { address },
      destination: { location: { latLng: { latitude: airport.lat, longitude: airport.lng } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      units: 'METRIC',
      ...(useScheduledTime && { departureTime: departureDate.toISOString() }),
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const route = data.routes?.[0]
  if (!route) return null
  const durationSeconds = parseInt(String(route.duration).replace('s', ''), 10)
  return {
    distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10,
    durationMinutes: Math.round(durationSeconds / 60),
  }
}

// Converts a price to CAD if it isn't already, using a free ECB-sourced rate
// (no API key needed). Falls back to the original amount/currency if the
// conversion service is unreachable, rather than failing the whole search.
async function convertToCad(amountCents: number, fromCurrency: string): Promise<{ amountCents: number; currency: string; originalAmountCents?: number; originalCurrency?: string }> {
  if (fromCurrency === 'CAD') return { amountCents, currency: 'CAD' }

  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=CAD`)
    if (!res.ok) return { amountCents, currency: fromCurrency }
    const data = await res.json()
    const rate = data?.rates?.CAD
    if (!rate) return { amountCents, currency: fromCurrency }
    return {
      amountCents: Math.round(amountCents * rate),
      currency: 'CAD',
      originalAmountCents: amountCents,
      originalCurrency: fromCurrency,
    }
  } catch {
    return { amountCents, currency: fromCurrency }
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

  // The flight is the RETURN leg — the driver drives from originAddress
  // (pickup) to destinationAddress (dropoff), then flies back. So the flight
  // itself goes destination airport -> origin airport. Check the top 3
  // closest airports on each side rather than just the single nearest one —
  // the geographically closest airport isn't always the cheapest (or even a
  // viable) one to fly from/to: a small regional airport can cost more than
  // a farther major hub with real competition, and near the US border the
  // "closest" airport can be a US one with no practical/available flight,
  // which would otherwise crowd out a genuinely useful option like Vancouver.
  // This compares the actual total cost (flight + ground transport both
  // ends) across every candidate instead of assuming "closest" means "best."
  const [fromCandidates, toCandidates] = await Promise.all([
    nearbyAirports(destinationAddress, 3, 100),
    nearbyAirports(originAddress, 3, 100),
  ])

  if ('error' in fromCandidates) {
    return NextResponse.json({ error: `Departure airport: ${fromCandidates.error}` }, { status: 404 })
  }
  if ('error' in toCandidates) {
    return NextResponse.json({ error: `Return airport: ${toCandidates.error}` }, { status: 404 })
  }

  const date = departureDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const supabase = await createClient()
  const { data: pricingSettings } = await supabase.from('pricing_settings').select('flight_airport_buffer_hours, uber_base_fare_cents, uber_per_km_cents, uber_minimum_fare_cents').eq('id', 1).single()
  const AIRPORT_BUFFER_MINUTES = (pricingSettings?.flight_airport_buffer_hours ?? 3) * 60

  type Segment = {
    marketing_carrier?: { name?: string; iata_code?: string }
    marketing_carrier_flight_number?: string
    origin?: { iata_code?: string }
    destination?: { iata_code?: string }
    departing_at?: string
    arriving_at?: string
  }
  type Offer = {
    total_amount: string
    total_currency: string
    slices: { segments: Segment[]; duration?: string }[]
  }
  const stopCount = (offer: Offer) =>
    offer.slices.reduce((sum, slice) => sum + Math.max(slice.segments.length - 1, 0), 0)

  function parseIsoDurationMinutes(iso: string | undefined): number {
    if (!iso) return 0
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
    const hours = parseInt(match?.[1] ?? '0', 10)
    const minutes = parseInt(match?.[2] ?? '0', 10)
    return hours * 60 + minutes
  }

  async function searchOneRoute(flightFrom: { code: string; name: string; lat: number; lng: number }, flightTo: { code: string; name: string; lat: number; lng: number }) {
    const [offerRequestRes, groundToAirport, groundFromAirport] = await Promise.all([
      duffelFetch('/air/offer_requests?return_offers=true', token!, {
        method: 'POST',
        body: JSON.stringify({
          data: {
            slices: [{ origin: flightFrom.code, destination: flightTo.code, departure_date: date }],
            passengers: [{ type: 'adult' }],
            cabin_class: 'economy',
          },
        }),
      }),
      drivingLegToAirport(destinationAddress, flightFrom, date),
      // The return leg: once the driver lands back home, they still need to
      // get from that arrival airport back to the original pickup address.
      // This was previously always a flat guessed fee regardless of actual
      // distance - same real, traffic-aware calculation as the outbound leg.
      drivingLegToAirport(originAddress, flightTo, date),
    ])

    if (!offerRequestRes.ok) {
      const detail = await offerRequestRes.text()
      console.error(`Duffel offer request failed for ${flightFrom.code}->${flightTo.code}:`, detail)
      return null
    }

    const offerRequestData = await offerRequestRes.json()
    const offers = offerRequestData?.data?.offers ?? []
    if (offers.length === 0) return { flightFrom, flightTo, flight: null, groundToAirport, groundFromAirport, effectiveCostCents: Infinity }

    const sorted = [...(offers as Offer[])].sort((a, b) => {
      const stopsDiff = stopCount(a) - stopCount(b)
      if (stopsDiff !== 0) return stopsDiff
      return parseFloat(a.total_amount) - parseFloat(b.total_amount)
    })
    const best = sorted[0]
    const flightDurationMinutes = parseIsoDurationMinutes(best.slices[0]?.duration)
    const priceCentsRaw = Math.round(parseFloat(best.total_amount) * 100)
    const converted = await convertToCad(priceCentsRaw, best.total_currency)

    const segments = (best.slices[0]?.segments ?? []).map((s) => ({
      airline: s.marketing_carrier?.name ?? s.marketing_carrier?.iata_code ?? null,
      airlineCode: s.marketing_carrier?.iata_code ?? null,
      flightNumber: s.marketing_carrier_flight_number
        ? `${s.marketing_carrier?.iata_code ?? ''}${s.marketing_carrier_flight_number}`
        : null,
      from: s.origin?.iata_code ?? null,
      to: s.destination?.iata_code ?? null,
      departingAt: s.departing_at ?? null,
      arrivingAt: s.arriving_at ?? null,
    }))

    // What actually matters for comparing candidates isn't just the ticket
    // price — a cheaper flight from a farther airport can be a wash (or a
    // loss) once the extra ground transport to reach it is factored in. Uses
    // the same fare formula the actual pricing engine uses, so this ranking
    // reflects the real cost, not a rough guess.
    const groundCostEstimate = (groundToAirport
      ? Math.max(
          Math.round((pricingSettings?.uber_base_fare_cents ?? 0) + groundToAirport.distanceKm * (pricingSettings?.uber_per_km_cents ?? 0)),
          pricingSettings?.uber_minimum_fare_cents ?? 0
        )
      : 0) + (groundFromAirport
      ? Math.max(
          Math.round((pricingSettings?.uber_base_fare_cents ?? 0) + groundFromAirport.distanceKm * (pricingSettings?.uber_per_km_cents ?? 0)),
          pricingSettings?.uber_minimum_fare_cents ?? 0
        )
      : 0)
    const effectiveCostCents = converted.amountCents + groundCostEstimate

    return {
      flightFrom, flightTo, groundToAirport, groundFromAirport, effectiveCostCents,
      flight: {
        priceCents: converted.amountCents,
        currency: converted.currency,
        originalPriceCents: converted.originalAmountCents,
        originalCurrency: converted.originalCurrency,
        stops: stopCount(best),
        isDirect: stopCount(best) === 0,
        flightDurationMinutes,
        hoursToAdd: Math.round(((flightDurationMinutes + AIRPORT_BUFFER_MINUTES) / 60) * 100) / 100,
        airportBufferHours: AIRPORT_BUFFER_MINUTES / 60,
        segments,
      },
    }
  }

  const combinations: [typeof fromCandidates[0], typeof toCandidates[0]][] = []
  for (const from of fromCandidates) {
    for (const to of toCandidates) {
      combinations.push([from, to])
    }
  }

  console.log('Flight search candidates:', {
    origin: originAddress,
    destination: destinationAddress,
    fromCandidates: fromCandidates.map((a) => a.code),
    toCandidates: toCandidates.map((a) => a.code),
  })

  const results = await Promise.all(combinations.map(([from, to]) => searchOneRoute(from, to)))
  console.log('Flight search results:', results.map((r) =>
    r ? `${r.flightFrom.code}->${r.flightTo.code}: ${r.flight ? `$${(r.effectiveCostCents / 100).toFixed(2)} total` : 'no flight found'}` : 'null (request failed)'
  ))
  const viable = results.filter((r): r is NonNullable<typeof r> => r !== null && r.flight !== null)

  if (viable.length === 0) {
    // Every combination failed outright (not just "no offers") — fall back to
    // the single nearest-airport pair so the caller still gets a real error
    // and the ground-transport estimate, instead of nothing at all.
    const fallback = await searchOneRoute(fromCandidates[0], toCandidates[0])
    return NextResponse.json({ origin: fromCandidates[0], destination: toCandidates[0], flight: null, groundToAirport: fallback?.groundToAirport ?? null, groundFromAirport: fallback?.groundFromAirport ?? null })
  }

  const cheapest = viable.reduce((best, cur) => (cur.effectiveCostCents < best.effectiveCostCents ? cur : best))
  const sortedOptions = [...viable].sort((a, b) => a.effectiveCostCents - b.effectiveCostCents)

  return NextResponse.json({
    origin: cheapest.flightFrom,
    destination: cheapest.flightTo,
    flight: cheapest.flight,
    groundToAirport: cheapest.groundToAirport,
    groundFromAirport: cheapest.groundFromAirport,
    comparedAirports: combinations.map(([f, t]) => `${f.name} (${f.code}) → ${t.name} (${t.code})`),
    // Every viable airport combination that actually returned a flight,
    // sorted cheapest-first (flight + both ground transport legs combined) -
    // lets the caller show a choice instead of only ever silently picking
    // the cheapest one with no visibility into what else was considered.
    options: sortedOptions.map((r) => ({
      origin: r.flightFrom,
      destination: r.flightTo,
      flight: r.flight,
      groundToAirport: r.groundToAirport,
      groundFromAirport: r.groundFromAirport,
      effectiveCostCents: r.effectiveCostCents,
    })),
  })
}
