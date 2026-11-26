import { isFerryIsolated } from '@/lib/bcGeography'

// Major BC Ferries terminals with coordinates, used to find the nearest
// terminal to an address (same nearest-match approach as the airport lookup
// for flights). Codes match bcferriesapi.ca's terminal codes.
const TERMINALS: { code: string; name: string; lat: number; lng: number }[] = [
  { code: 'TSA', name: 'Tsawwassen', lat: 49.0068, lng: -123.1305 },
  { code: 'SWB', name: 'Swartz Bay', lat: 48.6889, lng: -123.4103 },
  { code: 'HSB', name: 'Horseshoe Bay', lat: 49.3763, lng: -123.2727 },
  { code: 'NAN', name: 'Departure Bay (Nanaimo)', lat: 49.1959, lng: -123.9553 },
  { code: 'DUK', name: 'Duke Point (Nanaimo)', lat: 49.1497, lng: -123.8901 },
  { code: 'LNG', name: 'Langdale', lat: 49.4394, lng: -123.4753 },
  { code: 'BOW', name: 'Bowen Island (Snug Cove)', lat: 49.3803, lng: -123.3378 },
  { code: 'FUL', name: 'Fulford Harbour (Salt Spring)', lat: 48.7639, lng: -123.4494 },
  { code: 'PVB', name: 'Pender Island', lat: 48.7719, lng: -123.2853 },
  { code: 'POB', name: 'Otter Bay (Pender Island)', lat: 48.7986, lng: -123.3086 },
  { code: 'PST', name: 'Salt Spring (Long Harbour)', lat: 48.8447, lng: -123.4425 },
  { code: 'PSB', name: 'Mayne Island (Village Bay)', lat: 48.8408, lng: -123.2853 },
  { code: 'CHM', name: 'Chemainus', lat: 48.9256, lng: -123.7136 },
  { code: 'THT', name: 'Thetis Island', lat: 48.9861, lng: -123.6975 },
  { code: 'PEN', name: 'Penelakut Island', lat: 48.9686, lng: -123.6931 },
  { code: 'CMX', name: 'Comox', lat: 49.6606, lng: -124.9153 },
  { code: 'PWR', name: 'Powell River', lat: 49.8608, lng: -124.5347 },
  { code: 'CFT', name: 'Crofton', lat: 48.8686, lng: -123.6431 },
  { code: 'VES', name: 'Vesuvius (Salt Spring)', lat: 48.9186, lng: -123.5578 },
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

async function drivingLeg(address: string, point: { lat: number; lng: number }): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: point.lat, longitude: point.lng } } },
      destination: { address },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      units: 'METRIC',
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

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return null
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`)
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== 'OK') return null
  const loc = data.results?.[0]?.geometry?.location
  return loc ? { lat: loc.lat, lng: loc.lng } : null
}

// Ranks every terminal by distance from a point, closest first — rather than
// just picking the single nearest one. The nearest terminal to an address
// isn't always the one that actually has a route to the other side (e.g.
// Horseshoe Bay is closer to some mainland points than Tsawwassen, but only
// Tsawwassen actually connects to Swartz Bay).
function rankedTerminals(coords: { lat: number; lng: number }): { code: string; name: string; distanceKm: number; lat: number; lng: number }[] {
  return TERMINALS.map((t) => ({
    code: t.code,
    name: t.name,
    distanceKm: Math.round(haversineKm(coords.lat, coords.lng, t.lat, t.lng)),
    lat: t.lat,
    lng: t.lng,
  })).sort((a, b) => a.distanceKm - b.distanceKm)
}

// bcferriesapi.ca durations come in mixed formats: "01:35", "1h 35m", "55m", "40m", "10m"
function parseDurationMinutes(duration: string): number {
  if (!duration) return 0
  const hm = duration.match(/^(\d+):(\d+)$/)
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10)
  const hoursMatch = duration.match(/(\d+)\s*h/)
  const minsMatch = duration.match(/(\d+)\s*m/)
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0
  const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0
  return hours * 60 + mins
}

export function parseTimeToMinutesSinceMidnight(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (!match) return null
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toLowerCase()
  if (period === 'pm' && hours !== 12) hours += 12
  if (period === 'am' && hours === 12) hours = 0
  return hours * 60 + minutes
}

type Route = {
  fromTerminalCode: string
  toTerminalCode: string
  sailingDuration: string
  sailings: { time: string; arrivalTime: string; vesselStatus: string }[]
}

export type FerryLookupInput = {
  originAddress: string
  destinationAddress: string
  actualDrivingKm?: number
  actualDrivingMinutes?: number
}

export type FerryLeg = { distanceKm: number; durationMinutes: number }
export type FerryLookupData = {
  fromTerminal: { code: string; name: string; distanceKm: number }
  toTerminal: { code: string; name: string; distanceKm: number }
  sailingDurationMinutes: number
  avgGapMinutes: number
  sailingsPerDay: number
  sailingTimes: string[]
  /** departures in the opposite direction (destination terminal -> origin terminal), when the schedule lists that route */
  returnSailingTimes: string[]
  returnSailingDurationMinutes: number | null
  groundHome: FerryLeg | null
  groundToTerminal: FerryLeg | null
}
export type FerryLookupResult = { ok: true; data: FerryLookupData } | { ok: false; status: number; body: Record<string, unknown> }

// The BC Ferries lookup shared by the quote screens (/api/ferry/schedule) and the
// admin trip itinerary: which terminals a mainland-island trip uses, the sailing
// times, and the real driving legs to and from each terminal.
export async function lookupFerry({ originAddress, destinationAddress, actualDrivingKm, actualDrivingMinutes }: FerryLookupInput): Promise<FerryLookupResult> {
  if (!originAddress || !destinationAddress) {
    return { ok: false, status: 400, body: { error: 'Missing origin or destination address.' } }
  }

  const [originCoords, destCoords] = await Promise.all([geocodeAddress(originAddress), geocodeAddress(destinationAddress)])

  if (!originCoords || !destCoords) {
    const failed = !originCoords && !destCoords ? 'both addresses' : !originCoords ? `origin ("${originAddress}")` : `destination ("${destinationAddress}")`
    return { ok: false, status: 404, body: { error: `Could not geocode ${failed}.` } }
  }

  // The real bug behind false-positive ferry pricing: matching each address
  // to its nearest terminal (within 60km straight-line) and checking those
  // two terminals have a scheduled sailing between them only proves both
  // points are near water somewhere - it never confirms the real driving
  // route between the two addresses actually needs that ferry. A first
  // attempt gated on distance ratio (driving distance vs. straight-line)
  // alone wasn't strict enough: BC's coastal roads (Marine Drive, Sea-to-
  // Sky) are naturally curvy even with zero water crossings, so a moderate
  // ratio threshold let real false positives through (a 43.6km/36min drive
  // - obviously a normal, unbroken trip - still matched Horseshoe Bay to
  // Bowen Island).
  //
  // Average driving speed is a far more direct, geography-independent
  // signal: a route that genuinely includes a ferry loses real time to
  // boarding and the wait between sailings, which drags its average speed
  // well below anything achievable on a normal, unbroken drive - a curvy
  // coastal road doesn't do that on its own, it just adds distance, not a
  // multi-minute-per-km time penalty. Requires BOTH signals (a real
  // detour AND a speed consistent with lost ferry time) before trusting a
  // terminal match, rather than either alone.
  // One end on an island / the Sunshine Coast and the other on the mainland
  // always needs a ferry, however direct the driving route looks (a Vancouver
  // to Duncan trip is only ~1.7x its straight-line distance because the ferry
  // crosses the water almost in a straight line, which the check below
  // wrongly read as "a normal drive"). Skip that check in this case.
  const crossesWater = isFerryIsolated(originCoords.lat, originCoords.lng) !== isFerryIsolated(destCoords.lat, destCoords.lng)

  if (!crossesWater && typeof actualDrivingKm === 'number' && typeof actualDrivingMinutes === 'number' && actualDrivingMinutes > 0) {
    const straightLineKm = haversineKm(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng)
    const avgSpeedKmh = actualDrivingKm / (actualDrivingMinutes / 60)
    const looksLikeNormalDrive = avgSpeedKmh >= 45
    const notMuchOfADetour = straightLineKm > 0 && actualDrivingKm / straightLineKm < 1.8
    if (looksLikeNormalDrive || notMuchOfADetour) {
      return { ok: false, status: 404, body: {
        error: `Route looks like a normal continuous drive (${actualDrivingKm}km in ${actualDrivingMinutes}min, ~${Math.round(avgSpeedKmh)}km/h avg, vs ${Math.round(straightLineKm)}km straight-line) - too direct/too fast to plausibly include a ferry wait, so skipping the terminal check.`,
      } }
    }
  }

  // A mainland-to-island trip (crossesWater) has to look further down the list:
  // the terminals nearest a place like Duncan are small Gulf Island / Crofton
  // ones that don't connect to the mainland at all, so the real crossing
  // (Departure Bay, Duke Point, Swartz Bay) is further down the ranking.
  const candidateLimit = crossesWater ? 14 : 4
  const originCandidates = rankedTerminals(originCoords).filter((t) => t.distanceKm <= 60).slice(0, candidateLimit)
  const destCandidates = rankedTerminals(destCoords).filter((t) => t.distanceKm <= 60).slice(0, candidateLimit)

  if (originCandidates.length === 0 || destCandidates.length === 0) {
    const nearestOrigin = rankedTerminals(originCoords)[0]
    const nearestDest = rankedTerminals(destCoords)[0]
    return { ok: false, status: 404, body: {
      error: `No ferry terminal within 60km of ${originCandidates.length === 0 ? `origin (nearest is ${nearestOrigin.name}, ${nearestOrigin.distanceKm}km)` : `destination (nearest is ${nearestDest.name}, ${nearestDest.distanceKm}km)`}.`,
    } }
  }

  let scheduleRes: Response
  try {
    scheduleRes = await fetch('https://www.bcferriesapi.ca/v2/noncapacity/')
  } catch (e) {
    return { ok: false, status: 502, body: { error: `Ferry schedule service unreachable: ${e instanceof Error ? e.message : 'unknown error'}` } }
  }
  if (!scheduleRes.ok) {
    return { ok: false, status: 502, body: { error: `Ferry schedule service returned HTTP ${scheduleRes.status}.` } }
  }

  const scheduleData = await scheduleRes.json()
  const routes: Route[] = scheduleData.routes ?? []

  // Collect every connected pair of candidate terminals (closest pairs first).
  type Match = { origin: (typeof originCandidates)[number]; dest: (typeof destCandidates)[number]; route: Route }
  const matches: Match[] = []
  for (const o of originCandidates) {
    for (const d of destCandidates) {
      if (o.code === d.code) continue
      const route =
        routes.find((r) => r.fromTerminalCode === o.code && r.toTerminalCode === d.code) ??
        routes.find((r) => r.fromTerminalCode === d.code && r.toTerminalCode === o.code)
      if (!route || route.sailings.some((s) => s.vesselStatus?.includes('No sailings'))) continue
      matches.push({ origin: o, dest: d, route })
    }
  }
  matches.sort((a, b) => a.origin.distanceKm + a.dest.distanceKm - (b.origin.distanceKm + b.dest.distanceKm))

  let bestMatch: Match | null = matches[0] ?? null
  let preloadedLegs: [Awaited<ReturnType<typeof drivingLeg>>, Awaited<ReturnType<typeof drivingLeg>>] | null = null

  // Straight-line distance can't tell Horseshoe Bay - Departure Bay from
  // Tsawwassen - Swartz Bay for a Duncan trip (Swartz Bay is close to Duncan
  // as the crow flies, not by road). When crossing water, pick the pair with the
  // shortest real driving to the two terminals.
  if (crossesWater && matches.length > 1) {
    const top = matches.slice(0, 3)
    const legs = await Promise.all(
      top.map((m) =>
        Promise.all([
          drivingLeg(originAddress, { lat: m.origin.lat, lng: m.origin.lng }),
          drivingLeg(destinationAddress, { lat: m.dest.lat, lng: m.dest.lng }),
        ])
      )
    )
    let bestMinutes = Infinity
    legs.forEach((pair, i) => {
      if (!pair[0] || !pair[1]) return
      const minutes = pair[0].durationMinutes + pair[1].durationMinutes
      if (minutes < bestMinutes) {
        bestMinutes = minutes
        bestMatch = top[i]
        preloadedLegs = pair
      }
    })
  }

  if (!bestMatch) {
    return { ok: false, status: 404, body: {
      error: `Checked ${originCandidates.map((t) => t.code).join('/')} → ${destCandidates.map((t) => t.code).join('/')} — no connected route found in the ${routes.length}-route schedule.`,
      originCandidates,
      destCandidates,
    } }
  }

  const fromTerminal = { code: bestMatch.origin.code, name: bestMatch.origin.name, distanceKm: bestMatch.origin.distanceKm }
  const toTerminal = { code: bestMatch.dest.code, name: bestMatch.dest.name, distanceKm: bestMatch.dest.distanceKm }
  const route = bestMatch.route
  const returnRoute =
    routes.find((r) => r.fromTerminalCode === bestMatch!.dest.code && r.toTerminalCode === bestMatch!.origin.code &&
      !r.sailings.some((x) => x.vesselStatus?.includes('No sailings'))) ?? null

  const sailingDurationMinutes = parseDurationMinutes(route.sailingDuration)
  const sailingTimes = route.sailings
    .map((s) => parseTimeToMinutesSinceMidnight(s.time))
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b)

  let avgGapMinutes = 90 // reasonable fallback if we can't compute gaps
  if (sailingTimes.length > 1) {
    const gaps = []
    for (let i = 1; i < sailingTimes.length; i++) gaps.push(sailingTimes[i] - sailingTimes[i - 1])
    avgGapMinutes = Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length)
  }

  // When the driver returns as a walk-on passenger, they land back at the
  // origin-side terminal and still need a ride from there to the dealership —
  // a real driven distance, not a flat guess, since we know exactly where both ends are.
  // The other half of a walk-on return: the driver also has to get from the
  // drop-off address to the ferry terminal on that side first.
  const chosen = bestMatch as Match
  const [groundHome, groundToTerminal] = preloadedLegs ?? await Promise.all([
    drivingLeg(originAddress, { lat: chosen.origin.lat, lng: chosen.origin.lng }),
    drivingLeg(destinationAddress, { lat: chosen.dest.lat, lng: chosen.dest.lng }),
  ])

  return {
    ok: true,
    data: {
      fromTerminal,
      toTerminal,
      sailingDurationMinutes,
      avgGapMinutes,
      sailingsPerDay: sailingTimes.length,
      sailingTimes: route.sailings.map((s) => s.time),
      returnSailingTimes: returnRoute ? returnRoute.sailings.map((s) => s.time) : [],
      returnSailingDurationMinutes: returnRoute ? parseDurationMinutes(returnRoute.sailingDuration) || null : null,
      groundHome,
      groundToTerminal,
    },
  }
}
