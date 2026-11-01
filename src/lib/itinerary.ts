import { nearbyAirports, geocodeAddress } from '@/lib/airports'
import { groundLegPricing, AVG_BUS_SPEED_KMH } from '@/lib/pricing'
import { zonedLocalInputToUtcIso } from '@/lib/localDatetime'

// Builds one connected, chronological trip plan for a vehicle transport:
// drive -> handover -> registry -> ground leg to airport -> flight -> ride home.
// Every step starts when the previous one ends (plus any waiting time), and is
// labelled as live provider data, an estimate, or unavailable. Nothing here is
// ever "confirmed": flights and bus tickets are not booked by this tool.

export type StepStatus = 'live' | 'estimate' | 'unavailable' | 'skipped'

export type ItineraryStep = {
  id: string
  kind: 'drive' | 'handover' | 'to-registry' | 'registry' | 'wait' | 'ground-to-airport' | 'airport' | 'flight' | 'ride-home'
  title: string
  status: StepStatus
  /** short text explaining where the data came from */
  source: string
  startUtc: string | null
  endUtc: string | null
  startTz: string | null
  endTz: string | null
  from?: string
  to?: string
  details: string[]
  costCents: number | null
  /** how the cost was arrived at */
  costBasis?: 'live fare' | 'estimate' | 'free'
  warnings: string[]
}

export type CostLine = { label: string; cents: number; basis: 'live fare' | 'estimate' | 'free' }

export type Itinerary = {
  confirmed: false
  generatedAt: string
  startUtc: string
  endUtc: string | null
  startTz: string | null
  endTz: string | null
  totalMinutes: number | null
  steps: ItineraryStep[]
  costs: CostLine[]
  /** sum of the itinerary's own transport costs (bus/Uber/flight) */
  transportCents: number
  warnings: string[]
  alternatives: { label: string; totalCents: number; departs: string | null }[]
}

export type ItineraryInput = {
  pickupAddress: string
  dropoffAddress: string
  startUtc: string
  registryRequired: boolean
  settings: Record<string, number | null | undefined>
}

const MIN = 60_000
const EXIT_BUFFER_MIN = 30 // deplane, collect bags and meet the ride
const RIDE_REQUEST_BUFFER_MIN = 10 // time to request/meet a ride or reach the stop
const INTERCITY_KM = 100
const WALK_MAX_KM = 1.5

// ---------- time helpers (exported for tests) ----------

export type Period = { open: { day: number; time: string }; close?: { day: number; time: string } }

const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function localWeekMinute(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ms))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  const day = DAY_INDEX[get('weekday')] ?? 0
  const hour = get('hour') === '24' ? 0 : parseInt(get('hour'), 10)
  return day * 1440 + hour * 60 + parseInt(get('minute'), 10)
}

function hhmm(t: string): number {
  return parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(2, 4), 10)
}

export function isOpenAt(periods: Period[], ms: number, tz: string): boolean {
  if (periods.length === 1 && !periods[0].close) return true // open 24/7
  const w = localWeekMinute(ms, tz)
  return periods.some((p) => {
    if (!p.close) return false
    const o = p.open.day * 1440 + hhmm(p.open.time)
    const c = p.close.day * 1440 + hhmm(p.close.time)
    return o <= c ? w >= o && w < c : w >= o || w < c
  })
}

/** open at the start, at the end, and every 15 minutes in between */
export function isOpenThrough(periods: Period[], startMs: number, durationMin: number, tz: string): boolean {
  for (let m = 0; m <= durationMin; m += 15) if (!isOpenAt(periods, startMs + m * MIN, tz)) return false
  return isOpenAt(periods, startMs + durationMin * MIN, tz)
}

export function nextOpening(periods: Period[], fromMs: number, durationMin: number, tz: string, maxDays = 8): number | null {
  for (let m = 0; m <= maxDays * 1440; m += 5) {
    const t = fromMs + m * MIN
    if (isOpenThrough(periods, t, durationMin, tz)) {
      // Refine to the exact minute the office opens (the scan above moves in 5-minute steps).
      let exact = t
      for (let back = 1; back <= 4; back++) {
        const earlier = t - back * MIN
        if (earlier >= fromMs && isOpenThrough(periods, earlier, durationMin, tz)) exact = earlier
        else break
      }
      return exact
    }
  }
  return null
}

export function fmtLocal(ms: number, tz: string): string {
  const t = new Intl.DateTimeFormat('en-CA', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }).format(new Date(ms))
  return t
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function localDateInTz(ms: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
}

function localHourInTz(ms: number, tz: string): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date(ms))
  return h === '24' ? 0 : parseInt(h, 10)
}

function addDaysToDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---------- provider calls ----------

const googleKey = () => process.env.GOOGLE_MAPS_API_KEY

