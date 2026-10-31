import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { groundLegPricing, AVG_BUS_SPEED_KMH } from '@/lib/pricing'
import { isFerryIsolated } from '@/lib/bcGeography'

const DUFFEL_BASE = 'https://api.duffel.com'

// Canadian airports only (US airports deliberately excluded - see note at
// the end of this list), with coordinates,
// used to find the nearest real airport to any address — much more reliable
// than trying to text-match a city name against an airline database, since
// most people don't live in a city that has its own airport.
const AIRPORTS: { code: string; name: string; lat: number; lng: number; islandOnly?: boolean; hub?: boolean }[] = [
  { code: 'YVR', name: 'Vancouver', lat: 49.1967, lng: -123.1815, hub: true },
  { code: 'YXX', name: 'Abbotsford', lat: 49.0253, lng: -122.3606 },
  { code: 'YKA', name: 'Kamloops', lat: 50.7022, lng: -120.4442 },
  { code: 'YLW', name: 'Kelowna', lat: 49.9561, lng: -119.3778, hub: true },
  { code: 'YXS', name: 'Prince George', lat: 53.8894, lng: -122.6789 },
  { code: 'YYJ', name: 'Victoria', lat: 48.6469, lng: -123.4258, islandOnly: true },
  { code: 'YQQ', name: 'Comox', lat: 49.7108, lng: -124.8867, islandOnly: true },
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
  { code: 'YCD', name: 'Nanaimo', lat: 49.0553, lng: -123.8700, islandOnly: true },
  { code: 'YBL', name: 'Campbell River', lat: 49.9508, lng: -125.2708 },
  { code: 'YPW', name: 'Powell River', lat: 49.8339, lng: -124.5006 },
  { code: 'YAZ', name: 'Tofino', lat: 49.0794, lng: -125.7758 },
  { code: 'YYE', name: 'Fort Nelson', lat: 58.8361, lng: -122.5967 },
  { code: 'YYC', name: 'Calgary', lat: 51.1215, lng: -114.0076, hub: true },
  { code: 'YEG', name: 'Edmonton', lat: 53.3097, lng: -113.5801, hub: true },
  { code: 'YQL', name: 'Lethbridge', lat: 49.6303, lng: -112.7997 },
  { code: 'YMM', name: 'Fort McMurray', lat: 56.6531, lng: -111.2225 },
  { code: 'YQU', name: 'Grande Prairie', lat: 55.1797, lng: -118.8858 },
  { code: 'YXE', name: 'Saskatoon', lat: 52.1708, lng: -106.6997, hub: true },
  { code: 'YQR', name: 'Regina', lat: 50.4319, lng: -104.6658, hub: true },
  { code: 'YWG', name: 'Winnipeg', lat: 49.9100, lng: -97.2399, hub: true },
  { code: 'YYZ', name: 'Toronto', lat: 43.6777, lng: -79.6248, hub: true },
  { code: 'YOW', name: 'Ottawa', lat: 45.3225, lng: -75.6692, hub: true },
  { code: 'YUL', name: 'Montreal', lat: 45.4706, lng: -73.7408, hub: true },
  { code: 'YHZ', name: 'Halifax', lat: 44.8808, lng: -63.5086, hub: true },
  { code: 'YFC', name: 'Fredericton', lat: 45.8689, lng: -66.5372 },
  { code: 'YQM', name: 'Moncton', lat: 46.1122, lng: -64.6786 },
  { code: 'YYT', name: "St. John's", lat: 47.6186, lng: -52.7519 },
  { code: 'YXY', name: 'Whitehorse', lat: 60.7096, lng: -135.0679 },
  { code: 'YZF', name: 'Yellowknife', lat: 62.4628, lng: -114.4403 },
  // US airports deliberately excluded - a driver flying back to a Canadian
  // pickup/dropoff shouldn't be routed through a US airport, since that
  // means clearing US customs plus a cross-border drive back into Canada.
  // It also crowds out genuinely useful Canadian airports in the "closest N"
  // search when a US border airport happens to be geographically nearer.
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
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=ca&key=${key}`)
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== 'OK') {
    console.error('Google Geocoding failed:', data.status, data.error_message)
    return null
  }
  const loc = data.results?.[0]?.geometry?.location
  return loc ? { lat: loc.lat, lng: loc.lng } : null
}

// Straight-line reach for adding a major hub as a bus-then-fly candidate, and
// how many of them to add (each one costs an extra airline search per pairing).
const HUB_RADIUS_KM = 400
const MAX_HUBS = 2

async function nearbyAirports(address: string, maxCandidates: number, maxRadiusKm: number, maxHubRadiusKm = HUB_RADIUS_KM, maxHubs = MAX_HUBS): Promise<{ code: string; name: string; lat: number; lng: number }[] | { error: string }> {
  const coords = await geocodeAddress(address)
  if (!coords) return { error: `Could not locate "${address}" on the map.` }

  // Vancouver Island airports (Victoria, Comox, Nanaimo) can be
  // geographically "close" in a straight line to a mainland address while
  // genuinely requiring a ferry crossing to reach by road - a real job was
  // found where this happened even within a 150km ground-transport sanity
  // cap, since a short ferry crossing can still report a short driving
  // distance. Rather than relying on distance alone, island-only airports
  // are excluded from consideration entirely unless the query address
  // itself falls within Vancouver Island's own rough bounding box.
  const ON_VANCOUVER_ISLAND = isFerryIsolated(coords.lat, coords.lng)
  const eligibleAirports = ON_VANCOUVER_ISLAND ? AIRPORTS : AIRPORTS.filter((a) => !a.islandOnly)

  const withDistance = eligibleAirports.map((a) => ({ ...a, dist: haversineKm(coords.lat, coords.lng, a.lat, a.lng) }))
    .sort((a, b) => a.dist - b.dist)

  // Always include the single nearest airport regardless of radius (need at
  // least one candidate even in remote areas), then add any others that are
  // still reasonably close — this is what actually catches cases like
  // Abbotsford vs. Vancouver, where the "closer" airport isn't necessarily
  // the cheaper one to fly from.
  const candidates = [withDistance[0], ...withDistance.slice(1).filter((a) => a.dist <= maxRadiusKm)].slice(0, maxCandidates)

  // A delivery can be hours from any airport with real airline service
  // (Lethbridge's own airport has almost none; Calgary is ~2h away). The
  // radius search above never reaches a major hub that far out, so the flight
  // option would come back empty and the quote would fall back to someone
  // driving the whole way home. Also consider the nearest major hubs within
  // a bus ride's reach - the driver takes a bus to the hub and flies from
  // there. Not applied on Vancouver Island (the road trip to a mainland hub
  // needs a ferry we don't price here).
  // Skipped entirely when a major hub is already among the candidates (e.g.
  // anywhere near Vancouver or Toronto), so those searches are unchanged.
  if (!ON_VANCOUVER_ISLAND && !candidates.some((c) => c.hub)) {
    const have = new Set(candidates.map((c) => c.code))
    const hubs = withDistance
      .filter((a) => a.hub && !have.has(a.code) && a.dist <= maxHubRadiusKm)
      .slice(0, maxHubs)
    candidates.push(...hubs)
  }
  return candidates.map(({ code, name, lat, lng }) => ({ code, name, lat, lng }))
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

// Ground legs longer than this are priced as a bus instead of an Uber.
const INTERCITY_KM = 100

async function drivingLegToAirport(address: string, airport: { lat: number; lng: number }, departureTime?: string): Promise<{ distanceKm: number; durationMinutes: number; mode: 'uber' | 'bus' } | null> {
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
  const distanceKm = Math.round((route.distanceMeters / 1000) * 10) / 10
  return {
    distanceKm,
    durationMinutes: Math.round(durationSeconds / 60),
    // Past this distance a ride-share isn't a sensible way to reach the
    // airport; price it (and describe it) as an intercity bus.
    mode: distanceKm > INTERCITY_KM ? 'bus' : 'uber',
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
    return NextResponse.json({ error: 'Flight search isn’t set up yet.' }, { status: 501 })
  }

  const { originAddress, destinationAddress, departureDate, earliestViableDepartureAt } = await req.json()
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
  const { data: pricingSettings } = await supabase.from('pricing_settings').select('flight_airport_buffer_hours, uber_base_fare_cents, uber_per_km_cents, uber_minimum_fare_cents, bus_base_fare_cents, bus_per_km_cents, bus_terminal_buffer_hours, bus_max_distance_km, hourly_rate_cents').eq('id', 1).single()
  const legSettings = {
    uber_base_fare_cents: pricingSettings?.uber_base_fare_cents ?? 0,
    uber_per_km_cents: pricingSettings?.uber_per_km_cents ?? 0,
    uber_minimum_fare_cents: pricingSettings?.uber_minimum_fare_cents ?? 0,
    bus_base_fare_cents: pricingSettings?.bus_base_fare_cents ?? 3000,
    bus_per_km_cents: pricingSettings?.bus_per_km_cents ?? 15,
    bus_terminal_buffer_hours: pricingSettings?.bus_terminal_buffer_hours ?? 2,
  }
  const BUS_MAX_KM = pricingSettings?.bus_max_distance_km ?? 600
  // Minutes from leaving the drop-off to standing at the airport: a bus leg
  // also has the wait for the next departure and slower average speed.
  const legMinutes = (leg: { distanceKm: number; durationMinutes: number; mode: 'uber' | 'bus' } | null | undefined, fallback: number) =>
    !leg ? fallback : leg.mode === 'bus' ? Math.round((leg.distanceKm / AVG_BUS_SPEED_KMH + legSettings.bus_terminal_buffer_hours) * 60) : leg.durationMinutes
  const AIRPORT_BUFFER_MINUTES = (pricingSettings?.flight_airport_buffer_hours ?? 3) * 60

  // Minimum time the driver needs to be at the airport BEFORE a flight departs
  // (check-in, security, boarding) in order to realistically catch it — used
  // below to filter out flights the driver couldn't actually make it to. This
  // is a distinct concept from `flight_airport_buffer_hours`/AIRPORT_BUFFER_MINUTES
  // above: that one pads the job's BILLED hours to account for general dead time
  // around the flight (already-priced-in operational buffer), while this one
  // answers "is this specific flight even catchable." We reuse the same configured
  // value as a sensible baseline (so ops only has to think about one "airport
  // buffer" number), but this catchability check has a hard floor of 2 hours no
  // matter how low that setting is configured — a driver can't clear check-in and
  // security in less than that at a real airport, regardless of billing policy.
  const MIN_CHECKIN_BUFFER_HOURS = 2
  const CHECKIN_BUFFER_MINUTES = Math.max(pricingSettings?.flight_airport_buffer_hours ?? MIN_CHECKIN_BUFFER_HOURS, MIN_CHECKIN_BUFFER_HOURS) * 60

  type Segment = {
    marketing_carrier?: { name?: string; iata_code?: string }
    marketing_carrier_flight_number?: string
    origin?: { iata_code?: string; iata_country_code?: string }
    destination?: { iata_code?: string; iata_country_code?: string }
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

  function sortByStopsThenPrice(list: Offer[]): Offer[] {
    return [...list].sort((a, b) => {
      const stopsDiff = stopCount(a) - stopCount(b)
      if (stopsDiff !== 0) return stopsDiff
      return parseFloat(a.total_amount) - parseFloat(b.total_amount)
    })
  }

  function firstSegmentDepartureMs(offer: Offer): number | null {
    const dep = offer.slices[0]?.segments?.[0]?.departing_at
    if (!dep) return null
    const ms = new Date(dep).getTime()
    return isNaN(ms) ? null : ms
  }

  // Duffel returns departing_at as local wall-clock time at the departure
  // airport with no timezone offset (e.g. "2026-08-29T05:45:00") - extract
  // the hour directly from the string rather than via Date parsing, since
  // relying on Date + getUTCHours() to recover the original local hour only
  // works by coincidence (it depends on the server also running in UTC).
  function localDepartureHour(offer: Offer): number | null {
    const dep = offer.slices[0]?.segments?.[0]?.departing_at
    if (!dep) return null
    const match = dep.match(/T(\d{2}):/)
    return match ? parseInt(match[1], 10) : null
  }

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
      // Use the real earliest-viable-departure instant (when known) for the
      // traffic-aware drive-time estimate to the airport, since that's roughly
      // when this leg would actually happen — falls back to the bare departure
      // date if the caller didn't provide a timestamp.
      drivingLegToAirport(destinationAddress, flightFrom, earliestViableDepartureAt || date),
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
    const allOffers = (offerRequestData?.data?.offers ?? []) as Offer[]
    // Canada only. A connecting itinerary can route through a US hub (Seattle,
    // Minneapolis, Denver...) - that means US customs and a flight the driver
    // shouldn't be put on. Drop any offer where a segment starts or ends in
    // another country. (When Duffel doesn't say which country an airport is
    // in, it's kept rather than guessed at.)
    const inCanada = (code?: string) => code == null || code === 'CA'
    const offers = allOffers.filter((o) =>
      o.slices.every((sl) => sl.segments.every((sg) => inCanada(sg.origin?.iata_country_code) && inCanada(sg.destination?.iata_country_code)))
    )
    if (offers.length === 0) return { flightFrom, flightTo, flight: null, groundToAirport, groundFromAirport, effectiveCostCents: Infinity }

    // The earliest instant this driver could plausibly be standing at THIS
    // candidate airport's departure gate: estimated drop-off completion time
    // + drive time to this specific airport (varies per candidate) + the
    // check-in buffer above. Falls back to a flat 60-minute drive-time
    // estimate if the real drive-time lookup failed for this candidate.
    const DEFAULT_GROUND_TO_AIRPORT_MINUTES = 60
    let earliestCatchableDepartAt: number | null = null
    if (earliestViableDepartureAt) {
      const baseMs = new Date(earliestViableDepartureAt).getTime()
      if (!isNaN(baseMs)) {
        const groundMinutes = legMinutes(groundToAirport, DEFAULT_GROUND_TO_AIRPORT_MINUTES)
        earliestCatchableDepartAt = baseMs + groundMinutes * 60_000 + CHECKIN_BUFFER_MINUTES * 60_000
      }
    }

    let metCheckInBuffer = true
    let outsidePracticalHours = false
    let sorted: Offer[]
    if (earliestCatchableDepartAt != null) {
      const catchable = (offers as Offer[]).filter((o) => {
        const t = firstSegmentDepartureMs(o)
        return t != null && t >= earliestCatchableDepartAt!
      })
      if (catchable.length > 0) {
        const sortedByDeparture = [...catchable].sort(
          (a, b) => firstSegmentDepartureMs(a)! - firstSegmentDepartureMs(b)!
        )
        const earliestDepartMs = firstSegmentDepartureMs(sortedByDeparture[0])!

        // An "earliest catchable" flight can still be an unreasonable time
        // to expect a driver to be at the airport (e.g. 5:45am after a long
        // drive/overnight) even though it's technically catchable. Prefer
        // any catchable flight within a practical departure window over
        // blindly taking the earliest one, since a later-that-day flight
        // costs no extra money (same calendar day, no extra overnight) -
        // only falls back to "nearest the earliest catchable time" when
        // nothing that day falls in practical hours at all.
        const PRACTICAL_HOUR_START = 6
        const PRACTICAL_HOUR_END = 22
        const withinPracticalHours = sortedByDeparture.filter((o) => {
          const hour = localDepartureHour(o)
          return hour != null && hour >= PRACTICAL_HOUR_START && hour < PRACTICAL_HOUR_END
        })

        if (withinPracticalHours.length > 0) {
          sorted = sortByStopsThenPrice(withinPracticalHours)
        } else {
          // Nothing catchable that day falls in practical hours - fall back
          // to whatever's nearest the earliest catchable time, same as
          // before, so there's still a result rather than none at all.
          outsidePracticalHours = true
          const REASONABLE_WINDOW_MS = 4 * 60 * 60 * 1000
          const nearEarliest = sortedByDeparture.filter(
            (o) => firstSegmentDepartureMs(o)! <= earliestDepartMs + REASONABLE_WINDOW_MS
          )
          sorted = sortByStopsThenPrice(nearEarliest)
        }
      } else {
        // Nothing on this date departs late enough for the driver to actually
        // catch it — fall back to the day's best offer anyway (better than no
        // result at all) but flag it so the caller can warn the user / try the
        // next day instead of silently handing back an uncatchable flight.
        metCheckInBuffer = false
        sorted = sortByStopsThenPrice(offers as Offer[])
      }
    } else {
      sorted = sortByStopsThenPrice(offers as Offer[])
    }
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
    // Fares plus the paid driver time each leg adds (a long bus leg adds hours
    // the dealer is billed for, so it has to count when comparing airports).
    const toLeg = groundToAirport ? groundLegPricing(groundToAirport, legSettings) : null
    const fromLeg = groundFromAirport ? groundLegPricing(groundFromAirport, legSettings) : null
    const hourlyCents = pricingSettings?.hourly_rate_cents ?? 0
    const flightHoursCost = Math.round(((flightDurationMinutes + AIRPORT_BUFFER_MINUTES) / 60) * hourlyCents)
    const groundCostEstimate =
      (toLeg ? toLeg.dealerAmountCents + Math.round(toLeg.hoursAdded * hourlyCents) : 0) +
      (fromLeg ? fromLeg.dealerAmountCents + Math.round(fromLeg.hoursAdded * hourlyCents) : 0) +
      flightHoursCost
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
        departingAt: best.slices[0]?.segments?.[0]?.departing_at ?? null,
        arrivingAt: best.slices[0]?.segments?.[best.slices[0].segments.length - 1]?.arriving_at ?? null,
        // False when no flight on this date departed late enough for the driver
        // to realistically make it (drive time to this airport + check-in
        // buffer past the estimated drop-off completion time) — this is then
        // the best available fallback for the day, not a confirmed-catchable pick.
        meetsCheckInBuffer: metCheckInBuffer,
        // True when the chosen flight IS technically catchable, but every
        // catchable option that day fell outside a practical departure
        // window (before 6am or after 10pm) - distinct from
        // meetsCheckInBuffer, which is about whether the driver can reach
        // the airport in time at all, not whether the time itself is
        // reasonable to expect someone to fly at.
        outsidePracticalHours,
        // The actual clock time the driver would need to leave the pickup/
        // drop-off location to catch this specific flight, working backwards
        // from its real departure time - lets the caller show the dealer
        // exactly when the driver needs to be on the road by, not just an
        // abstract "hours to add" figure.
        driverMustLeaveBy: (() => {
          const departingAt = best.slices[0]?.segments?.[0]?.departing_at
          if (!departingAt) return null
          const groundMinutes = legMinutes(groundToAirport, DEFAULT_GROUND_TO_AIRPORT_MINUTES)
          const leaveByMs = new Date(departingAt).getTime() - CHECKIN_BUFFER_MINUTES * 60_000 - groundMinutes * 60_000
          return isNaN(leaveByMs) ? null : new Date(leaveByMs).toISOString()
        })(),
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
  const viable = results.filter((r): r is NonNullable<typeof r> => {
    if (r === null || r.flight === null) return false
    // A candidate airport can be geographically close in a straight line
    // (e.g. across water to Vancouver Island) while actually requiring a
    // ferry crossing to reach by road - Google's driving directions then
    // return a huge real distance trying to route around it. An Uber can't
    // drive across open water, so treat an unrealistically long ground leg
    // as this airport simply not being a practical option, not a valid
    // (if expensive) one to offer.
    const MAX_REASONABLE_UBER_KM = 150
    const legTooFar = (leg: { distanceKm: number; mode: 'uber' | 'bus' } | null) =>
      !!leg && (leg.mode === 'bus' ? leg.distanceKm > BUS_MAX_KM : leg.distanceKm > MAX_REASONABLE_UBER_KM)
    if (legTooFar(r.groundToAirport) || legTooFar(r.groundFromAirport)) return false
    return true
  })

  if (viable.length === 0) {
    // Every combination failed outright (not just "no offers") — fall back to
    // the single nearest-airport pair so the caller still gets a real error
    // and the ground-transport estimate, instead of nothing at all.
    const fallback = await searchOneRoute(fromCandidates[0], toCandidates[0])
    return NextResponse.json({ origin: fromCandidates[0], destination: toCandidates[0], flight: null, groundToAirport: fallback?.groundToAirport ?? null, groundFromAirport: fallback?.groundFromAirport ?? null })
  }

  // Prefer candidates whose chosen flight the driver could actually catch
  // (drive-to-airport + check-in buffer) over ones that couldn't, even if an
  // uncatchable option looks cheaper on paper — only fall back to considering
  // every viable candidate if literally none of them cleared the bar.
  const catchableViable = viable.filter((r) => r.flight!.meetsCheckInBuffer)
  const pool = catchableViable.length > 0 ? catchableViable : viable

  const cheapest = pool.reduce((best, cur) => (cur.effectiveCostCents < best.effectiveCostCents ? cur : best))
  const sortedOptions = [...pool].sort((a, b) => a.effectiveCostCents - b.effectiveCostCents)

  return NextResponse.json({
    origin: cheapest.flightFrom,
    destination: cheapest.flightTo,
    flight: cheapest.flight,
    // True when no candidate airport had a flight departing late enough for the
    // driver to realistically catch it that day (drive time + check-in buffer
    // past the estimated drop-off completion time) — the flight returned above
    // is the best available fallback, not a confirmed-catchable pick. Callers
    // should surface this clearly and consider searching the next day instead.
    noFlightMetCheckInBuffer: catchableViable.length === 0,
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
