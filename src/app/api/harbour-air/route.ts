import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { groundLegPricing, type AdditionalCharge, type GroundLeg } from '@/lib/pricing'
import { HARBOUR_AIR_BASES, isFerryIsolated } from '@/lib/bcGeography'

// The Harbour Air seaplane as a way home across the Strait of Georgia: the
// driver delivers the vehicle on one side of the water and takes a seaplane
// (Vancouver Harbour <-> Victoria or Nanaimo) back instead of a ferry.
// There's no live fare feed, so the fare comes from editable settings and the
// charge description says it's an estimate. Returns ready-to-use charges in
// the same shape the rest of the quote builder uses.

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return null
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=ca&key=${key}`)
  if (!res.ok) return null
  const data = await res.json()
  const loc = data.status === 'OK' ? data.results?.[0]?.geometry?.location : null
  return loc ? { lat: loc.lat, lng: loc.lng } : null
}

type Endpoint = { address: string } | { lat: number; lng: number }

async function drive(from: Endpoint, to: Endpoint): Promise<GroundLeg | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return null
  const wp = (e: Endpoint) => ('address' in e ? { address: e.address } : { location: { latLng: { latitude: e.lat, longitude: e.lng } } })
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration' },
    body: JSON.stringify({ origin: wp(from), destination: wp(to), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', units: 'METRIC' }),
  })
  if (!res.ok) return null
  const route = (await res.json()).routes?.[0]
  if (!route) return null
  const seconds = parseInt(String(route.duration).replace('s', ''), 10)
  return {
    distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10,
    durationMinutes: Math.round(seconds / 60),
    mode: 'uber',
  }
}

export async function POST(req: NextRequest) {
  const { pickupAddress, dropoffAddress } = await req.json()
  if (!pickupAddress || !dropoffAddress) {
    return NextResponse.json({ error: 'Missing pickup or dropoff address.' }, { status: 400 })
  }

  const [pickup, dropoff] = await Promise.all([geocode(pickupAddress), geocode(dropoffAddress)])
  if (!pickup || !dropoff) return NextResponse.json({ available: false, reason: 'Could not locate one of the addresses.' })

  // Only meaningful when exactly one end is across the water from the other.
  const pickupAcross = isFerryIsolated(pickup.lat, pickup.lng)
  const dropoffAcross = isFerryIsolated(dropoff.lat, dropoff.lng)
  if (pickupAcross === dropoffAcross) {
    return NextResponse.json({ available: false, reason: 'Pickup and drop-off are on the same side of the water.' })
  }

  const islandAddr = pickupAcross ? pickup : dropoff
  const islandBases = HARBOUR_AIR_BASES.filter((b) => b.island)
  const islandBase = islandBases
    .map((b) => ({ b, d: haversineKm(islandAddr.lat, islandAddr.lng, b.lat, b.lng) }))
    .sort((a, b) => a.d - b.d)[0]
  const mainBase = HARBOUR_AIR_BASES.find((b) => !b.island)!
  if (!islandBase || islandBase.d > 120) {
    return NextResponse.json({ available: false, reason: 'No Harbour Air base within reach of the island address.' })
  }

  // Driver leaves from the drop-off side and lands on the pickup side.
  const fromBase = dropoffAcross ? islandBase.b : mainBase
  const toBase = pickupAcross ? islandBase.b : mainBase
  const [toBaseLeg, homeLeg] = await Promise.all([
    drive({ address: dropoffAddress }, { lat: fromBase.lat, lng: fromBase.lng }),
    drive({ lat: toBase.lat, lng: toBase.lng }, { address: pickupAddress }),
  ])
  if (!toBaseLeg || !homeLeg) return NextResponse.json({ available: false, reason: 'Could not route to the seaplane base.' })

  // A seaplane base is only a realistic option when the rides to and from it
  // are short Uber-style hops, not an intercity trip.
  const MAX_RIDE_KM = 100
  if (toBaseLeg.distanceKm > MAX_RIDE_KM || homeLeg.distanceKm > MAX_RIDE_KM) {
    return NextResponse.json({ available: false, reason: 'The seaplane base is too far from one end to be practical.' })
  }

  const supabase = await createClient()
  const { data: settings } = await supabase.from('pricing_settings').select('*').eq('id', 1).single()
  if (!settings) return NextResponse.json({ available: false, reason: 'Pricing settings unavailable.' })

  const fareCents: number =
    islandBase.b.code === 'CYWH' ? settings.harbour_air_victoria_fare_cents ?? 14900 : settings.harbour_air_nanaimo_fare_cents ?? 10900
  const flightMinutes: number = settings.harbour_air_flight_minutes ?? 35
  const bufferHours: number = Number(settings.harbour_air_buffer_hours ?? 1)

  const toLeg = groundLegPricing(toBaseLeg, settings)
  const homePrice = groundLegPricing(homeLeg, settings)

  const charges: AdditionalCharge[] = [
    {
      description: `Ground transport to airport — ride to Harbour Air, ${fromBase.name}, ${toBaseLeg.distanceKm}km`,
      kind: 'ground-to-airport',
      dealerAmountCents: toLeg.dealerAmountCents,
      hoursAdded: toLeg.hoursAdded,
      paidToDriver: true,
    },
    {
      description: `Flight back: Harbour Air seaplane ${fromBase.name} → ${toBase.name} (~${flightMinutes} min, fare is an estimate — confirm with Harbour Air)`,
      kind: 'flight',
      dealerAmountCents: fareCents,
      hoursAdded: Math.round((flightMinutes / 60 + bufferHours) * 100) / 100,
      paidToDriver: false,
    },
    {
      description: `Return ground transport — ride from Harbour Air, ${toBase.name}, ${homeLeg.distanceKm}km`,
      kind: 'ground-home',
      dealerAmountCents: homePrice.dealerAmountCents,
      hoursAdded: homePrice.hoursAdded,
      paidToDriver: true,
    },
  ]

  return NextResponse.json({
    available: true,
    from: { code: fromBase.code, name: fromBase.name },
    to: { code: toBase.code, name: toBase.name },
    charges,
  })
}