const tzCache = new Map<string, string | null>()
async function timeZoneAt(lat: number, lng: number, atMs: number): Promise<string | null> {
  const k = `${lat.toFixed(2)},${lng.toFixed(2)}`
  if (tzCache.has(k)) return tzCache.get(k) ?? null
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${Math.floor(atMs / 1000)}&key=${googleKey()}`)
    const data = await res.json()
    const tz = data.status === 'OK' ? (data.timeZoneId as string) : null
    tzCache.set(k, tz)
    return tz
  } catch {
    return null
  }
}

type Waypoint = { address: string } | { lat: number; lng: number }
const wp = (w: Waypoint) => ('address' in w ? { address: w.address } : { location: { latLng: { latitude: w.lat, longitude: w.lng } } })

type TransitStep = {
  kind: 'walk' | 'transit'
  durationMin: number
  distanceKm: number
  departStop?: string
  arriveStop?: string
  departMs?: number
  arriveMs?: number
  line?: string
  operator?: string
  vehicle?: string
  headsign?: string
}

type RouteResult = {
  distanceKm: number
  durationMin: number
  steps: TransitStep[]
  fareCents: number | null
}

async function computeRoute(origin: Waypoint, dest: Waypoint, mode: 'DRIVE' | 'WALK' | 'TRANSIT', departMs?: number): Promise<RouteResult | null> {
  const key = googleKey()
  if (!key) return null
  const future = departMs != null && departMs > Date.now() + 60_000
  const body: Record<string, unknown> = {
    origin: wp(origin),
    destination: wp(dest),
    travelMode: mode,
    units: 'METRIC',
  }
  if (mode === 'DRIVE') body.routingPreference = 'TRAFFIC_AWARE'
  if (mode === 'TRANSIT') body.transitPreferences = { allowedTravelModes: ['BUS', 'TRAIN'], routingPreference: 'FEWER_TRANSFERS' }
  if (future && mode !== 'WALK') body.departureTime = iso(departMs!)
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'routes.distanceMeters,routes.duration,routes.travelAdvisory.transitFare,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.distanceMeters,routes.legs.steps.transitDetails',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) return null
    const secs = parseInt(String(route.duration).replace('s', ''), 10)
    const steps: TransitStep[] = []
    for (const leg of route.legs ?? []) {
      for (const s of leg.steps ?? []) {
        const dur = Math.round(parseInt(String(s.staticDuration ?? '0s').replace('s', ''), 10) / 60)
        const distanceKm = Math.round(((s.distanceMeters ?? 0) / 1000) * 10) / 10
        if (s.travelMode === 'TRANSIT' && s.transitDetails) {
          const t = s.transitDetails
          steps.push({
            kind: 'transit',
            durationMin: dur,
            distanceKm,
            departStop: t.stopDetails?.departureStop?.name,
            arriveStop: t.stopDetails?.arrivalStop?.name,
            departMs: t.stopDetails?.departureTime ? new Date(t.stopDetails.departureTime).getTime() : undefined,
            arriveMs: t.stopDetails?.arrivalTime ? new Date(t.stopDetails.arrivalTime).getTime() : undefined,
            line: t.transitLine?.nameShort || t.transitLine?.name,
            operator: t.transitLine?.agencies?.[0]?.name,
            vehicle: t.transitLine?.vehicle?.name?.text || t.transitLine?.vehicle?.type,
            headsign: t.headsign,
          })
        } else {
          steps.push({ kind: 'walk', durationMin: dur, distanceKm })
        }
      }
    }
    const fare = route.travelAdvisory?.transitFare
    const fareCents = fare && fare.units != null ? Math.round((parseInt(String(fare.units), 10) + (fare.nanos ?? 0) / 1e9) * 100) : null
    return { distanceKm: Math.round((route.distanceMeters / 1000) * 10) / 10, durationMin: Math.round(secs / 60), steps, fareCents }
  } catch {
    return null
  }
}

type RegistryInfo = {
  name: string
  address: string
  lat: number
  lng: number
  periods: Period[] | null
  weekdayText: string[] | null
}

async function findRegistry(near: { lat: number; lng: number }, address: string): Promise<RegistryInfo | null> {
  const key = googleKey()
  if (!key) return null
  const q = /,\s*AB\b/i.test(address) ? 'registry agent' : /,\s*BC\b/i.test(address) ? 'ICBC driver licensing office' : 'motor vehicle registry office'
  try {
    const search = await (await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&location=${near.lat},${near.lng}&radius=15000&key=${key}`)).json()
    const hit = search.results?.[0]
    if (!hit?.place_id) return null
    const det = await (await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${hit.place_id}&fields=name,formatted_address,geometry,opening_hours&key=${key}`)).json()
    const r = det.result
    if (!r?.geometry?.location) return null
    return {
      name: r.name ?? hit.name,
      address: r.formatted_address ?? hit.formatted_address ?? '',
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      periods: r.opening_hours?.periods ?? null,
      weekdayText: r.opening_hours?.weekday_text ?? null,
    }
  } catch {
    return null
  }
}

async function convertToCad(amountCents: number, currency: string): Promise<number> {
  if (currency === 'CAD') return amountCents
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=CAD`)
    const data = await res.json()
    const rate = data?.rates?.CAD
    return rate ? Math.round(amountCents * rate) : amountCents
  } catch {
    return amountCents
  }
}

type FlightPick = {
  segments: { airline: string; flightNumber: string; operatedBy: string | null; from: string; to: string; fromName: string | null; toName: string | null; departMs: number; arriveMs: number; fromTz: string; toTz: string }[]
  priceCents: number
  stops: number
  departMs: number
  arriveMs: number
  fromTz: string
  toTz: string
  outsidePractical: boolean
}

