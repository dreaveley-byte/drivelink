import { isFerryIsolated } from '@/lib/bcGeography'

// Canadian airports only (US airports deliberately excluded - see note at
// the end of this list), with coordinates,
// used to find the nearest real airport to any address — much more reliable
// than trying to text-match a city name against an airline database, since
// most people don't live in a city that has its own airport.
export const AIRPORTS: { code: string; name: string; lat: number; lng: number; islandOnly?: boolean; hub?: boolean }[] = [
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

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
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

export async function nearbyAirports(address: string, maxCandidates: number, maxRadiusKm: number, maxHubRadiusKm = HUB_RADIUS_KM, maxHubs = MAX_HUBS): Promise<{ code: string; name: string; lat: number; lng: number }[] | { error: string }> {
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

