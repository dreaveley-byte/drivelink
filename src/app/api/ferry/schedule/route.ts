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

async function nearestTerminal(address: string): Promise<{ code: string; name: string; distanceKm: number } | null> {
  const coords = await geocodeAddress(address)
  if (!coords) return null
  let closest = TERMINALS[0]
  let closestDist = Infinity
  for (const terminal of TERMINALS) {
    const dist = haversineKm(coords.lat, coords.lng, terminal.lat, terminal.lng)
    if (dist < closestDist) {
      closestDist = dist
      closest = terminal
    }
  }
  return { code: closest.code, name: closest.name, distanceKm: Math.round(closestDist) }
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

export async function POST(req: NextRequest) {
  const { originAddress, destinationAddress } = await req.json()
  if (!originAddress || !destinationAddress) {
    return NextResponse.json({ error: 'Missing origin or destination address.' }, { status: 400 })
  }

  const [fromTerminal, toTerminal] = await Promise.all([
    nearestTerminal(originAddress),
    nearestTerminal(destinationAddress),
  ])

  if (!fromTerminal || !toTerminal) {
    const failed = !fromTerminal && !toTerminal ? 'both addresses' : !fromTerminal ? `origin ("${originAddress}")` : `destination ("${destinationAddress}")`
    return NextResponse.json({ error: `Could not geocode ${failed}.` }, { status: 404 })
  }

  // If the nearest terminal is genuinely far from either address, this route
  // likely doesn't actually cross by ferry near these points — bail out rather
  // than return a misleading "route."
  if (fromTerminal.distanceKm > 60 || toTerminal.distanceKm > 60) {
    return NextResponse.json({
      error: `Nearest terminals too far away (${fromTerminal.name} ${fromTerminal.distanceKm}km, ${toTerminal.name} ${toTerminal.distanceKm}km) — likely not a ferry route.`,
      fromTerminal,
      toTerminal,
    }, { status: 404 })
  }

  if (fromTerminal.code === toTerminal.code) {
    return NextResponse.json({
      error: `Both addresses matched the same nearest terminal (${fromTerminal.name}) — not a ferry route.`,
      fromTerminal,
      toTerminal,
    }, { status: 404 })
  }

  let scheduleRes: Response
  try {
    scheduleRes = await fetch('https://www.bcferriesapi.ca/v2/noncapacity/')
  } catch (e) {
    return NextResponse.json({ error: `Ferry schedule service unreachable: ${e instanceof Error ? e.message : 'unknown error'}`, fromTerminal, toTerminal }, { status: 502 })
  }
  if (!scheduleRes.ok) {
    return NextResponse.json({ error: `Ferry schedule service returned HTTP ${scheduleRes.status}.`, fromTerminal, toTerminal }, { status: 502 })
  }

  const scheduleData = await scheduleRes.json()
  type Route = {
    fromTerminalCode: string
    toTerminalCode: string
    sailingDuration: string
    sailings: { time: string; arrivalTime: string; vesselStatus: string }[]
  }
  const routes: Route[] = scheduleData.routes ?? []

  // Try the direct match first; if that specific direction isn't listed, the
  // reverse direction's duration/frequency is a reasonable stand-in (crossings
  // are symmetric in practice) rather than giving up entirely.
  const route =
    routes.find((r) => r.fromTerminalCode === fromTerminal.code && r.toTerminalCode === toTerminal.code) ??
    routes.find((r) => r.fromTerminalCode === toTerminal.code && r.toTerminalCode === fromTerminal.code)

  if (!route || route.sailings.some((s) => s.vesselStatus?.includes('No sailings'))) {
    return NextResponse.json({
      error: `Matched terminals ${fromTerminal.name} (${fromTerminal.code}) → ${toTerminal.name} (${toTerminal.code}), but no route code "${fromTerminal.code}${toTerminal.code}" or "${toTerminal.code}${fromTerminal.code}" found in the ${routes.length}-route schedule.`,
      fromTerminal,
      toTerminal,
    }, { status: 404 })
  }

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

  return NextResponse.json({
    fromTerminal,
    toTerminal,
    sailingDurationMinutes,
    avgGapMinutes,
    sailingsPerDay: sailingTimes.length,
    sailingTimes: route.sailings.map((s) => s.time),
  })
}