async function searchFlight(from: { code: string; lat: number; lng: number }, to: { code: string; lat: number; lng: number }, earliestMs: number, fromTzGuess: string | null, toTzGuess: string | null, hourlyCents: number): Promise<{ pick: FlightPick | null; searchedDates: string[]; error?: string }> {
  const token = process.env.DUFFEL_ACCESS_TOKEN
  if (!token) return { pick: null, searchedDates: [], error: 'Flight search isn’t set up (no Duffel key).' }
  const tz0 = fromTzGuess ?? 'America/Vancouver'
  const firstDate = localDateInTz(earliestMs, tz0)
  const searched: string[] = []

  for (let i = 0; i < 3; i++) {
    const date = addDaysToDate(firstDate, i)
    searched.push(date)
    let offers: any[] = []
    try {
      const res = await fetch('https://api.duffel.com/air/offer_requests?return_offers=true', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Duffel-Version': 'v2', 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ data: { slices: [{ origin: from.code, destination: to.code, departure_date: date }], passengers: [{ type: 'adult' }], cabin_class: 'economy' } }),
      })
      if (!res.ok) continue
      offers = (await res.json())?.data?.offers ?? []
    } catch {
      continue
    }

    // Canada only; and convert Duffel's local wall-clock times to real instants.
    const parsed: { offer: any; segs: FlightPick['segments']; departMs: number; arriveMs: number }[] = []
    for (const o of offers) {
      const rawSegs = o.slices?.[0]?.segments ?? []
      if (rawSegs.length === 0) continue
      const allCanada = rawSegs.every((s: any) => (s.origin?.iata_country_code ?? 'CA') === 'CA' && (s.destination?.iata_country_code ?? 'CA') === 'CA')
      if (!allCanada) continue
      const segs: FlightPick['segments'] = []
      let ok = true
      for (const s of rawSegs) {
        const oTz = s.origin?.time_zone ?? (s.origin?.iata_code === from.code ? fromTzGuess : null)
        const dTz = s.destination?.time_zone ?? (s.destination?.iata_code === to.code ? toTzGuess : null)
        if (!oTz || !dTz || !s.departing_at || !s.arriving_at) { ok = false; break }
        const dep = zonedLocalInputToUtcIso(String(s.departing_at).slice(0, 16), oTz)
        const arr = zonedLocalInputToUtcIso(String(s.arriving_at).slice(0, 16), dTz)
        if (!dep || !arr) { ok = false; break }
        const marketing = s.marketing_carrier?.name ?? s.marketing_carrier?.iata_code ?? 'Airline'
        const operating = s.operating_carrier?.name
        segs.push({
          airline: marketing,
          flightNumber: `${s.marketing_carrier?.iata_code ?? ''}${s.marketing_carrier_flight_number ?? ''}`,
          operatedBy: operating && operating !== marketing ? operating : null,
          from: s.origin?.iata_code, to: s.destination?.iata_code,
          fromName: s.origin?.name ?? null, toName: s.destination?.name ?? null,
          departMs: new Date(dep).getTime(), arriveMs: new Date(arr).getTime(), fromTz: oTz, toTz: dTz,
        })
      }
      if (!ok) continue
      parsed.push({ offer: o, segs, departMs: segs[0].departMs, arriveMs: segs[segs.length - 1].arriveMs })
    }

    const catchable = parsed.filter((p) => p.departMs >= earliestMs).sort((a, b) => a.departMs - b.departMs)
    if (catchable.length === 0) continue
    const practical = catchable.filter((p) => {
      const h = localHourInTz(p.departMs, p.segs[0].fromTz)
      return h >= 6 && h < 22
    })
    const pool = practical.length > 0 ? practical : catchable
    const stops = (p: { segs: unknown[] }) => p.segs.length - 1
    // Fewer stops first; then the cheapest once the driver's paid waiting time
    // before departure is counted (a $20 cheaper flight 8 hours later costs more).
    const waitCost = (p: { departMs: number }) => Math.round(((p.departMs - earliestMs) / 3_600_000) * hourlyCents)
    const total = (p: { offer: { total_amount: string }; departMs: number }) => Math.round(parseFloat(p.offer.total_amount) * 100) + waitCost(p)
    pool.sort((a, b) => stops(a) - stops(b) || total(a) - total(b) || a.departMs - b.departMs)
    const best = pool[0]
    const priceCents = await convertToCad(Math.round(parseFloat(best.offer.total_amount) * 100), best.offer.total_currency)
    return {
      pick: {
        segments: best.segs, priceCents, stops: stops(best), departMs: best.departMs, arriveMs: best.arriveMs,
        fromTz: best.segs[0].fromTz, toTz: best.segs[best.segs.length - 1].toTz, outsidePractical: practical.length === 0,
      },
      searchedDates: searched,
    }
  }
  return { pick: null, searchedDates: searched }
}

// ---------- the builder ----------

type GroundLegPlan = {
  mode: 'bus' | 'uber'
  status: StepStatus
  source: string
  departMs: number
  arriveMs: number
  fareCents: number
  fareBasis: 'live fare' | 'estimate'
  details: string[]
  warnings: string[]
  distanceKm: number
}

