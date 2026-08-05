import { NextRequest, NextResponse } from 'next/server'

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

function parseTimeToMinutesSinceMidnight(time: string): number | null {
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

export async function POST(req: NextRequest) {
  const { originAddress, destinationAddress } = await req.json()
  if (!originAddress || !destinationAddress) {
    return NextResponse.json({ error: 'Missing origin or destination address.' }, { status: 400 })
  }

  const [originCoords, destCoords] = await Promise.all([geocodeAddress(originAddress), geocodeAddress(destinationAddress)])

  if (!originCoords || !destCoords) {
    const failed = !originCoords && !destCoords ? 'both addresses' : !originCoords ? `origin ("${originAddress}")` : `destination ("${destinationAddress}")`
    return NextResponse.json({ error: `Could not geocode ${failed}.` }, { status: 404 })
  }

  const originCandidates = rankedTerminals(originCoords).filter((t) => t.distanceKm <= 60).slice(0, 4)
  const destCandidates = rankedTerminals(destCoords).filter((t) => t.distanceKm <= 60).slice(0, 4)

  if (originCandidates.length === 0 || destCandidates.length === 0) {
    const nearestOrigin = rankedTerminals(originCoords)[0]
    const nearestDest = rankedTerminals(destCoords)[0]
    return NextResponse.json({
      error: `No ferry terminal within 60km of ${originCandidates.length === 0 ? `origin (nearest is ${nearestOrigin.name}, ${nearestOrigin.distanceKm}km)` : `destination (nearest is ${nearestDest.name}, ${nearestDest.distanceKm}km)`}.`,
    }, { status: 404 })
  }

  let scheduleRes: Response
  try {
    scheduleRes = await fetch('https://www.bcferriesapi.ca/v2/noncapacity/')
  } catch (e) {
    return NextResponse.json({ error: `Ferry schedule service unreachable: ${e instanceof Error ? e.message : 'unknown error'}` }, { status: 502 })
  }
  if (!scheduleRes.ok) {
    return NextResponse.json({ error: `Ferry schedule service returned HTTP ${scheduleRes.status}.` }, { status: 502 })
  }

  const scheduleData = await scheduleRes.json()
  const routes: Route[] = scheduleData.routes ?? []

  // Check every combination of candidate terminals (closest pairs first) and use
  // the first one that's an actual connected route in the schedule.
  let bestMatch: { origin: (typeof originCandidates)[number]; dest: (typeof destCandidates)[number]; route: Route } | null = null
  let bestTotalDistance = Infinity

  for (const o of originCandidates) {
    for (const d of destCandidates) {
      if (o.code === d.code) continue
      const route =
        routes.find((r) => r.fromTerminalCode === o.code && r.toTerminalCode === d.code) ??
        routes.find((r) => r.fromTerminalCode === d.code && r.toTerminalCode === o.code)
      if (!route || route.sailings.some((s) => s.vesselStatus?.includes('No sailings'))) continue
      const totalDistance = o.distanceKm + d.distanceKm
      if (totalDistance < bestTotalDistance) {
        bestTotalDistance = totalDistance
        bestMatch = { origin: o, dest: d, route }
      }
    }
  }

  if (!bestMatch) {
    return NextResponse.json({
      error: `Checked ${originCandidates.map((t) => t.code).join('/')} → ${destCandidates.map((t) => t.code).join('/')} — no connected route found in the ${routes.length}-route schedule.`,
      originCandidates,
      destCandidates,
    }, { status: 404 })
  }

  const fromTerminal = { code: bestMatch.origin.code, name: bestMatch.origin.name, distanceKm: bestMatch.origin.distanceKm }
  const toTerminal = { code: bestMatch.dest.code, name: bestMatch.dest.name, distanceKm: bestMatch.dest.distanceKm }
  const route = bestMatch.route

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
  const groundHome = await drivingLeg(originAddress, { lat: bestMatch.origin.lat, lng: bestMatch.origin.lng })

  return NextResponse.json({
    fromTerminal,
    toTerminal,
    sailingDurationMinutes,
    avgGapMinutes,
    sailingsPerDay: sailingTimes.length,
    sailingTimes: route.sailings.map((s) => s.time),
    groundHome,
  })
}