export async function buildItinerary(input: ItineraryInput): Promise<Itinerary> {
  const { settings: s } = input
  const num = (k: string, d: number) => (typeof s[k] === 'number' ? (s[k] as number) : d)
  const startMs = new Date(input.startUtc).getTime()
  const steps: ItineraryStep[] = []
  const warnings: string[] = []
  const costs: CostLine[] = []

  const legSettings = {
    uber_base_fare_cents: num('uber_base_fare_cents', 0),
    uber_per_km_cents: num('uber_per_km_cents', 0),
    uber_minimum_fare_cents: num('uber_minimum_fare_cents', 0),
    bus_base_fare_cents: num('bus_base_fare_cents', 3000),
    bus_per_km_cents: num('bus_per_km_cents', 15),
    bus_terminal_buffer_hours: num('bus_terminal_buffer_hours', 2),
  }
  const uberFare = (km: number, min: number) => groundLegPricing({ distanceKm: km, durationMinutes: min, mode: 'uber' }, legSettings).dealerAmountCents

  const [pickup, dropoff] = await Promise.all([geocodeAddress(input.pickupAddress), geocodeAddress(input.dropoffAddress)])
  if (!pickup) throw new Error(`Could not locate the pickup address "${input.pickupAddress}".`)
  if (!dropoff) throw new Error(`Could not locate the delivery address "${input.dropoffAddress}".`)
  const [pickupTz, dropoffTz] = await Promise.all([timeZoneAt(pickup.lat, pickup.lng, startMs), timeZoneAt(dropoff.lat, dropoff.lng, startMs)])
  const pTz = pickupTz ?? 'America/Vancouver'
  const dTz = dropoffTz ?? pTz

  // 1. Dealership -> delivery
  const drive = await computeRoute({ address: input.pickupAddress }, { address: input.dropoffAddress }, 'DRIVE', startMs)
  if (!drive) throw new Error('Could not get driving directions between the pickup and delivery addresses.')
  const every = num('meal_allowance_every_hours', 4)
  const driveHours = drive.durationMin / 60
  const nBreaks = Math.min(driveHours < every ? 0 : Math.ceil(driveHours / every), num('meal_allowance_max_count', 5))
  const breakMin = nBreaks * num('break_duration_minutes', 15)
  const driveEnd = startMs + (drive.durationMin + breakMin) * MIN
  const departedInPast = startMs <= Date.now() + 60_000
  steps.push({
    id: 'drive', kind: 'drive', title: 'Drive the vehicle to the delivery location', status: 'live',
    source: departedInPast ? 'Google Maps (departure is in the past, so no traffic forecast)' : 'Google Maps, traffic-aware for the planned departure',
    startUtc: iso(startMs), endUtc: iso(driveEnd), startTz: pTz, endTz: dTz,
    from: input.pickupAddress, to: input.dropoffAddress,
    details: [
      `${drive.distanceKm} km, about ${fmtDuration(drive.durationMin)} of driving`,
      nBreaks > 0 ? `Plus ${nBreaks} rest/meal break${nBreaks === 1 ? '' : 's'} (${breakMin} min total) — included in the end time` : 'No breaks needed',
      'Arrival time is the planned arrival at the delivery address.',
    ],
    costCents: null, warnings: [],
  })
  let cursor = driveEnd

  // Vehicle handover
  const handoverMin = Math.round(num('delivery_handling_buffer_hours', 1) * 60)
  steps.push({
    id: 'handover', kind: 'handover', title: 'Vehicle handover to the customer', status: 'estimate',
    source: 'Handling time from Drivflo pricing settings',
    startUtc: iso(cursor), endUtc: iso(cursor + handoverMin * MIN), startTz: dTz, endTz: dTz,
    details: [`${handoverMin} min for walkaround, customer ID check and signatures`],
    costCents: null, warnings: [],
  })
  cursor += handoverMin * MIN
  let here: { lat: number; lng: number } = dropoff
  let hereAddress = input.dropoffAddress
  let hereTz = dTz

  // 2. Delivery -> registry
  if (input.registryRequired) {
    const registry = await findRegistry(dropoff, input.dropoffAddress)
    const dwellMin = Math.round(num('registry_visit_min_hours', 0.5) * 60)
    if (!registry) {
      steps.push({
        id: 'registry', kind: 'registry', title: 'Registry visit — pick up the registration', status: 'unavailable',
        source: 'Google Places search', startUtc: iso(cursor), endUtc: iso(cursor + dwellMin * MIN), startTz: dTz, endTz: dTz,
        details: [`No registry office was found near the delivery address. ${dwellMin} min is allowed for the visit, but the office, its opening hours and the travel to it must be checked by hand.`],
        costCents: null, warnings: ['Registry office not found — the schedule below assumes the visit happens at the delivery address.'],
      })
      cursor += dwellMin * MIN
      warnings.push('Registry office could not be located; opening hours were NOT checked.')
    } else {
      const regTz = (await timeZoneAt(registry.lat, registry.lng, cursor)) ?? dTz
      const regPoint = { lat: registry.lat, lng: registry.lng }
      const walk = await computeRoute(dropoff, regPoint, 'WALK')
      const car = await computeRoute(dropoff, regPoint, 'DRIVE', cursor)
      const walkKm = walk?.distanceKm ?? car?.distanceKm ?? 0
      const useWalk = walk != null && walkKm <= WALK_MAX_KM
      const travelMin = useWalk ? walk!.durationMin : (car?.durationMin ?? 15) + RIDE_REQUEST_BUFFER_MIN
      const km = car?.distanceKm ?? walkKm
      const fare = useWalk ? 0 : uberFare(km, car?.durationMin ?? 15)
      const arrive = cursor + travelMin * MIN
      steps.push({
        id: 'to-registry', kind: 'to-registry', title: useWalk ? 'Walk to the registry' : 'Ride (Uber) to the registry', status: useWalk ? 'live' : 'estimate',
        source: useWalk ? 'Google Maps walking directions' : 'Google Maps drive time; fare estimated from Drivflo ride settings (not a quote from Uber)',
        startUtc: iso(cursor), endUtc: iso(arrive), startTz: dTz, endTz: regTz, from: hereAddress, to: registry.address,
        details: [`${useWalk ? walkKm : km} km, about ${fmtDuration(travelMin)}${useWalk ? ' on foot' : ' including pickup wait'}`],
        costCents: fare, costBasis: useWalk ? 'free' : 'estimate', warnings: [],
      })
      if (fare > 0) costs.push({ label: 'Ride to the registry', cents: fare, basis: 'estimate' })
      cursor = arrive

      const regWarn: string[] = []
      let regStart = cursor
      if (registry.periods && registry.periods.length > 0) {
        if (!isOpenThrough(registry.periods, cursor, dwellMin, regTz)) {
          const open = nextOpening(registry.periods, cursor, dwellMin, regTz)
          if (open == null) {
            regWarn.push('The registry does not appear to be open in the next 8 days — check manually.')
          } else {
            steps.push({
              id: 'wait-registry', kind: 'wait', title: 'Wait for the registry to open', status: 'estimate',
              source: 'Registry opening hours from Google Places', startUtc: iso(cursor), endUtc: iso(open), startTz: regTz, endTz: regTz,
              details: [`The registry is closed (or would close during the visit) when the driver arrives. Waiting ${fmtDuration(Math.round((open - cursor) / MIN))}.`],
              costCents: null, warnings: ['The driver’s paid time and the flight connection below move with this wait.'],
            })
            regWarn.push(`Registry is closed when the driver arrives — the visit is pushed to the next opening (${fmtDuration(Math.round((open - cursor) / MIN))} wait).`)
            if (open - cursor > 6 * 60 * MIN) regWarn.push('This wait spans a night — an overnight stay (hotel) is likely needed, and it may not be covered by the hotel allowance in the quote.')
            regStart = open
          }
        }
      } else {
        regWarn.push('Opening hours are not listed for this registry — confirm it is open before ordering.')
      }
      const regEnd = regStart + dwellMin * MIN
      steps.push({
        id: 'registry', kind: 'registry', title: `Registry visit — ${registry.name}`, status: registry.periods ? 'live' : 'estimate',
        source: registry.periods ? 'Office and hours from Google Places (not confirmed with the office)' : 'Office from Google Places; hours not available',
        startUtc: iso(regStart), endUtc: iso(regEnd), startTz: regTz, endTz: regTz, to: registry.address,
        details: [
          `${dwellMin} min allowed at the counter`,
          ...(registry.weekdayText ? [`Listed hours: ${registry.weekdayText.join(' · ')}`] : []),
        ],
        costCents: null, warnings: regWarn,
      })
      warnings.push(...regWarn.filter((w) => /closed|not appear|not listed|overnight/.test(w)))
      cursor = regEnd
      here = { lat: registry.lat, lng: registry.lng }
      hereAddress = registry.address
      hereTz = regTz
    }
  } else {
    steps.push({
      id: 'registry', kind: 'registry', title: 'Registry visit', status: 'skipped', source: 'Order option',
      startUtc: null, endUtc: null, startTz: null, endTz: null,
      details: ['Not required for this order (the “Registry visit required” option is off).'], costCents: null, warnings: [],
    })
  }

  // 3-5. Ground leg -> flight -> ride home
  const checkInMin = Math.max(num('flight_airport_buffer_hours', 2), 2) * 60
  const [fromCandidates, toCandidates] = await Promise.all([
    nearbyAirports(input.dropoffAddress, 3, 100),
    nearbyAirports(input.pickupAddress, 2, 100),
  ])
  if ('error' in fromCandidates || 'error' in toCandidates) {
    const msg = 'error' in fromCandidates ? fromCandidates.error : (toCandidates as { error: string }).error
    steps.push(unavailable('ground-to-airport', 'Ground transport to the airport', `Could not find airports: ${msg}`))
    warnings.push(msg)
    return finish(input, steps, costs, warnings, [], startMs, pTz)
  }

  // Ground leg per candidate departure airport
  const legs = new Map<string, GroundLegPlan | null>()
  await Promise.all(
    fromCandidates.map(async (a) => {
      legs.set(a.code, await planGroundLeg(here, hereAddress, a, cursor, hereTz, legSettings))
    })
  )

  type Candidate = {
    from: (typeof fromCandidates)[number]
    to: (typeof toCandidates)[number]
    leg: GroundLegPlan
    flight: FlightPick
    home: { distanceKm: number; durationMin: number; fareCents: number } | null
    homeArriveMs: number | null
    score: number
    fromTz: string | null
  }
  const candidates: Candidate[] = []
  const flightErrors: string[] = []
  const hourly = num('hourly_rate_cents', 0)

  await Promise.all(
    fromCandidates.flatMap((from) =>
      toCandidates.map(async (to) => {
        const leg = legs.get(from.code)
        if (!leg) return
        const fromTz = await timeZoneAt(from.lat, from.lng, leg.arriveMs)
        const toTz = await timeZoneAt(to.lat, to.lng, leg.arriveMs)
        const earliest = leg.arriveMs + checkInMin * MIN
        const res = await searchFlight(from, to, earliest, fromTz, toTz, hourly)
        if (res.error) flightErrors.push(res.error)
        if (!res.pick) return
        const landMs = res.pick.arriveMs
        const homeRoute = await computeRoute({ lat: to.lat, lng: to.lng }, { address: input.pickupAddress }, 'DRIVE', landMs + EXIT_BUFFER_MIN * MIN)
        const home = homeRoute ? { distanceKm: homeRoute.distanceKm, durationMin: homeRoute.durationMin, fareCents: uberFare(homeRoute.distanceKm, homeRoute.durationMin) } : null
        const homeArriveMs = home ? landMs + (EXIT_BUFFER_MIN + home.durationMin) * MIN : null
        const elapsedH = ((homeArriveMs ?? landMs) - cursor) / 3_600_000
        const score = leg.fareCents + res.pick.priceCents + (home?.fareCents ?? 0) + Math.round(elapsedH * hourly)
        candidates.push({ from, to, leg, flight: res.pick, home, homeArriveMs, score, fromTz })
      })
    )
  )

  if (candidates.length === 0) {
    const any = [...legs.values()].find((l) => l) ?? null
    if (any) steps.push(groundStep(any, here, hereAddress, fromCandidates[0], hereTz, null))
    steps.push(unavailable('flight', 'Flight', flightErrors[0] ?? 'No catchable Canadian flight was found in the next 3 days for the airports near the delivery address. Check the quote’s alternative (for example driving back), or search other dates.'))
    warnings.push('No workable flight connection was found, so the rest of the trip home cannot be scheduled.')
    return finish(input, steps, costs, warnings, [], startMs, pTz)
  }

  candidates.sort((a, b) => a.score - b.score)
  const best = candidates[0]
  const alternatives = candidates.slice(1, 4).map((c) => ({
    label: `${c.from.name} (${c.from.code}) → ${c.to.name} (${c.to.code})`,
    totalCents: c.leg.fareCents + c.flight.priceCents + (c.home?.fareCents ?? 0),
    departs: iso(c.flight.departMs),
  }))

  // Ground leg step
  const legStep = groundStep(best.leg, here, hereAddress, best.from, hereTz, best.fromTz)
  steps.push(legStep)
  costs.push({ label: best.leg.mode === 'bus' ? `Bus to ${best.from.name} airport (${best.from.code})` : `Ride to ${best.from.name} airport (${best.from.code})`, cents: best.leg.fareCents, basis: best.leg.fareBasis })

  // Airport buffer / wait
  const arrivedAt = best.leg.arriveMs
  const flightDep = best.flight.departMs
  const waitMin = Math.round((flightDep - arrivedAt) / MIN)
  const fromAirTz = best.fromTz ?? best.flight.fromTz
  const airportWarnings: string[] = []
  if (waitMin < checkInMin) airportWarnings.push('This connection is too tight for check-in and security.')
  if (waitMin > 6 * 60) airportWarnings.push(`Long wait of ${fmtDuration(waitMin)} before the flight — the driver is on the clock; consider whether a hotel or an earlier option is better.`)
  if (best.flight.outsidePractical) airportWarnings.push('Every catchable flight on the day departs outside 6am–10pm; this is the nearest one.')
  steps.push({
    id: 'airport', kind: 'airport', title: `At ${best.from.name} airport — check-in, security and boarding`, status: 'estimate',
    source: `Required buffer is ${fmtDuration(checkInMin)} (the larger of the Drivflo airport buffer setting and 2 hours)`,
    startUtc: iso(arrivedAt), endUtc: iso(flightDep), startTz: fromAirTz, endTz: fromAirTz,
    details: [
      `Arrives ${fmtDuration(waitMin)} before departure; ${fmtDuration(checkInMin)} is needed${waitMin >= checkInMin ? `, leaving ${fmtDuration(waitMin - checkInMin)} spare` : ''}`,
    ],
    costCents: null, warnings: airportWarnings,
  })
  warnings.push(...airportWarnings.filter((w) => /too tight|Long wait/.test(w)))

  // Flight
  const f = best.flight
  const lastSeg = f.segments[f.segments.length - 1]
  steps.push({
    id: 'flight', kind: 'flight', title: `Flight ${f.segments.map((x) => x.flightNumber).join(' + ')} — ${f.segments[0].airline}`, status: 'live',
    source: 'Duffel airline search: live schedule and fare, NOT booked or held',
    startUtc: iso(f.departMs), endUtc: iso(f.arriveMs), startTz: f.fromTz, endTz: f.toTz,
    from: `${best.from.name} (${f.segments[0].from})`, to: `${best.to.name} (${lastSeg.to})`,
    details: [
      f.stops === 0 ? 'Direct flight' : `${f.stops} stop${f.stops === 1 ? '' : 's'}: ${f.segments.map((x) => `${x.from}→${x.to}`).join(', ')}`,
      ...f.segments.map((x) => `${x.airline} ${x.flightNumber}${x.operatedBy ? ` (operated by ${x.operatedBy})` : ''}: ${x.from} → ${x.to}`),
      'Economy fare at the time of search; the price can change before booking.',
    ],
    costCents: f.priceCents, costBasis: 'live fare', warnings: f.stops > 0 ? ['Connecting flight — check the layover.'] : [],
  })
  costs.push({ label: `Flight ${best.from.code} → ${best.to.code}`, cents: f.priceCents, basis: 'live fare' })

  // Ride home
  if (best.home && best.homeArriveMs) {
    const pickupMs = f.arriveMs + EXIT_BUFFER_MIN * MIN
    steps.push({
      id: 'ride-home', kind: 'ride-home', title: 'Ride (Uber) home from the airport', status: 'estimate',
      source: 'Google Maps drive time; fare estimated from Drivflo ride settings (not a quote from Uber)',
      startUtc: iso(pickupMs), endUtc: iso(best.homeArriveMs), startTz: f.toTz, endTz: pTz,
      from: `${best.to.name} airport (${best.to.code})`, to: input.pickupAddress,
      details: [
        `Allows ${EXIT_BUFFER_MIN} min after landing to leave the plane and meet the ride`,
        `${best.home.distanceKm} km, about ${fmtDuration(best.home.durationMin)}`,
      ],
      costCents: best.home.fareCents, costBasis: 'estimate', warnings: [],
    })
    costs.push({ label: `Ride home from ${best.to.code}`, cents: best.home.fareCents, basis: 'estimate' })
  } else {
    steps.push(unavailable('ride-home', 'Ride home from the airport', 'Could not get driving directions from the arrival airport to the pickup address.'))
    warnings.push('The ride home from the arrival airport could not be scheduled.')
  }

  return finish(input, steps, costs, warnings, alternatives, startMs, pTz)
}

// ---------- helpers ----------

function unavailable(id: string, title: string, why: string): ItineraryStep {
  return { id, kind: id === 'flight' ? 'flight' : id === 'ride-home' ? 'ride-home' : 'ground-to-airport', title, status: 'unavailable', source: 'No data', startUtc: null, endUtc: null, startTz: null, endTz: null, details: [why], costCents: null, warnings: [why] }
}

export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  return h > 0 ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`
}

async function planGroundLeg(
  here: { lat: number; lng: number },
  hereAddress: string,
  airport: { code: string; name: string; lat: number; lng: number },
  readyMs: number,
  tz: string,
  legSettings: { uber_base_fare_cents: number; uber_per_km_cents: number; uber_minimum_fare_cents: number; bus_base_fare_cents: number; bus_per_km_cents: number; bus_terminal_buffer_hours: number }
): Promise<GroundLegPlan | null> {
  const drive = await computeRoute(here, { lat: airport.lat, lng: airport.lng }, 'DRIVE', readyMs + RIDE_REQUEST_BUFFER_MIN * MIN)
  if (!drive) return null
  const warnings: string[] = []

  if (drive.distanceKm <= INTERCITY_KM) {
    const departMs = readyMs + RIDE_REQUEST_BUFFER_MIN * MIN
    const fare = groundLegPricing({ distanceKm: drive.distanceKm, durationMinutes: drive.durationMin, mode: 'uber' }, legSettings).dealerAmountCents
    return {
      mode: 'uber', status: 'estimate', source: 'Google Maps drive time; fare estimated from Drivflo ride settings (not a quote from Uber)',
      departMs, arriveMs: departMs + drive.durationMin * MIN, fareCents: fare, fareBasis: 'estimate',
      details: [`${drive.distanceKm} km, about ${fmtDuration(drive.durationMin)} by ride-share`, `Allows ${RIDE_REQUEST_BUFFER_MIN} min to request and meet the ride`],
      warnings, distanceKm: drive.distanceKm,
    }
  }

  // Intercity: look for a real scheduled bus first.
  const transit = await computeRoute(here, { lat: airport.lat, lng: airport.lng }, 'TRANSIT', readyMs)
  const tSteps = transit?.steps.filter((x) => x.kind === 'transit') ?? []
  if (transit && tSteps.length > 0 && tSteps.every((x) => x.departMs && x.arriveMs)) {
    const firstDep = tSteps[0].departMs!
    const lastArr = tSteps[tSteps.length - 1].arriveMs!
    const trailingWalk = transit.steps.slice(transit.steps.lastIndexOf(tSteps[tSteps.length - 1]) + 1).reduce((a, x) => a + x.durationMin, 0)
    const leadingWalkMin = transit.steps.slice(0, transit.steps.indexOf(tSteps[0])).reduce((a, x) => a + x.durationMin, 0)
    const earliestAtStop = readyMs + leadingWalkMin * MIN
    const details: string[] = []
    if (leadingWalkMin > 0) details.push(`Walk ${fmtDuration(leadingWalkMin)} from the previous stop to the boarding stop`)
    tSteps.forEach((x, i) => {
      details.push(`${i === 0 ? 'Board' : 'Transfer to'}: ${x.operator ?? 'Operator not listed'}${x.line ? `, route/line ${x.line}` : ''}${x.headsign ? ` toward ${x.headsign}` : ''} (${x.vehicle ?? 'bus'})`)
      details.push(`  Boarding location: ${x.departStop ?? 'not listed'} — departs ${fmtLocal(x.departMs!, tz)}`)
      details.push(`  Gets off at: ${x.arriveStop ?? 'not listed'} — arrives ${fmtLocal(x.arriveMs!, tz)}`)
    })
    details.push(tSteps.length > 1 ? `${tSteps.length - 1} transfer${tSteps.length === 2 ? '' : 's'}` : 'No transfers')
    if (trailingWalk > 0) details.push(`Walk ${fmtDuration(trailingWalk)} from the last stop to the terminal`)
    if (firstDep < earliestAtStop) warnings.push('The first bus leaves before the driver can reach the stop — this connection does not work.')
    const fareLive = transit.fareCents != null
    const fare = fareLive ? transit.fareCents! : groundLegPricing({ distanceKm: drive.distanceKm, durationMinutes: drive.durationMin, mode: 'bus' }, legSettings).dealerAmountCents
    if (!fareLive) details.push('Ticket price was not listed by the schedule data; the fare shown is an estimate from Drivflo bus settings.')
    return {
      mode: 'bus', status: 'live', source: 'Google Maps transit schedule (not confirmed with the operator)',
      departMs: firstDep, arriveMs: lastArr + trailingWalk * MIN, fareCents: fare, fareBasis: fareLive ? 'live fare' : 'estimate',
      details, warnings, distanceKm: drive.distanceKm,
    }
  }

  // No schedule data: estimate, clearly flagged.
  const bus = groundLegPricing({ distanceKm: drive.distanceKm, durationMinutes: drive.durationMin, mode: 'bus' }, legSettings)
  const waitMin = Math.round(legSettings.bus_terminal_buffer_hours * 60)
  const departMs = readyMs + waitMin * MIN
  const rideMin = Math.round((drive.distanceKm / AVG_BUS_SPEED_KMH) * 60)
  warnings.push('No scheduled bus was found for this trip. The operator, route, departure time and ticket price are NOT verified — book only after checking a real timetable.')
  return {
    mode: 'bus', status: 'estimate', source: 'Estimate from Drivflo bus settings — no live timetable found',
    departMs, arriveMs: departMs + rideMin * MIN, fareCents: bus.dealerAmountCents, fareBasis: 'estimate',
    details: [
      `About ${drive.distanceKm} km by intercity bus; assumes a departure ${fmtDuration(waitMin)} after the previous step and an average speed of ${AVG_BUS_SPEED_KMH} km/h`,
      'Operator, route/line number, boarding location, transfers: unavailable',
    ],
    warnings, distanceKm: drive.distanceKm,
  }
}

function groundStep(leg: GroundLegPlan, here: { lat: number; lng: number }, hereAddress: string, airport: { code: string; name: string }, startTz: string, airportTz: string | null): ItineraryStep {
  return {
    id: 'ground-to-airport', kind: 'ground-to-airport',
    title: leg.mode === 'bus' ? `Bus to ${airport.name} airport (${airport.code})` : `Ride to ${airport.name} airport (${airport.code})`,
    status: leg.status, source: leg.source,
    startUtc: iso(leg.departMs), endUtc: iso(leg.arriveMs), startTz, endTz: airportTz ?? startTz,
    from: hereAddress, to: `${airport.name} airport (${airport.code})`,
    details: leg.details, costCents: leg.fareCents, costBasis: leg.fareBasis, warnings: leg.warnings,
  }
}

function finish(
  input: ItineraryInput, steps: ItineraryStep[], costs: CostLine[], warnings: string[],
  alternatives: Itinerary['alternatives'], startMs: number, startTz: string
): Itinerary {
  const timed = steps.filter((x) => x.endUtc)
  const last = timed[timed.length - 1]
  const complete = steps.every((x) => x.status !== 'unavailable')
  const endMs = last?.endUtc ? new Date(last.endUtc).getTime() : null
  const totalMinutes = complete && endMs != null ? Math.round((endMs - startMs) / MIN) : null
  if (totalMinutes != null && totalMinutes > 16 * 60) {
    warnings.push(`The driver would be on duty for ${fmtDuration(totalMinutes)} with no overnight rest scheduled. Consider splitting the trip or adding a hotel night.`)
  }
  warnings.unshift('Nothing here is confirmed. Flights are live searches that are not booked or held, bus and ride fares may be estimates, and schedules can change — verify each step before ordering.')
  return {
    confirmed: false,
    generatedAt: new Date().toISOString(),
    startUtc: input.startUtc,
    endUtc: complete && last?.endUtc ? last.endUtc : null,
    startTz,
    endTz: last?.endTz ?? null,
    totalMinutes,
    steps,
    costs,
    transportCents: costs.reduce((a, c) => a + c.cents, 0),
    warnings,
    alternatives,
  }
}
