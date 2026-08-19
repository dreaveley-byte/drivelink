'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculatePricing, formatCents, type PricingSettings, type AdditionalCharge, type PricingResult } from '@/lib/pricing'
import Logo from '@/components/Logo'
import ReturnOptionsComparison from '@/components/ReturnOptionsComparison'
import NearbyDatesFlightCheck from '@/components/NearbyDatesFlightCheck'
import FirstNationsReservePopup from '@/components/FirstNationsReservePopup'
import { localInputToUtcIso, toLocalDatetimeInputValue, toLocalDateString, zonedLocalInputToUtcIso, utcIsoToZonedInputValue, zonedAbbreviation } from '@/lib/localDatetime'

type JobType = { id: string; name: string }
type Organization = { id: string; name: string }

export default function PostJobPage() {
  const router = useRouter()
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [jobTypeId, setJobTypeId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [newDealerName, setNewDealerName] = useState('')

  const [stops, setStops] = useState<string[]>(['', ''])

  const [vehicleYear, setVehicleYear] = useState('')
  const [packageDescription, setPackageDescription] = useState('')
  const [packageDirection, setPackageDirection] = useState<'pickup' | 'dropoff'>('dropoff')
  const [pickupDropoffReason, setPickupDropoffReason] = useState<'sales' | 'service' | 'other'>('sales')
  const [pickupDropoffReasonOther, setPickupDropoffReasonOther] = useState('')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [stockNumber, setStockNumber] = useState('')
  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [keyCount, setKeyCount] = useState('')
  const [hasWheelLock, setHasWheelLock] = useState(false)
  const [hasChargingCables, setHasChargingCables] = useState(false)
  const [otherIncludedItems, setOtherIncludedItems] = useState('')
  const [customerFullName, setCustomerFullName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')

  const [scheduledFor, setScheduledFor] = useState('')
  const [deliveryDeadline, setDeliveryDeadline] = useState('')
  const [originTimeZone, setOriginTimeZone] = useState<string | null>(null)
  const [destinationTimeZone, setDestinationTimeZone] = useState<string | null>(null)
  const [computingPickupTime, setComputingPickupTime] = useState(false)
  const [pickupTimeError, setPickupTimeError] = useState('')
  const [ferryLiveDataUsed, setFerryLiveDataUsed] = useState(false)
  const [decisionNote, setDecisionNote] = useState('')
  const [ferryDebugNote, setFerryDebugNote] = useState('')
  const [secondDriver, setSecondDriver] = useState(false)
  const [chaseVehicle, setChaseVehicle] = useState(false)
  const [isTradeIn, setIsTradeIn] = useState(false)
  const [tradeInYear, setTradeInYear] = useState('')
  const [tradeInMake, setTradeInMake] = useState('')
  const [tradeInModel, setTradeInModel] = useState('')
  const [tradeInVin, setTradeInVin] = useState('')
  const [secondVehicleYear, setSecondVehicleYear] = useState('')
  const [secondVehicleMake, setSecondVehicleMake] = useState('')
  const [secondVehicleModel, setSecondVehicleModel] = useState('')
  const [secondVehicleStockNumber, setSecondVehicleStockNumber] = useState('')
  const [secondVehicleVin, setSecondVehicleVin] = useState('')
  const [secondTradeInYear, setSecondTradeInYear] = useState('')
  const [secondTradeInMake, setSecondTradeInMake] = useState('')
  const [secondTradeInModel, setSecondTradeInModel] = useState('')
  const [secondTradeInVin, setSecondTradeInVin] = useState('')

  // Dealer-to-dealer: any number of vehicles to drop off and/or pick up (0-7
  // each), unlike the fixed-at-2 multi-vehicle scenarios above. Every vehicle
  // beyond the first needs its own driver.
  type DealerVehicle = { year: string; make: string; model: string; stockNumber: string; vin: string }
  const blankDealerVehicle = (): DealerVehicle => ({ year: '', make: '', model: '', stockNumber: '', vin: '' })
  const [dealerDropoffCount, setDealerDropoffCount] = useState(0)
  const [dealerPickupCount, setDealerPickupCount] = useState(0)
  const [dealerDropoffVehicles, setDealerDropoffVehicles] = useState<DealerVehicle[]>([])
  const [dealerPickupVehicles, setDealerPickupVehicles] = useState<DealerVehicle[]>([])

  function resizeDealerVehicles(count: number, list: DealerVehicle[], setList: (v: DealerVehicle[]) => void) {
    const next = [...list]
    while (next.length < count) next.push(blankDealerVehicle())
    next.length = count
    setList(next)
  }

  function updateDealerVehicle(list: DealerVehicle[], setList: (v: DealerVehicle[]) => void, index: number, field: keyof DealerVehicle, value: string) {
    const next = [...list]
    next[index] = { ...next[index], [field]: value }
    setList(next)
  }
  const [isFirstNationsDelivery, setIsFirstNationsDelivery] = useState(false)
  const [showReservePopup, setShowReservePopup] = useState(false)
  const [myOrgId, setMyOrgId] = useState<string | null>(null)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [flyingBack, setFlyingBack] = useState(false)
  const [vehicleMode, setVehicleMode] = useState<'driven' | 'towed'>('driven')
  // Drivers always use their own vehicle — no toggle needed, wear & tear always applies.
  const [outOfProvinceInspection, setOutOfProvinceInspection] = useState(false)
  const [registryVisit, setRegistryVisit] = useState(false)
  const [insuranceVisit, setInsuranceVisit] = useState(false)
  const [ferryRequired, setFerryRequired] = useState(false)
  const [useGarageInsurance, setUseGarageInsurance] = useState(false)
  const [includeTowDeductibleCoverage, setIncludeTowDeductibleCoverage] = useState(false)
  const [flightPriceOverride, setFlightPriceOverride] = useState('')
  const [flightOptions, setFlightOptions] = useState<Array<{
    origin: { code: string; name: string }
    destination: { code: string; name: string }
    flight: { priceCents: number; isDirect: boolean; stops: number; hoursToAdd: number }
    groundToAirport: { distanceKm: number; durationMinutes: number } | null
    groundFromAirport: { distanceKm: number; durationMinutes: number } | null
    effectiveCostCents: number
  }>>([])
  const [selectedFlightOptionIdx, setSelectedFlightOptionIdx] = useState(0)
  const [flightHoursOverride, setFlightHoursOverride] = useState('')
  // True whenever the driver does NOT drive the vehicle back themselves — covers
  // both flying back AND the short-trip Uber/walk-on-return case. Gas and driver
  // hours should only be charged one-way in either case; flyingBack alone used to
  // gate this, which silently billed a full round trip's worth of gas/hours even
  // when the driver only drove one-way and took an Uber back.
  const [effectiveOneWayReturn, setEffectiveOneWayReturn] = useState(false)
  // On by default - always compares Uber-back vs 2nd driver + chase (plus flight/bus
  // on long hauls) and picks the cheapest, regardless of trip length. Turning it off
  // lets a manual checkbox choice (e.g. a staff member riding along) stick across recalculations.
  const [autoSelectReturnMethod, setAutoSelectReturnMethod] = useState(true)
  // Only matters when auto-select is off and nothing else (flying/chase/2nd driver)
  // is checked. Defaults to false — with everything unchecked, that means the
  // booking dealer is picking the driver up themselves, so no return-transport
  // charge should be added at all. Check this to explicitly request an Uber back.
  const [uberBackRequested, setUberBackRequested] = useState(false)
  const [multiVehicleArrangement, setMultiVehicleArrangement] = useState<'none' | 'two_trades_one_purchase' | 'two_purchases_one_trade' | 'two_vehicles_two_trades'>('none')
  const [linkedJobId, setLinkedJobId] = useState<string | null>(null)
  const [linkedJobQuery, setLinkedJobQuery] = useState('')
  const [linkedJobResults, setLinkedJobResults] = useState<{ id: string; stock_number: string | null; vehicle_year: number | null; vehicle_make: string | null; vehicle_model: string | null }[]>([])
  const [linkedJobSearching, setLinkedJobSearching] = useState(false)
  const [ridesAlongWithLinked, setRidesAlongWithLinked] = useState(false)
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([])
  const [notes, setNotes] = useState('')

  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null)
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [pricing, setPricing] = useState<PricingResult | null>(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('job_types')
      .select('id, name')
      .eq('active', true)
      .then(({ data }) => {
        setJobTypes(data ?? [])
        if (data?.[0]) setJobTypeId(data[0].id)
      })

    supabase.from('pricing_settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setPricingSettings(data)
    })

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'platform_admin') {
        setIsAdmin(true)
        const { data: orgs } = await supabase.from('organizations').select('id, name').order('name')
        setOrganizations(orgs ?? [])
        if (orgs?.[0]) setSelectedOrgId(orgs[0].id)
      } else if (profile?.organization_id) {
        setMyOrgId(profile.organization_id)
      }
    })
  }, [])

  // Whichever org this job is actually being posted for (admin picks one,
  // dealer uses their own) - fetch any active discount so it applies to the
  // live price shown before posting, not just after.
  useEffect(() => {
    const effectiveOrgId = isAdmin ? selectedOrgId : myOrgId
    if (!effectiveOrgId || effectiveOrgId === '__new__') {
      setDiscountPercent(0)
      return
    }
    const supabase = createClient()
    supabase.rpc('get_active_discount_percent', { p_org_id: effectiveOrgId }).then(({ data }) => {
      setDiscountPercent(data ?? 0)
    })
  }, [isAdmin, selectedOrgId, myOrgId])

  function updateStop(index: number, value: string) {
    setStops((prev) => prev.map((s, i) => (i === index ? value : s)))
  }

  function addStop() {
    setStops((prev) => [...prev.slice(0, -1), '', prev[prev.length - 1]])
  }

  function removeStop(index: number) {
    setStops((prev) => prev.filter((_, i) => i !== index))
  }

  function addCharge() {
    setAdditionalCharges((prev) => [...prev, { description: '', dealerAmountCents: 0, hoursAdded: 0, paidToDriver: false }])
  }

  function updateCharge(index: number, patch: Partial<AdditionalCharge>) {
    setAdditionalCharges((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function removeCharge(index: number) {
    setAdditionalCharges((prev) => prev.filter((_, i) => i !== index))
  }

  async function searchLinkedJob(query: string) {
    setLinkedJobQuery(query)
    if (query.trim().length < 2) {
      setLinkedJobResults([])
      return
    }
    setLinkedJobSearching(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('jobs')
      .select('id, stock_number, vehicle_year, vehicle_make, vehicle_model')
      .or(`stock_number.ilike.%${query}%,vehicle_make.ilike.%${query}%,vehicle_model.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(8)
    setLinkedJobResults(data ?? [])
    setLinkedJobSearching(false)
  }

  async function handleDeliveryDeadlineChange(value: string) {
    setDeliveryDeadline(value)
    setPickupTimeError('')

    if (!value) return
    const filledStops = stops.map((s) => s.trim()).filter(Boolean)
    if (filledStops.length < 2) {
      setPickupTimeError('Enter a pickup and dropoff address first.')
      return
    }
    if (!pricingSettings) {
      setPickupTimeError('Pricing settings not loaded yet.')
      return
    }

    setComputingPickupTime(true)
    try {
      // Departure time for the traffic-aware route needs a real UTC instant —
      // use the browser's naive interpretation just to get traffic in the right
      // ballpark; the actual deadline is recalculated correctly below once we
      // know the destination's real timezone.
      const res = await fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses: [filledStops[0], filledStops[filledStops.length - 1]],
          departureTime: localInputToUtcIso(value),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPickupTimeError(data.error || 'Could not calculate drive time.')
        setComputingPickupTime(false)
        return
      }

      setOriginTimeZone(data.originTimeZone ?? null)
      setDestinationTimeZone(data.destinationTimeZone ?? null)

      const driveHours = data.durationMinutes / 60
      const mealBreaks = Math.min(
        Math.floor(driveHours / pricingSettings.meal_allowance_every_hours),
        pricingSettings.meal_allowance_max_count
      )
      const breakHours = (mealBreaks * pricingSettings.break_duration_minutes) / 60
      const totalHoursNeeded = driveHours + breakHours

      // The delivery time the dealer typed means wall-clock time AT THE
      // DESTINATION — a 5pm Edmonton delivery is 5pm Edmonton time, not 5pm
      // wherever the dealer's browser happens to be. Fall back to naive
      // browser-local interpretation only if we couldn't resolve a timezone.
      const deadlineUtcIso = data.destinationTimeZone
        ? zonedLocalInputToUtcIso(value, data.destinationTimeZone)
        : localInputToUtcIso(value)
      if (!deadlineUtcIso) {
        setPickupTimeError('Could not interpret that delivery time.')
        setComputingPickupTime(false)
        return
      }

      const pickupInstant = new Date(deadlineUtcIso)
      pickupInstant.setTime(pickupInstant.getTime() - totalHoursNeeded * 60 * 60 * 1000)

      if (pickupInstant.getTime() < Date.now()) {
        const shortfallHours = Math.round(((Date.now() - pickupInstant.getTime()) / (60 * 60 * 1000)) * 10) / 10
        const displayTz = data.originTimeZone ?? undefined
        const pickupDisplay = displayTz
          ? pickupInstant.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: displayTz })
          : pickupInstant.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
        setPickupTimeError(
          `⚠️ This delivery time isn't achievable — the driver would have needed to leave ${shortfallHours} hrs ago (by ${pickupDisplay}${displayTz ? ` ${zonedAbbreviation(pickupInstant.toISOString(), displayTz)}` : ''}). Pick a later delivery time or an earlier pickup.`
        )
      }

      // Store the pickup as a datetime-local value in the ORIGIN's own timezone
      // (that's the true local pickup time), not the browser's.
      setScheduledFor(
        data.originTimeZone
          ? utcIsoToZonedInputValue(pickupInstant.toISOString(), data.originTimeZone)
          : toLocalDatetimeInputValue(pickupInstant)
      )
    } catch {
      setPickupTimeError('Something went wrong calculating the pickup time.')
    }
    setComputingPickupTime(false)
  }

  const runCalculation = useCallback(async () => {
    setCalcError('')
    setDecisionNote('')
    const isCourierJob = ['Courier / Package', 'Parts Delivery', 'Parts Pickup'].includes(jobTypes.find((jt) => jt.id === jobTypeId)?.name ?? '')
    const isPaperworkSigningJob = jobTypes.find((jt) => jt.id === jobTypeId)?.name === 'Paperwork Signing'
    const jobTypeNameForCalc = jobTypes.find((jt) => jt.id === jobTypeId)?.name
    const isCustomerRideJob = jobTypeNameForCalc === 'Customer Pick Up' || jobTypeNameForCalc === 'Customer Drop Off'
    const filledStops = stops.map((s) => s.trim()).filter(Boolean)
    if (filledStops.length < 2) {
      setCalcError('Enter at least a pickup and dropoff address.')
      return
    }
    if (!pricingSettings) {
      setCalcError('Pricing settings not loaded yet.')
      return
    }

    setCalculating(true)
    try {
      const res = await fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses: filledStops,
          departureTime: originTimeZone ? zonedLocalInputToUtcIso(scheduledFor, originTimeZone) : localInputToUtcIso(scheduledFor),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCalcError(data.error || 'Could not calculate distance.')
        setCalculating(false)
        return
      }

      if (data.originTimeZone) setOriginTimeZone(data.originTimeZone)
      if (data.destinationTimeZone) setDestinationTimeZone(data.destinationTimeZone)

      setDistanceKm(data.distanceKm)
      setDurationMinutes(data.durationMinutes)

      const oneWayHours = data.durationMinutes / 60
      const inspectionHours = outOfProvinceInspection ? pricingSettings.out_of_province_inspection_min_hours : 0
      const registryHours = registryVisit ? pricingSettings.registry_visit_min_hours : 0

      // --- Ferry: look this up once regardless of round-trip/one-way, since the
      // terminal match itself doesn't depend on that — only the crossing count does.
      let ferryInfo: { fromTerminal: { name: string }; toTerminal: { name: string }; sailingDurationMinutes: number; avgGapMinutes: number; sailingsPerDay: number; groundHome: { distanceKm: number; durationMinutes: number } | null } | null = null
      // A real BC Ferries route never applies to a short local drive — the terminal
      // matching can otherwise false-positive on nearby-but-different terminals for
      // trips like a quick dealer-to-dealer trade. Skip the check entirely below
      // this distance unless the dealer explicitly knows better and forced it on.
      const MIN_ONE_WAY_KM_FOR_FERRY_CHECK = 25
      if (data.distanceKm >= MIN_ONE_WAY_KM_FOR_FERRY_CHECK || ferryRequired) {
        try {
          const ferryRes = await fetch('/api/ferry/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originAddress: filledStops[0], destinationAddress: filledStops[filledStops.length - 1] }),
          })
          const ferryBody = await ferryRes.json().catch(() => ({}))
          if (ferryRes.ok && ferryBody.sailingDurationMinutes != null) {
            ferryInfo = ferryBody
            setFerryDebugNote(`Ferry detected: ${ferryBody.fromTerminal.name} → ${ferryBody.toTerminal.name} (vehicle fare $${(pricingSettings.ferry_fare_cents / 100).toFixed(2)}, walk-on fare $${(pricingSettings.ferry_walkon_fare_cents / 100).toFixed(2)})`)
          } else {
            setFerryDebugNote(`Ferry check: ${ferryBody.error || 'no route detected'}`)
            if (ferryRequired) {
              setCalcError(ferryBody.error ? `Ferry lookup: ${ferryBody.error} — using default fare/wait time instead.` : 'Could not look up live ferry schedule — using default fare/wait time instead.')
            }
          }
        } catch (e) {
          setFerryDebugNote(`Ferry check failed: ${e instanceof Error ? e.message : 'unknown error'}`)
          if (ferryRequired) setCalcError('Could not reach the ferry schedule service — using default fare/wait time instead.')
        }
      } else {
        setFerryDebugNote(`Ferry check skipped — ${data.distanceKm}km one-way is too short for a real ferry route.`)
      }
      setFerryLiveDataUsed(!!ferryInfo)

      // 'roundtrip-vehicle': trade-in/chase — the vehicle genuinely crosses both ways.
      // 'oneway-vehicle': flying back — vehicle crosses once, driver flies instead of a return sailing.
      // 'oneway-walkon-return': normal delivery, no trade-in — vehicle crosses once, driver
      //   returns as a foot passenger (much cheaper) rather than paying for a second vehicle fare.
      function ferryCharge(mode: 'roundtrip-vehicle' | 'oneway-vehicle' | 'oneway-walkon-return'): AdditionalCharge | null {
        const crossings = mode === 'oneway-vehicle' ? 1 : 2
        const feeCents =
          mode === 'roundtrip-vehicle'
            ? pricingSettings!.ferry_fare_cents * 2
            : mode === 'oneway-vehicle'
              ? pricingSettings!.ferry_fare_cents
              : pricingSettings!.ferry_fare_cents + pricingSettings!.ferry_walkon_fare_cents
        const label =
          mode === 'roundtrip-vehicle'
            ? ` (round trip, 2× $${(pricingSettings!.ferry_fare_cents / 100).toFixed(2)} vehicle fare)`
            : mode === 'oneway-walkon-return'
              ? ` (one-way: $${(pricingSettings!.ferry_fare_cents / 100).toFixed(2)} vehicle + $${(pricingSettings!.ferry_walkon_fare_cents / 100).toFixed(2)} walk-on return)`
              : ''

        if (ferryInfo) {
          const totalMinutes = (ferryInfo.sailingDurationMinutes + pricingSettings!.ferry_wait_hours * 60) * crossings
          return {
            description: `Ferry: ${ferryInfo.fromTerminal.name} → ${ferryInfo.toTerminal.name}${label} (~${ferryInfo.sailingsPerDay} sailings/day, every ~${ferryInfo.avgGapMinutes}min)`,
            kind: 'ferry' as const,
            dealerAmountCents: feeCents,
            hoursAdded: Math.round((totalMinutes / 60) * 100) / 100,
            paidToDriver: true,
          }
        }
        if (ferryRequired) {
          return {
            description: `Ferry crossing${label}`,
            kind: 'ferry' as const,
            dealerAmountCents: feeCents,
            hoursAdded: pricingSettings!.ferry_wait_hours * crossings,
            paidToDriver: true,
          }
        }
        return null
      }

      // Foot-passenger ferry returns still need a ride from the arrival terminal
      // back to the dealer/home. Uses the real driven distance when available —
      // from the ferry terminal if a ferry's involved, otherwise the same one-way
      // route we already calculated for this delivery (this function is only ever
      // called for the local Uber-back case, never the fly-back case, which has
      // its own separate flat estimate since we don't know the airport's location).
      function ferryReturnGroundTransport(): AdditionalCharge {
        const km = ferryInfo?.groundHome?.distanceKm ?? data.distanceKm
        const minutes = ferryInfo?.groundHome?.durationMinutes ?? data.durationMinutes
        if (km != null && minutes != null) {
          return {
            description: ferryInfo?.groundHome ? `Return ground transport (${km}km from terminal)` : `Return ground transport (${km}km)`,
            kind: 'ground-home' as const,
            dealerAmountCents: Math.max(Math.round(pricingSettings!.uber_base_fare_cents + km * pricingSettings!.uber_per_km_cents), pricingSettings!.uber_minimum_fare_cents),
            hoursAdded: Math.round((minutes / 60) * 100) / 100,
            paidToDriver: true,
          }
        }
        return {
          description: 'Return ground transport',
          kind: 'ground-home' as const,
          dealerAmountCents: pricingSettings!.return_ground_transport_fee_cents,
          hoursAdded: pricingSettings!.return_ground_transport_hours,
          paidToDriver: true,
        }
      }

      // Builds the charges for "drive one-way and fly back" — ground transport
      // both ends plus a real flight search. Returns null if no flight could be found.
      async function buildFlyCharges(): Promise<AdditionalCharge[] | null> {
        const hasOverride = flightPriceOverride.trim() !== '' && flightHoursOverride.trim() !== ''

        const overnightNeeded = oneWayHours + inspectionHours + registryHours > pricingSettings!.max_driving_hours_before_overnight
        let flightDepartureDate: string | undefined
        if (scheduledFor) {
          const d = new Date(scheduledFor)
          if (overnightNeeded) d.setDate(d.getDate() + 1)
          flightDepartureDate = toLocalDateString(d)
        }
        const flightRes = await fetch('/api/flights/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originAddress: filledStops[0],
            destinationAddress: filledStops[filledStops.length - 1],
            departureDate: flightDepartureDate,
          }),
        })
        const flightBody = await flightRes.json().catch(() => ({}))

        // Ground transport legs stay auto-calculated either way — the override
        // is specifically for when Duffel's flight price/time itself is wrong
        // (e.g. it's missing a cheaper direct fare from a carrier it doesn't carry).
        if (!hasOverride && (!flightRes.ok || !flightBody.flight)) {
          setFlightOptions([])
          return null
        }

        setFlightOptions(flightBody.options ?? [])
        // The selected option may be stale (fewer options than before, or a
        // fresh search) - clamp back to the cheapest (index 0) rather than
        // pointing at something that no longer exists.
        const chosen = flightBody.options?.[selectedFlightOptionIdx] ?? flightBody.options?.[0] ?? flightBody

        const result: AdditionalCharge[] = []
        if (chosen.groundFromAirport) {
          const km = chosen.groundFromAirport.distanceKm
          result.push({
            description: `Return ground transport (${km}km)`,
            kind: 'ground-home' as const,
            dealerAmountCents: Math.max(Math.round(pricingSettings!.uber_base_fare_cents + km * pricingSettings!.uber_per_km_cents), pricingSettings!.uber_minimum_fare_cents),
            hoursAdded: Math.round((chosen.groundFromAirport.durationMinutes / 60) * 100) / 100,
            paidToDriver: true,
          })
        } else {
          // The real distance calculation failed (API error, no route found,
          // etc.) - fall back to the flat estimate rather than dropping this
          // charge entirely.
          result.push({
            description: 'Return ground transport (flat estimate)',
            kind: 'ground-home' as const,
            dealerAmountCents: pricingSettings!.return_ground_transport_fee_cents,
            hoursAdded: pricingSettings!.return_ground_transport_hours,
            paidToDriver: true,
          })
        }
        if (chosen.groundToAirport) {
          const km = chosen.groundToAirport.distanceKm
          result.push({
            description: 'Ground transport to airport',
            kind: 'ground-to-airport' as const,
            dealerAmountCents: Math.max(Math.round(pricingSettings!.uber_base_fare_cents + km * pricingSettings!.uber_per_km_cents), pricingSettings!.uber_minimum_fare_cents),
            hoursAdded: Math.round((chosen.groundToAirport.durationMinutes / 60) * 100) / 100,
            paidToDriver: true,
          })
        } else {
          // The real distance calculation failed (API error, no route found,
          // etc.) — fall back to the same flat estimate used for the return
          // leg home, rather than silently dropping this charge entirely.
          result.push({
            description: 'Ground transport to airport (flat estimate)',
            kind: 'ground-to-airport' as const,
            dealerAmountCents: pricingSettings!.return_ground_transport_fee_cents,
            hoursAdded: pricingSettings!.return_ground_transport_hours,
            paidToDriver: true,
          })
        }
        if (hasOverride) {
          result.push({
            description: `Flight back (manual override)${chosen.origin && chosen.destination ? `: ${chosen.origin.code} → ${chosen.destination.code}` : ''}`,
            kind: 'flight' as const,
            dealerAmountCents: Math.round(parseFloat(flightPriceOverride) * 100),
            hoursAdded: parseFloat(flightHoursOverride),
            paidToDriver: false,
          })
        } else {
          result.push({
            description: `Flight back: ${chosen.origin.code} → ${chosen.destination.code} (${chosen.flight.isDirect ? 'direct' : `${chosen.flight.stops} stop${chosen.flight.stops === 1 ? '' : 's'}`})`,
            kind: 'flight' as const,
            dealerAmountCents: chosen.flight.priceCents,
            hoursAdded: chosen.flight.hoursToAdd,
            paidToDriver: false,
          })
        }
        return result
      }

      function buildBusCharges(): AdditionalCharge[] | null {
        const km = data.distanceKm
        // Past a certain distance, a bus simply isn't a realistic return option
        // for a professional delivery service — treating raw distance/average
        // speed as billable hours was producing absurd totals (20+ hours) for
        // genuinely long trips. Bus is only offered as a comparison option
        // within a sane distance; beyond that, only flight/2nd-driver apply.
        if (km > pricingSettings!.bus_max_distance_km) return null
        const AVG_BUS_SPEED_KMH = 65
        return [
          {
            description: 'Bus back (estimate)',
            kind: 'bus' as const,
            dealerAmountCents: Math.round(pricingSettings!.bus_base_fare_cents + km * pricingSettings!.bus_per_km_cents),
            hoursAdded: Math.round((km / AVG_BUS_SPEED_KMH + pricingSettings!.bus_terminal_buffer_hours) * 100) / 100,
            paidToDriver: false,
          },
        ]
      }

      // Only keep charges the user actually typed in themselves — anything
      // auto-generated (tagged with a `kind`) gets rebuilt fresh every time.
      const manualCharges = additionalCharges.filter((c) => !c.kind)

      // A multi-vehicle deal is always a "drive it back" situation (never flying) —
      // that shouldn't depend on chase vehicle being checked, since chase vehicle
      // is a different concept (one driver following another in the same vehicle
      // pairing) that never actually applies to a multi-vehicle deal. Dealer-to-dealer
      // trades with any pickup vehicles are the same story — there's a real vehicle
      // driving back, so it's never a fly/Uber-back scenario.
      const forcedRoundTrip = isTradeIn || (chaseVehicle && secondDriver) || multiVehicleArrangement !== 'none' || dealerPickupCount > 0 || isPaperworkSigningJob
      const longHaul = oneWayHours > 4

      let finalCharges: AdditionalCharge[] = manualCharges

      if (isCourierJob) {
        // Courier/Package is always purely one-way — driver drives there with
        // their own vehicle, and there's no billed charge of any kind for how
        // they get back (no Uber, no chase vehicle, no comparison). Bypasses
        // the whole auto-select/manual return-method system entirely.
        setEffectiveOneWayReturn(true)
        finalCharges = manualCharges
        setDecisionNote('Courier/Package — one-way only, no return-transport charge applies.')
      } else if (isCustomerRideJob) {
        // Same idea as Courier — a customer shuttle ride is inherently
        // one-way, driven directly in the driver's own or a dealer vehicle,
        // with no vehicle-delivery-style return-transport comparison needed.
        setEffectiveOneWayReturn(true)
        finalCharges = manualCharges
        setDecisionNote('Customer pick-up/drop-off — one-way only, no return-transport charge applies.')
      } else if (forcedRoundTrip) {
        setEffectiveOneWayReturn(false)
        const fc = ferryCharge('roundtrip-vehicle')
        finalCharges = fc ? [...manualCharges, fc] : manualCharges
        if (dealerPickupCount > 0) {
          const driverCount = Math.max(dealerDropoffCount, dealerPickupCount, 1)
          setDecisionNote(`Dealer trade: ${dealerDropoffCount} to drop off, ${dealerPickupCount} to pick up — ${driverCount} driver${driverCount === 1 ? '' : 's'} needed, billed accordingly. Treated as a round trip since vehicles are being driven back.`)
        } else if (isPaperworkSigningJob) setDecisionNote('Paperwork signing — driver takes their own vehicle there and back, always a round trip.')
        else if (isTradeIn) setDecisionNote('Trade-in pickup means the driver needs the vehicle both ways — treated as a round trip.')
        else setDecisionNote(`2nd driver (${secondDriver}) + chase vehicle (${chaseVehicle}) means a round trip — flying back was turned off.`)
      } else if (autoSelectReturnMethod) {
        // Always compare Uber-back against a 2nd driver + chase vehicle, on every
        // trip regardless of length — a short local hop can still come out cheaper
        // one way, and there's no reason to default into an expensive round trip
        // just because chase vehicle happens to be checked. Flight/bus only get
        // added to the comparison on genuine long hauls, where they're realistic.
        const [flyCharges, busCharges] = longHaul
          ? await Promise.all([buildFlyCharges(), Promise.resolve(buildBusCharges())])
          : [null, null]

        const options: { label: string; flying: boolean; secondDrv: boolean; chase: boolean; charges: AdditionalCharge[]; cost: number }[] = []

        if (flyCharges) {
          const fc = ferryCharge('oneway-vehicle')
          const charges = fc ? [...manualCharges, ...flyCharges, fc] : [...manualCharges, ...flyCharges]
          const r = calculatePricing(
            { distanceKm: data.distanceKm, durationMinutes: data.durationMinutes, vehicleMode, numDrivers: 1, outOfProvinceInspection, registryVisit, insuranceVisit, ferryRequired: false, useGarageInsurance, includeTowDeductibleCoverage, additionalCharges: charges, oneWayFlightBack: true },
            pricingSettings
          )
          options.push({ label: 'Flight', flying: true, secondDrv: false, chase: false, charges, cost: r.estimatedDealerCostCents })
        }

        if (busCharges) {
          const fc = ferryCharge('oneway-vehicle')
          const charges = fc ? [...manualCharges, ...busCharges, fc] : [...manualCharges, ...busCharges]
          const r = calculatePricing(
            { distanceKm: data.distanceKm, durationMinutes: data.durationMinutes, vehicleMode, numDrivers: 1, outOfProvinceInspection, registryVisit, insuranceVisit, ferryRequired: false, useGarageInsurance, includeTowDeductibleCoverage, additionalCharges: charges, oneWayFlightBack: true },
            pricingSettings
          )
          options.push({ label: 'Bus', flying: true, secondDrv: false, chase: false, charges, cost: r.estimatedDealerCostCents })
        }

        {
          // Uber-back — the driver goes one-way, and takes an Uber (or walks onto
          // a ferry as a passenger, if one's involved) back to the dealership.
          const fc = ferryCharge('oneway-walkon-return')
          const groundHomeCharge = ferryReturnGroundTransport()
          const charges = fc ? [...manualCharges, groundHomeCharge, fc] : [...manualCharges, groundHomeCharge]
          const r = calculatePricing(
            { distanceKm: data.distanceKm, durationMinutes: data.durationMinutes, vehicleMode, numDrivers: 1, outOfProvinceInspection, registryVisit, insuranceVisit, ferryRequired: false, useGarageInsurance, includeTowDeductibleCoverage, additionalCharges: charges, oneWayFlightBack: true },
            pricingSettings
          )
          options.push({ label: 'Uber back', flying: true, secondDrv: false, chase: false, charges, cost: r.estimatedDealerCostCents })
        }

        // A courier/package run is always one-way — no vehicle-delivery concept
        // of a chase vehicle or 2nd driver applies, so that option is excluded
        // from the comparison entirely rather than possibly winning by cost.
        if (!isCourierJob) {
          const fc = ferryCharge('roundtrip-vehicle')
          const charges = fc ? [...manualCharges, fc] : manualCharges
          const r = calculatePricing(
            { distanceKm: data.distanceKm, durationMinutes: data.durationMinutes, vehicleMode, numDrivers: 2, outOfProvinceInspection, registryVisit, insuranceVisit, ferryRequired: false, useGarageInsurance, includeTowDeductibleCoverage, additionalCharges: charges, oneWayFlightBack: false },
            pricingSettings
          )
          options.push({ label: '2nd driver + chase', flying: false, secondDrv: true, chase: true, charges, cost: r.estimatedDealerCostCents })
        }

        const winner = options.reduce((best, o) => (o.cost < best.cost ? o : best))
        setEffectiveOneWayReturn(winner.flying)
        finalCharges = winner.charges
        setFlyingBack(winner.flying)
        setSecondDriver(winner.secondDrv)
        setChaseVehicle(winner.chase)

        // Duffel doesn't carry every airline's fares (notably ultra-low-cost
        // carriers like Flair, which mostly sell direct-only) — flag it clearly
        // when the flight option isn't direct, since that often means a cheaper
        // real fare exists that this search just couldn't see.
        const flightOption = options.find((o) => o.label === 'Flight')
        const flightCharge = flightOption?.charges.find((c) => c.kind === 'flight')
        const flightStopsNote = flightCharge?.description.includes('direct')
          ? ''
          : flightCharge
            ? ` ⚠️ The flight found wasn't direct (${flightCharge.description.match(/\(([^)]+)\)/)?.[1] ?? 'connecting'}) — Duffel may be missing a cheaper direct fare from a carrier it doesn't have access to (e.g. Flair). Worth double-checking Google Flights before trusting this comparison.`
            : ''

        setDecisionNote(
          `${longHaul ? `Long haul (${Math.round(oneWayHours * 10) / 10}hrs one-way)` : 'Short trip'} — auto-selected ${winner.label} ($${(winner.cost / 100).toFixed(2)}), cheapest of: ` +
          options.map((o) => `${o.label} $${(o.cost / 100).toFixed(2)}`).join(', ') +
          `. Uncheck "Auto-select cheapest return method" below to lock in a manual choice instead.` + flightStopsNote
        )
      } else {
        // Auto-select is off — respect the manual checkboxes exactly as set.
        if (flyingBack) {
          setEffectiveOneWayReturn(true)
          const flyCharges = await buildFlyCharges()
          if (flyCharges) {
            const fc = ferryCharge('oneway-vehicle')
            finalCharges = fc ? [...manualCharges, ...flyCharges, fc] : [...manualCharges, ...flyCharges]
            setDecisionNote('Flying back (manually selected).')
          } else {
            setCalcError('Could not find a flight price — add one manually below if needed.')
            const fc = ferryCharge('oneway-vehicle')
            finalCharges = fc ? [...manualCharges, fc] : manualCharges
          }
        } else {
          // No trade-in, no chase+2nd driver, not flying, and Uber back wasn't
          // explicitly requested — that means the booking dealer is picking the
          // driver up themselves, so no return-transport charge applies at all.
          // The vehicle still only goes one way though, so gas/hours stay one-way.
          setEffectiveOneWayReturn(true)
          if (!uberBackRequested) {
            finalCharges = manualCharges
            setDecisionNote(
              'Manual: no return transport selected — the booking dealer will arrange pickup for the driver themselves. ' +
              'Check "Uber back requested" below (or turn auto-select back on) if a ride home should be billed instead.'
            )
          } else {
            const fc = ferryCharge('oneway-walkon-return')
            const groundHomeCharge = ferryReturnGroundTransport()
            finalCharges = [...manualCharges, groundHomeCharge, ...(fc ? [fc] : [])]
            setDecisionNote(
              (fc
                ? `Manual: ferry return is walk-on passenger + Uber home (not a 2nd vehicle fare). Ground transport home: $${(groundHomeCharge.dealerAmountCents / 100).toFixed(2)} (${ferryInfo?.groundHome ? `calculated, ${ferryInfo.groundHome.distanceKm}km` : 'flat estimate'}).`
                : `Manual: Uber back requested — no ferry on this route. Ground transport home: $${(groundHomeCharge.dealerAmountCents / 100).toFixed(2)} (flat estimate).`)
              + ' Check "Auto-select cheapest return method" below to have this picked automatically instead.'
            )
          }
        }
      }

      // Always update the saved charges — this is what clears stale flight/ferry/ground
      // transport entries and what the sync effect below uses for every later recompute.
      setAdditionalCharges(finalCharges)
    } catch {
      setCalcError('Something went wrong reaching the mapping service.')
    }
    setCalculating(false)
  }, [stops, vehicleMode, secondDriver, chaseVehicle, isTradeIn, outOfProvinceInspection, registryVisit, insuranceVisit, ferryRequired, additionalCharges, flyingBack, pricingSettings, scheduledFor, flightPriceOverride, flightHoursOverride, originTimeZone, destinationTimeZone, autoSelectReturnMethod, uberBackRequested, selectedFlightOptionIdx])

  // Single source of truth for the pricing summary — recomputes any time the
  // relevant inputs change, using the last-fetched distance/duration.
  useEffect(() => {
    if (distanceKm == null || durationMinutes == null || !pricingSettings) return

    // Rides-along vehicles don't get their own transport bill — that cost lives
    // on the linked job that actually carries the multi-vehicle arrangement.
    if (ridesAlongWithLinked) {
      const result = calculatePricing(
        {
          distanceKm: 0,
          durationMinutes: 0,
          vehicleMode,
          numDrivers: 1,
          outOfProvinceInspection,
          registryVisit,
        insuranceVisit,
          ferryRequired: false,
          useGarageInsurance,
          includeTowDeductibleCoverage,
          additionalCharges: additionalCharges.filter((c) => !c.kind),
          oneWayFlightBack: false,
        },
        pricingSettings
      )
      setPricing(result)
      return
    }

    const isDealerToDealerMultiVehicle = dealerDropoffCount > 0 || dealerPickupCount > 0
    const outboundVehicleCount = isDealerToDealerMultiVehicle
      ? Math.max(dealerDropoffCount, 1)
      : multiVehicleArrangement === 'two_purchases_one_trade' || multiVehicleArrangement === 'two_vehicles_two_trades'
        ? 2
        : multiVehicleArrangement === 'two_trades_one_purchase'
          ? 1
          : undefined
    const returnVehicleCount = isDealerToDealerMultiVehicle
      ? (dealerPickupCount > 0 ? dealerPickupCount : undefined)
      : multiVehicleArrangement === 'two_trades_one_purchase' || multiVehicleArrangement === 'two_vehicles_two_trades'
        ? 2
        : multiVehicleArrangement === 'two_purchases_one_trade'
          ? 1
          : undefined

    const result = calculatePricing(
      {
        distanceKm,
        durationMinutes,
        vehicleMode,
        numDrivers: isDealerToDealerMultiVehicle ? Math.max(dealerDropoffCount, dealerPickupCount, 1) : (secondDriver ? 2 : 1),
        outOfProvinceInspection,
        registryVisit,
        insuranceVisit,
        ferryRequired: false,
        useGarageInsurance,
        includeTowDeductibleCoverage,
        additionalCharges,
        oneWayFlightBack: effectiveOneWayReturn,
        outboundVehicleCount,
        returnVehicleCount,
        markupPercentOverride: (() => {
          const baseMarkup = isCustomerRide ? pricingSettings.customer_pickup_dropoff_markup_percent : pricingSettings.dealer_markup_percent
          if (discountPercent > 0) return baseMarkup * (1 - discountPercent / 100)
          return isCustomerRide ? baseMarkup : null
        })(),
        useSimpleJobRates: isCourier || isPaperworkSigning || isCustomerRide,
      },
      pricingSettings
    )
    setPricing(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [additionalCharges, vehicleMode, secondDriver, outOfProvinceInspection, registryVisit, ferryRequired, ferryLiveDataUsed, useGarageInsurance, includeTowDeductibleCoverage, multiVehicleArrangement, ridesAlongWithLinked, flyingBack, effectiveOneWayReturn, dealerDropoffCount, dealerPickupCount, distanceKm, durationMinutes, discountPercent])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const filledStops = stops.map((s) => s.trim()).filter(Boolean)
    if (filledStops.length < 2) {
      setError('Enter at least a pickup and dropoff address.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You need to be signed in.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    let orgIdToUse = profile?.role === 'platform_admin' ? selectedOrgId : profile?.organization_id

    if (profile?.role === 'platform_admin' && selectedOrgId === '__new__') {
      if (!newDealerName.trim()) {
        setError('Please enter a name for the new dealer.')
        setLoading(false)
        return
      }
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: newDealerName.trim(), org_type: 'dealer_customer' })
        .select('id')
        .single()

      if (orgError) {
        setError(orgError.message)
        setLoading(false)
        return
      }
      orgIdToUse = newOrg.id
    }

    if (!orgIdToUse) {
      setError(
        profile?.role === 'platform_admin'
          ? 'Please select a dealer to post this job for.'
          : 'Your account is not linked to an organization yet.'
      )
      setLoading(false)
      return
    }

    // When there's a 2nd driver, each driver's own job shows their own full
    // pay (not the combined 2-driver total) — the dealer's bill still reflects
    // the full 2-driver cost, but what a driver sees for THEIR job should be a
    // solo figure, matching how the auto-created companion job pays.
    const primaryDriverPricing =
      secondDriver && pricingSettings && distanceKm != null && durationMinutes != null
        ? calculatePricing(
            {
              distanceKm,
              durationMinutes,
              vehicleMode,
              numDrivers: 1,
              outOfProvinceInspection,
              registryVisit,
            insuranceVisit,
              ferryRequired: false,
              useGarageInsurance: false,
          includeTowDeductibleCoverage: false,
              additionalCharges: additionalCharges.filter((c) => !c.kind),
              oneWayFlightBack: effectiveOneWayReturn,
            },
            pricingSettings
          )
        : pricing

    const isDealerToDealerMultiVehicle = dealerDropoffCount > 0 || dealerPickupCount > 0
    const primaryDropoffVehicle = dealerDropoffVehicles[0]
    const primaryPickupVehicle = dealerPickupVehicles[0]
    const primaryVehicle = primaryDropoffVehicle || primaryPickupVehicle

    const { data: newJob, error: jobError } = await supabase.from('jobs').insert({
      organization_id: orgIdToUse,
      job_type_id: jobTypeId,
      created_by: user.id,
      pickup_address: filledStops[0],
      dropoff_address: filledStops[filledStops.length - 1],
      recipient_name: customerFullName || null,
      recipient_phone: customerPhone || null,
      vehicle_year: isDealerToDealerMultiVehicle ? (primaryVehicle?.year ? parseInt(primaryVehicle.year) : null) : (vehicleYear ? parseInt(vehicleYear) : null),
      package_description: useSimplifiedForm ? (packageDescription || null) : null,
      package_direction: isCourier ? packageDirection : null,
      pickup_dropoff_reason: isCustomerRide ? pickupDropoffReason : null,
      pickup_dropoff_reason_other: isCustomerRide && pickupDropoffReason === 'other' ? (pickupDropoffReasonOther || null) : null,
      vehicle_make: isDealerToDealerMultiVehicle ? (primaryVehicle?.make || null) : (vehicleMake || null),
      vehicle_model: isDealerToDealerMultiVehicle ? (primaryVehicle?.model || null) : (vehicleModel || null),
      stock_number: isDealerToDealerMultiVehicle ? (primaryDropoffVehicle?.stockNumber || null) : (stockNumber || null),
      vin: isDealerToDealerMultiVehicle ? (primaryVehicle?.vin || null) : (vin || null),
      mileage: mileage ? parseInt(mileage) : null,
      key_count: keyCount ? parseInt(keyCount) : null,
      has_wheel_lock: hasWheelLock,
      has_charging_cables: hasChargingCables,
      other_included_items: otherIncludedItems || null,
      customer_full_name: customerFullName || null,
      customer_phone: customerPhone || null,
      customer_address: customerAddress || null,
      scheduled_for: scheduledFor ? (originTimeZone ? zonedLocalInputToUtcIso(scheduledFor, originTimeZone) : localInputToUtcIso(scheduledFor)) ?? null : null,
      delivery_deadline: deliveryDeadline ? (destinationTimeZone ? zonedLocalInputToUtcIso(deliveryDeadline, destinationTimeZone) : localInputToUtcIso(deliveryDeadline)) ?? null : null,
      second_driver_required: secondDriver,
      chase_vehicle_required: chaseVehicle,
      is_trade_in_pickup: isTradeIn,
      is_first_nations_delivery: isFirstNationsDelivery,
      one_way_flight_back: flyingBack,
      auto_select_return_method: autoSelectReturnMethod,
      vehicle_mode: vehicleMode,
      used_own_vehicle: true,
      out_of_province_inspection: outOfProvinceInspection,
      registry_visit: registryVisit,
      insurance_visit: insuranceVisit,
      ferry_required: ferryRequired,
      use_garage_insurance: useGarageInsurance,
      include_tow_deductible_coverage: includeTowDeductibleCoverage,
      linked_job_id: linkedJobId,
      multi_vehicle_arrangement: multiVehicleArrangement,
      rides_along_with_linked: ridesAlongWithLinked,
      additional_charges: additionalCharges,
      overnight_required: pricing?.overnightRequired ?? false,
      estimated_distance_km: pricing?.tripDistanceKm ?? distanceKm,
      estimated_duration_minutes: durationMinutes,
      estimated_dealer_cost_cents: pricing?.estimatedDealerCostCents ?? null,
      estimated_driver_pay_cents: primaryDriverPricing?.estimatedDriverPayCents ?? null,
      estimated_driver_reimbursement_cents: primaryDriverPricing?.reimbursementCents ?? null,
      baseline_fuel_cents: pricing?.gasCostCents ?? 0,
      baseline_inspection_cents: pricing?.inspectionFeeCents ?? 0,
      baseline_food_cents: pricing?.mealCostCents ?? 0,
      baseline_hotel_cents: pricing?.hotelCents ?? 0,
      baseline_ferry_cents: pricing?.ferryFeeCents ?? 0,
      pricing_breakdown: pricing ? JSON.stringify(pricing) : null,
      trade_in_year: isDealerToDealerMultiVehicle
        ? (primaryDropoffVehicle && primaryPickupVehicle?.year ? parseInt(primaryPickupVehicle.year) : null)
        : (isTradeIn && tradeInYear ? parseInt(tradeInYear) : null),
      trade_in_make: isDealerToDealerMultiVehicle
        ? (primaryDropoffVehicle && primaryPickupVehicle ? primaryPickupVehicle.make || null : null)
        : (isTradeIn ? tradeInMake || null : null),
      trade_in_model: isDealerToDealerMultiVehicle
        ? (primaryDropoffVehicle && primaryPickupVehicle ? primaryPickupVehicle.model || null : null)
        : (isTradeIn ? tradeInModel || null : null),
      trade_in_vin: isDealerToDealerMultiVehicle
        ? (primaryDropoffVehicle && primaryPickupVehicle ? primaryPickupVehicle.vin || null : null)
        : (isTradeIn ? tradeInVin || null : null),
      notes: notes || null,
    }).select('id').single()

    if (jobError) {
      setError(jobError.message)
      setLoading(false)
      return
    }

    const stopRows = filledStops.map((address, i) => ({
      job_id: newJob.id,
      stop_order: i,
      address,
      stop_type: i === 0 ? 'pickup' : i === filledStops.length - 1 ? 'dropoff' : 'waypoint',
    }))
    await supabase.from('job_stops').insert(stopRows)

    fetch('/api/notify-admin-new-hold-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: newJob.id }),
    }).catch(() => {})

    // Linking is bidirectional — the job we linked to needs to point back at
    // this new one too, so both drivers/admin see they're paired either way.
    if (linkedJobId) {
      await supabase.from('jobs').update({ linked_job_id: newJob.id }).eq('id', linkedJobId)
    }

    // Second driver required — create a fully independent companion job post
    // (its own full pay, not a split of the primary's) so a different driver
    // can see and claim it separately, linked back to this one. Uses its own
    // field (companion_job_id), separate from multi-vehicle linking, so the
    // two features never conflict even when used together. Dealer-to-dealer
    // uses the generalized loop below instead, since it can need more than 2 drivers.
    if (secondDriver && !isDealerToDealerMultiVehicle && pricingSettings && distanceKm != null && durationMinutes != null) {
      const soloPricing = calculatePricing(
        {
          distanceKm,
          durationMinutes,
          // A chase driver always uses their own personal vehicle to follow,
          // regardless of whether the main vehicle is being driven or towed —
          // forcing 'towed' here is what actually triggers wear & tear
          // compensation in the formula (it's keyed off "uses own vehicle",
          // not literally about towing). For a genuine second-vehicle
          // delivery (not a chase), the real vehicleMode still applies.
          vehicleMode: chaseVehicle ? 'towed' : vehicleMode,
          numDrivers: 1,
          outOfProvinceInspection,
          registryVisit,
        insuranceVisit,
          ferryRequired: false,
          useGarageInsurance: false,
          includeTowDeductibleCoverage: false,
          additionalCharges: additionalCharges.filter((c) => !c.kind),
          oneWayFlightBack: effectiveOneWayReturn,
        },
        pricingSettings
      )

      const { data: companionJob, error: companionError } = await supabase.from('jobs').insert({
        organization_id: orgIdToUse,
        job_type_id: jobTypeId,
        created_by: user.id,
        pickup_address: filledStops[0],
        dropoff_address: filledStops[filledStops.length - 1],
        // A chase-vehicle driver isn't delivering anything or interacting
        // with the customer at all — they're just following in their own
        // car so the lead driver has a ride back. No vehicle to log, no
        // customer contact info to give them.
        recipient_name: chaseVehicle ? null : (customerFullName || null),
        recipient_phone: chaseVehicle ? null : (customerPhone || null),
        vehicle_year: chaseVehicle ? null : (secondVehicleYear ? parseInt(secondVehicleYear) : null),
        vehicle_make: chaseVehicle ? null : (secondVehicleMake || null),
        vehicle_model: chaseVehicle ? null : (secondVehicleModel || null),
        stock_number: chaseVehicle ? null : (secondVehicleStockNumber || null),
        vin: chaseVehicle ? null : (secondVehicleVin || null),
        mileage: null,
        key_count: chaseVehicle ? null : (keyCount ? parseInt(keyCount) : null),
        has_wheel_lock: chaseVehicle ? false : hasWheelLock,
        has_charging_cables: chaseVehicle ? false : hasChargingCables,
        other_included_items: chaseVehicle ? null : (otherIncludedItems || null),
        customer_full_name: chaseVehicle ? null : (customerFullName || null),
        customer_phone: chaseVehicle ? null : (customerPhone || null),
        customer_address: chaseVehicle ? null : (customerAddress || null),
        scheduled_for: scheduledFor ? (originTimeZone ? zonedLocalInputToUtcIso(scheduledFor, originTimeZone) : localInputToUtcIso(scheduledFor)) ?? null : null,
        delivery_deadline: deliveryDeadline ? (destinationTimeZone ? zonedLocalInputToUtcIso(deliveryDeadline, destinationTimeZone) : localInputToUtcIso(deliveryDeadline)) ?? null : null,
        second_driver_required: false,
        chase_vehicle_required: false,
        is_chase_vehicle_job: chaseVehicle,
        is_trade_in_pickup: chaseVehicle ? false : isTradeIn,
        is_first_nations_delivery: chaseVehicle ? false : isFirstNationsDelivery,
        one_way_flight_back: flyingBack,
        auto_select_return_method: autoSelectReturnMethod,
        vehicle_mode: vehicleMode,
        used_own_vehicle: true,
        out_of_province_inspection: chaseVehicle ? false : outOfProvinceInspection,
        registry_visit: chaseVehicle ? false : registryVisit,
      insurance_visit: chaseVehicle ? false : insuranceVisit,
        ferry_required: ferryRequired,
        use_garage_insurance: false,
        is_second_driver_job: true,
        companion_job_id: newJob.id,
        trade_in_year: chaseVehicle ? null : (secondTradeInYear ? parseInt(secondTradeInYear) : null),
        trade_in_make: chaseVehicle ? null : (secondTradeInMake || null),
        trade_in_model: chaseVehicle ? null : (secondTradeInModel || null),
        trade_in_vin: chaseVehicle ? null : (secondTradeInVin || null),
        overnight_required: soloPricing.overnightRequired,
        estimated_distance_km: soloPricing.tripDistanceKm,
        estimated_duration_minutes: durationMinutes,
        estimated_dealer_cost_cents: null,
        estimated_driver_pay_cents: soloPricing.estimatedDriverPayCents,
        estimated_driver_reimbursement_cents: soloPricing.reimbursementCents,
        baseline_fuel_cents: soloPricing.gasCostCents,
        baseline_inspection_cents: soloPricing.inspectionFeeCents,
        baseline_food_cents: soloPricing.mealCostCents,
        baseline_hotel_cents: soloPricing.hotelCents,
        baseline_ferry_cents: soloPricing.ferryFeeCents,
        notes: notes ? `${notes}\n\n(Chase/2nd driver for the linked primary job)` : '(Chase/2nd driver for the linked primary job)',
      }).select('id').single()

      if (companionError) {
        setError(`Job posted, but creating the 2nd driver's job failed: ${companionError.message}. The primary job was still created — you may need to post the 2nd driver's job manually or contact support.`)
        setLoading(false)
        return
      }

      if (companionJob) {
        const { error: companionStopsError } = await supabase.from('job_stops').insert(
          filledStops.map((address, i) => ({
            job_id: companionJob.id,
            stop_order: i,
            address,
            stop_type: i === 0 ? 'pickup' : i === filledStops.length - 1 ? 'dropoff' : 'waypoint',
          }))
        )
        if (companionStopsError) {
          setError(`Job posted, but saving the 2nd driver's job's addresses failed: ${companionStopsError.message}.`)
          setLoading(false)
          return
        }
        // Point the primary job back at its companion too.
        await supabase.from('jobs').update({ companion_job_id: companionJob.id }).eq('id', newJob.id)
      }
    }

    // Dealer-to-dealer with more than one driver needed — create one companion
    // job per additional driver (not just one), each with its own vehicle
    // assignment, chained together via companion_job_id (primary -> #2 -> #3 -> ...)
    // so every driver has their own independently claimable job post.
    if (isDealerToDealerMultiVehicle && pricingSettings && distanceKm != null && durationMinutes != null) {
      const driverCount = Math.max(dealerDropoffCount, dealerPickupCount, 1)
      let previousJobId = newJob.id

      for (let i = 1; i < driverCount; i++) {
        const dropoffVehicle = dealerDropoffVehicles[i]
        const pickupVehicle = dealerPickupVehicles[i]
        const vehicle = dropoffVehicle || pickupVehicle

        const soloPricing = calculatePricing(
          {
            distanceKm,
            durationMinutes,
            vehicleMode,
            numDrivers: 1,
            outOfProvinceInspection,
            registryVisit,
            insuranceVisit,
            ferryRequired: false,
            useGarageInsurance: false,
            includeTowDeductibleCoverage: false,
            additionalCharges: additionalCharges.filter((c) => !c.kind),
            oneWayFlightBack: effectiveOneWayReturn,
          },
          pricingSettings
        )

        const { data: companionJob, error: companionError } = await supabase.from('jobs').insert({
          organization_id: orgIdToUse,
          job_type_id: jobTypeId,
          created_by: user.id,
          pickup_address: filledStops[0],
          dropoff_address: filledStops[filledStops.length - 1],
          recipient_name: customerFullName || null,
          recipient_phone: customerPhone || null,
          vehicle_year: vehicle?.year ? parseInt(vehicle.year) : null,
          vehicle_make: vehicle?.make || null,
          vehicle_model: vehicle?.model || null,
          stock_number: dropoffVehicle?.stockNumber || null,
          vin: vehicle?.vin || null,
          mileage: null,
          key_count: keyCount ? parseInt(keyCount) : null,
          has_wheel_lock: hasWheelLock,
          has_charging_cables: hasChargingCables,
          other_included_items: otherIncludedItems || null,
          customer_full_name: customerFullName || null,
          customer_phone: customerPhone || null,
          customer_address: customerAddress || null,
          scheduled_for: scheduledFor ? (originTimeZone ? zonedLocalInputToUtcIso(scheduledFor, originTimeZone) : localInputToUtcIso(scheduledFor)) ?? null : null,
          delivery_deadline: deliveryDeadline ? (destinationTimeZone ? zonedLocalInputToUtcIso(deliveryDeadline, destinationTimeZone) : localInputToUtcIso(deliveryDeadline)) ?? null : null,
          second_driver_required: false,
          chase_vehicle_required: false,
          is_trade_in_pickup: !!pickupVehicle,
          is_first_nations_delivery: isFirstNationsDelivery,
          one_way_flight_back: false,
          vehicle_mode: vehicleMode,
          used_own_vehicle: true,
          out_of_province_inspection: outOfProvinceInspection,
          registry_visit: registryVisit,
          insurance_visit: insuranceVisit,
          ferry_required: ferryRequired,
          use_garage_insurance: false,
          is_second_driver_job: true,
          trade_in_year: dropoffVehicle && pickupVehicle?.year ? parseInt(pickupVehicle.year) : null,
          trade_in_make: dropoffVehicle && pickupVehicle ? pickupVehicle.make || null : null,
          trade_in_model: dropoffVehicle && pickupVehicle ? pickupVehicle.model || null : null,
          trade_in_vin: dropoffVehicle && pickupVehicle ? pickupVehicle.vin || null : null,
          overnight_required: soloPricing.overnightRequired,
          estimated_distance_km: soloPricing.tripDistanceKm,
          estimated_duration_minutes: durationMinutes,
          estimated_dealer_cost_cents: null,
          estimated_driver_pay_cents: soloPricing.estimatedDriverPayCents,
          estimated_driver_reimbursement_cents: soloPricing.reimbursementCents,
          notes: notes ? `${notes}\n\nDriver ${i + 1} of ${driverCount} on this dealer trade.` : `Driver ${i + 1} of ${driverCount} on this dealer trade.`,
        }).select('id').single()

        if (companionError) {
          setError(`Primary job posted, but creating driver ${i + 1}'s job failed: ${companionError.message}. You may need to post the remaining drivers' jobs manually or contact support.`)
          setLoading(false)
          return
        }

        if (companionJob) {
          const { error: companionStopsError } = await supabase.from('job_stops').insert(
            filledStops.map((address, idx) => ({
              job_id: companionJob.id,
              stop_order: idx,
              address,
              stop_type: idx === 0 ? 'pickup' : idx === filledStops.length - 1 ? 'dropoff' : 'waypoint',
            }))
          )
          if (companionStopsError) {
            setError(`Primary job posted, but saving driver ${i + 1}'s job's addresses failed: ${companionStopsError.message}.`)
            setLoading(false)
            return
          }
          await supabase.from('jobs').update({ companion_job_id: companionJob.id }).eq('id', previousJobId)
          previousJobId = companionJob.id
        }
      }
    }

    if (discountPercent > 0) {
      const effectiveOrgId = isAdmin ? selectedOrgId : myOrgId
      if (effectiveOrgId && effectiveOrgId !== '__new__') {
        await supabase.rpc('increment_discount_usage', { p_org_id: effectiveOrgId })
      }
    }

    router.push('/dashboard')
    router.refresh()
  }

  const jobTypeName = jobTypes.find((jt) => jt.id === jobTypeId)?.name
  const isCourier = ['Courier / Package', 'Parts Delivery', 'Parts Pickup'].includes(jobTypeName ?? '')
  const isPaperworkSigning = jobTypeName === 'Paperwork Signing'
  const isCustomerPickup = jobTypeName === 'Customer Pick Up'
  const isCustomerDropoff = jobTypeName === 'Customer Drop Off'
  const isCustomerRide = isCustomerPickup || isCustomerDropoff
  // Paperwork Signing uses the same simplified form as Courier/Package (no
  // vehicle section, no insurance, etc.) — the only difference is Paperwork
  // Signing is always a round trip on the driver's own vehicle, never a
  // one-way Uber-back/chase-vehicle scenario like a courier package can be.
  const useSimplifiedForm = isCourier || isPaperworkSigning || isCustomerRide

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Logo height={20} />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Post a new job</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {isAdmin && (
            <div>
              <label className="block text-sm text-gray-700 mb-1">Posting for dealer</label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
                <option value="__new__">+ Add a new dealer...</option>
              </select>
              {selectedOrgId === '__new__' && (
                <input
                  autoFocus
                  placeholder="New dealer name"
                  value={newDealerName}
                  onChange={(e) => setNewDealerName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2"
                />
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-700 mb-1">Job type</label>
            <select
              value={jobTypeId}
              onChange={(e) => {
                const newId = e.target.value
                setJobTypeId(newId)
                const newType = jobTypes.find((jt) => jt.id === newId)
                if (newType?.name !== 'Vehicle Delivery' && multiVehicleArrangement !== 'none') {
                  setMultiVehicleArrangement('none')
                }
                if (newType?.name !== 'Dealer to Dealer' && (dealerDropoffCount > 0 || dealerPickupCount > 0)) {
                  setDealerDropoffCount(0)
                  setDealerPickupCount(0)
                  setDealerDropoffVehicles([])
                  setDealerPickupVehicles([])
                }
                // Courier/Package and Paperwork Signing hide the trade-in/2nd-driver/
                // chase-vehicle checkboxes, but the state itself doesn't otherwise
                // reset — a stale true value from a previously-selected job type
                // would still silently force round-trip pricing underneath the
                // hidden UI. Clear it all out on entering either simplified form.
                if (['Courier / Package', 'Parts Delivery', 'Parts Pickup', 'Paperwork Signing'].includes(newType?.name ?? '')) {
                  setIsTradeIn(false)
                  setSecondDriver(false)
                  setChaseVehicle(false)
                  setFlyingBack(false)
                  setAutoSelectReturnMethod(true)
                }
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {jobTypes.map((jt) => (
                <option key={jt.id} value={jt.id}>{jt.name}</option>
              ))}
            </select>
          </div>

          {jobTypes.find((jt) => jt.id === jobTypeId)?.name === 'Vehicle Delivery' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Multi-vehicle deal (2 vehicles, only 1 trip logged here)</label>
              <select
                value={multiVehicleArrangement}
                onChange={(e) => {
                  const value = e.target.value as typeof multiVehicleArrangement
                  setMultiVehicleArrangement(value)
                  if (value !== 'none') {
                    // A multi-vehicle deal always needs two people — auto-select the
                    // second driver, which is what actually creates their companion
                    // job post. No manual linking needed. Chase vehicle is a
                    // different concept (one driver following another in the same
                    // vehicle pairing) and never applies here — each driver has
                    // their own separate vehicle and job post. Every arrangement
                    // involves at least one trade-in, so surface those fields too.
                    setSecondDriver(true)
                    setIsTradeIn(true)
                  }
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="none">Not a multi-vehicle deal</option>
                <option value="two_trades_one_purchase">2 trade-ins, 1 purchase — 1 vehicle up, 2 back</option>
                <option value="two_purchases_one_trade">2 purchases, 1 trade-in — 2 vehicles up, 1 back</option>
                <option value="two_vehicles_two_trades">2 purchases, 2 trade-ins — 2 vehicles up, 2 back</option>
              </select>
              {multiVehicleArrangement !== 'none' && (
                <p className="text-xs text-gray-400 mt-1">
                  Gas/ferry costs will use the right vehicle count for each leg, and a second driver has been
                  selected below — a fully independent job post for them will be created automatically when you
                  submit, so a second driver can claim it separately. Enter each vehicle&apos;s info in the
                  Vehicle section below, grouped together.
                </p>
              )}
            </div>
          )}

          {jobTypes.find((jt) => jt.id === jobTypeId)?.name === 'Dealer to Dealer' && (
            <div className="space-y-4 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900">Vehicles In This Trade</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Vehicles to drop off</label>
                  <select
                    value={dealerDropoffCount}
                    onChange={(e) => {
                      const count = parseInt(e.target.value)
                      setDealerDropoffCount(count)
                      resizeDealerVehicles(count, dealerDropoffVehicles, setDealerDropoffVehicles)
                      const driverCount = Math.max(count, dealerPickupCount, 1)
                      setSecondDriver(driverCount > 1)
                      // No drop-off but at least one pick-up means there's nothing to drive
                      // there with — default to a chase vehicle convoy to get everyone there,
                      // unless the dealer turns it off manually (falls back to Uber/bus/etc).
                      setChaseVehicle(count === 0 && dealerPickupCount > 0)
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {Array.from({ length: 8 }, (_, n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Vehicles to pick up</label>
                  <select
                    value={dealerPickupCount}
                    onChange={(e) => {
                      const count = parseInt(e.target.value)
                      setDealerPickupCount(count)
                      resizeDealerVehicles(count, dealerPickupVehicles, setDealerPickupVehicles)
                      const driverCount = Math.max(dealerDropoffCount, count, 1)
                      setSecondDriver(driverCount > 1)
                      setChaseVehicle(dealerDropoffCount === 0 && count > 0)
                      setIsTradeIn(count > 0)
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {Array.from({ length: 8 }, (_, n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(dealerDropoffCount > 0 || dealerPickupCount > 0) && (
                <p className="text-xs text-gray-400 -mt-2">
                  {Math.max(dealerDropoffCount, dealerPickupCount, 1)} driver{Math.max(dealerDropoffCount, dealerPickupCount, 1) === 1 ? '' : 's'} needed —
                  each additional driver beyond the first gets their own independent job post automatically when you submit.
                  {dealerDropoffCount === 0 && dealerPickupCount > 0 && (
                    <> Chase vehicle selected below to get everyone to the pickup — turn it off to use Uber/bus/flight/ferry instead.</>
                  )}
                </p>
              )}

              {dealerDropoffVehicles.map((v, i) => (
                <div key={`dropoff-${i}`} className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-xs text-gray-500">Vehicle to drop off #{i + 1}</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={v.year} onChange={(e) => updateDealerVehicle(dealerDropoffVehicles, setDealerDropoffVehicles, i, 'year', e.target.value)} placeholder="Year" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    <input value={v.make} onChange={(e) => updateDealerVehicle(dealerDropoffVehicles, setDealerDropoffVehicles, i, 'make', e.target.value)} placeholder="Make" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    <input value={v.model} onChange={(e) => updateDealerVehicle(dealerDropoffVehicles, setDealerDropoffVehicles, i, 'model', e.target.value)} placeholder="Model" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <input value={v.stockNumber} onChange={(e) => updateDealerVehicle(dealerDropoffVehicles, setDealerDropoffVehicles, i, 'stockNumber', e.target.value)} placeholder="Stock #" required className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  <input value={v.vin} onChange={(e) => updateDealerVehicle(dealerDropoffVehicles, setDealerDropoffVehicles, i, 'vin', e.target.value)} placeholder="VIN" required className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
              ))}

              {dealerPickupVehicles.map((v, i) => (
                <div key={`pickup-${i}`} className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-xs text-gray-500">Vehicle to pick up #{i + 1}</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={v.year} onChange={(e) => updateDealerVehicle(dealerPickupVehicles, setDealerPickupVehicles, i, 'year', e.target.value)} placeholder="Year" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    <input value={v.make} onChange={(e) => updateDealerVehicle(dealerPickupVehicles, setDealerPickupVehicles, i, 'make', e.target.value)} placeholder="Make" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    <input value={v.model} onChange={(e) => updateDealerVehicle(dealerPickupVehicles, setDealerPickupVehicles, i, 'model', e.target.value)} placeholder="Model" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <input value={v.vin} onChange={(e) => updateDealerVehicle(dealerPickupVehicles, setDealerPickupVehicles, i, 'vin', e.target.value)} placeholder="VIN" required className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {stops.map((stop, i) => (
              <div key={i}>
                <label className="block text-sm text-gray-700 mb-1">
                  {i === 0 ? 'Pickup address' : i === stops.length - 1 ? 'Dropoff address' : `Stop ${i}`}
                </label>
                <div className="flex gap-2">
                  <input
                    required={i === 0 || i === stops.length - 1}
                    value={stop}
                    onChange={(e) => updateStop(i, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  {i !== 0 && i !== stops.length - 1 && (
                    <button type="button" onClick={() => removeStop(i)} className="text-xs text-gray-400 hover:text-red-600 px-2">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={addStop} className="text-xs text-gray-600 hover:text-gray-900 underline">
              + Add a stop
            </button>
          </div>

          {useSimplifiedForm ? (
            <div className="space-y-3 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900">
                {isPaperworkSigning ? 'Paperwork' : isCustomerRide ? (isCustomerPickup ? 'Customer Pick Up' : 'Customer Drop Off') : 'Package'}
              </p>
              {isCourier && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Pick up or drop off</label>
                  <select
                    value={packageDirection}
                    onChange={(e) => setPackageDirection(e.target.value as 'pickup' | 'dropoff')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="pickup">Pick up</option>
                    <option value="dropoff">Drop off</option>
                  </select>
                </div>
              )}
              {isCustomerRide ? (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reason for pick up / drop off</label>
                  <select
                    value={pickupDropoffReason}
                    onChange={(e) => setPickupDropoffReason(e.target.value as 'sales' | 'service' | 'other')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="sales">Sales</option>
                    <option value="service">Service</option>
                    <option value="other">Other</option>
                  </select>
                  {pickupDropoffReason === 'other' && (
                    <input
                      value={pickupDropoffReasonOther}
                      onChange={(e) => setPickupDropoffReasonOther(e.target.value)}
                      placeholder="Describe the reason"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2"
                    />
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {isPaperworkSigning ? "What's being signed" : "What's being picked up / dropped off"}
                  </label>
                  <input
                    value={packageDescription}
                    onChange={(e) => setPackageDescription(e.target.value)}
                    placeholder={isPaperworkSigning ? 'e.g. loan documents, bill of sale, trade paperwork' : 'e.g. envelope of signed paperwork, laptop, spare key fob'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
          ) : (
          <div className="space-y-3 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900">Vehicle</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Year</label>
                <input value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Make</label>
                <input value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stock number</label>
                <input value={stockNumber} onChange={(e) => setStockNumber(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mileage</label>
                <input value={mileage} onChange={(e) => setMileage(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">VIN</label>
              <input value={vin} onChange={(e) => setVin(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Included with vehicle</p>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sets of keys</label>
                  <input type="number" min="0" value={keyCount} onChange={(e) => setKeyCount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Other</label>
                  <input value={otherIncludedItems} onChange={(e) => setOtherIncludedItems(e.target.value)}
                    placeholder="e.g. floor mats" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                <input type="checkbox" checked={hasWheelLock} onChange={(e) => setHasWheelLock(e.target.checked)} />
                Wheel lock included
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={hasChargingCables} onChange={(e) => setHasChargingCables(e.target.checked)} />
                Charging cables included (if applicable)
              </label>
            </div>
          </div>
          )}

          {!useSimplifiedForm && multiVehicleArrangement !== 'none' && (
            <div className="space-y-4 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900">Other Vehicle(s) In This Deal</p>

              {multiVehicleArrangement !== 'two_trades_one_purchase' && (
                <div className="space-y-2">
                  <label className="block text-xs text-gray-500">Second vehicle to deliver</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={secondVehicleYear} onChange={(e) => setSecondVehicleYear(e.target.value)} placeholder="Year" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    <input value={secondVehicleMake} onChange={(e) => setSecondVehicleMake(e.target.value)} placeholder="Make" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    <input value={secondVehicleModel} onChange={(e) => setSecondVehicleModel(e.target.value)} placeholder="Model" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <input value={secondVehicleStockNumber} onChange={(e) => setSecondVehicleStockNumber(e.target.value)} placeholder="Stock #" required className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  <input value={secondVehicleVin} onChange={(e) => setSecondVehicleVin(e.target.value)} placeholder="VIN" required className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
              )}

              {isTradeIn && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-xs text-gray-500">
                    {multiVehicleArrangement === 'two_purchases_one_trade'
                      ? 'Trade-in vehicle (both drivers ride back in this one together)'
                      : 'First trade-in vehicle (this driver takes it back)'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={tradeInYear} onChange={(e) => setTradeInYear(e.target.value)} placeholder="Year" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    <input value={tradeInMake} onChange={(e) => setTradeInMake(e.target.value)} placeholder="Make" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    <input value={tradeInModel} onChange={(e) => setTradeInModel(e.target.value)} placeholder="Model" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <input value={tradeInVin} onChange={(e) => setTradeInVin(e.target.value)} placeholder="VIN" required className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
              )}

              {(multiVehicleArrangement === 'two_trades_one_purchase' || multiVehicleArrangement === 'two_vehicles_two_trades') && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-xs text-gray-500">Second trade-in vehicle (2nd driver takes this one back)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={secondTradeInYear} onChange={(e) => setSecondTradeInYear(e.target.value)} placeholder="Year" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    <input value={secondTradeInMake} onChange={(e) => setSecondTradeInMake(e.target.value)} placeholder="Make" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                    <input value={secondTradeInModel} onChange={(e) => setSecondTradeInModel(e.target.value)} placeholder="Model" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <input value={secondTradeInVin} onChange={(e) => setSecondTradeInVin(e.target.value)} placeholder="VIN" required className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900">Customer / Recipient</p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Full name</label>
              <input value={customerFullName} onChange={(e) => setCustomerFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className={useSimplifiedForm ? '' : 'grid grid-cols-2 gap-3'}>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              {!useSimplifiedForm && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Address</label>
                  <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              )}
            </div>
            {!useSimplifiedForm && (
              <label className="flex items-center gap-2 text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5 mt-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={isFirstNationsDelivery}
                  onChange={(e) => {
                    setIsFirstNationsDelivery(e.target.checked)
                    if (e.target.checked) setShowReservePopup(true)
                  }}
                />
                Delivery is to a First Nations reserve
              </label>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Delivery Date & Time</label>
            <input
              type="datetime-local"
              value={deliveryDeadline}
              onChange={(e) => handleDeliveryDeadlineChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            {computingPickupTime && <p className="text-xs text-gray-400 mt-1">Calculating required pickup time…</p>}
            {pickupTimeError && <p className="text-xs text-red-600 mt-1">{pickupTimeError}</p>}
            {deliveryDeadline && !computingPickupTime && !pickupTimeError && scheduledFor && (() => {
              const utcIso = originTimeZone ? zonedLocalInputToUtcIso(scheduledFor, originTimeZone) : localInputToUtcIso(scheduledFor)
              if (!utcIso) return null
              const display = originTimeZone
                ? new Date(utcIso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: originTimeZone })
                : new Date(utcIso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
              const tzAbbr = originTimeZone ? zonedAbbreviation(utcIso, originTimeZone) : ''
              return (
                <p className="text-xs text-gray-500 mt-1">
                  Driver needs to leave by {display}{tzAbbr && ` ${tzAbbr}`} to make it on time.
                </p>
              )
            })()}
          </div>

          {!useSimplifiedForm && (<>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Insurance</label>
            <select
              value={useGarageInsurance ? 'drivflo' : 'dealer'}
              onChange={(e) => setUseGarageInsurance(e.target.value === 'drivflo')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="dealer">Dealer&apos;s own garage policy</option>
              <option value="drivflo">Buy insurance through Drivflo</option>
            </select>
            {useGarageInsurance && pricingSettings && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-gray-500">
                  {pricing ? (
                    <>
                      {formatCents(pricingSettings.drivflo_insurance_rate_per_day_cents)}/day
                      {pricing.insuranceDays > 1 && (
                        <> (day 1 full rate, {pricing.insuranceDays - 1} more day{pricing.insuranceDays - 1 === 1 ? '' : 's'} at {100 - pricingSettings.drivflo_insurance_multiday_discount_percent}%)</>
                      )}
                      {' — '}
                      {formatCents(pricing.garageInsuranceFeeCents - (includeTowDeductibleCoverage ? pricingSettings.drivflo_insurance_tow_deductible_fee_cents : 0))} for {pricing.insuranceDays} day{pricing.insuranceDays === 1 ? '' : 's'}
                    </>
                  ) : (
                    'Calculate distance & cost to see the price.'
                  )}
                </p>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={includeTowDeductibleCoverage} onChange={(e) => setIncludeTowDeductibleCoverage(e.target.checked)} />
                  Add tow assistance + deductible coverage (+{formatCents(pricingSettings.drivflo_insurance_tow_deductible_fee_cents)})
                </label>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Is the vehicle driven or towed?</label>
            <select
              value={vehicleMode}
              onChange={(e) => setVehicleMode(e.target.value as 'driven' | 'towed')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="driven">Driven</option>
              <option value="towed">Towed (trailer)</option>
            </select>
          </div>

          <div className="space-y-2 border border-gray-200 rounded-lg p-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isTradeIn} onChange={(e) => { setIsTradeIn(e.target.checked); if (e.target.checked) setAutoSelectReturnMethod(false) }} />
              This includes a trade-in pickup (same driver, same trip — no extra charge)
            </label>
            {isTradeIn && multiVehicleArrangement === 'none' && (
              <div className="pl-1 space-y-2">
                <label className="block text-xs text-gray-500">Trade-in vehicle</label>
                <div className="grid grid-cols-3 gap-2">
                  <input value={tradeInYear} onChange={(e) => setTradeInYear(e.target.value)} placeholder="Year" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  <input value={tradeInMake} onChange={(e) => setTradeInMake(e.target.value)} placeholder="Make" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  <input value={tradeInModel} onChange={(e) => setTradeInModel(e.target.value)} placeholder="Model" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <input value={tradeInVin} onChange={(e) => setTradeInVin(e.target.value)} placeholder="VIN" required className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <input type="checkbox" checked={autoSelectReturnMethod} onChange={(e) => setAutoSelectReturnMethod(e.target.checked)} />
              Auto-select cheapest return method (Uber, chase vehicle, flight, or bus)
            </label>
            {!autoSelectReturnMethod && !flyingBack && !(secondDriver && chaseVehicle) && (
              <label className="flex items-center gap-2 text-sm text-gray-700 ml-6">
                <input type="checkbox" checked={uberBackRequested} onChange={(e) => setUberBackRequested(e.target.checked)} />
                Uber back requested (leave unchecked if the booking dealer is picking the driver up themselves)
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={secondDriver}
                onChange={(e) => {
                  const checked = e.target.checked
                  setSecondDriver(checked)
                  if (checked) setChaseVehicle(true)
                  setAutoSelectReturnMethod(false)
                }}
              />
              Second driver required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={chaseVehicle} onChange={(e) => { setChaseVehicle(e.target.checked); setAutoSelectReturnMethod(false) }} />
              Chase vehicle required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={outOfProvinceInspection} onChange={(e) => setOutOfProvinceInspection(e.target.checked)} />
              Out-of-province inspection required
            </label>
            {outOfProvinceInspection && scheduledFor && [5, 6].includes(new Date(`${scheduledFor}:00Z`).getUTCDay()) && (
              <p className="text-xs text-amber-600 -mt-1 ml-6">
                ⚠️ This is scheduled for a {new Date(`${scheduledFor}:00Z`).getUTCDay() === 5 ? 'Friday' : 'Saturday'} — most registries and
                inspection shops are closed Sundays, so the inspection may not complete until Monday. An extra hotel night and
                flat fees may apply if so.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={registryVisit} onChange={(e) => setRegistryVisit(e.target.checked)} />
              Registry visit required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={insuranceVisit} onChange={(e) => setInsuranceVisit(e.target.checked)} />
              Insurance visit required (for insurance transfer)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={ferryRequired} onChange={(e) => setFerryRequired(e.target.checked)} />
              Force ferry crossing (if not detected automatically)
            </label>
            <p className="text-xs text-gray-400 -mt-1 ml-6">
              Ferries are detected and priced automatically based on the pickup/dropoff addresses — only check this if you know a ferry is needed and it wasn't picked up.
            </p>
            <div className="pt-2 border-t border-gray-100">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={flyingBack}
                  onChange={(e) => { setFlyingBack(e.target.checked); setAutoSelectReturnMethod(false) }}
                />
                One-way trip — driver flies back (no return drive)
              </label>
              <p className="text-xs text-gray-400 mt-1 ml-6">
                For long one-way runs with no trade-in or second driver to justify driving back.
                This removes the automatic return-drive charges (hours, fuel, wear &amp; tear) and
                lets you add the actual flight cost below instead.
              </p>
              {flyingBack && (
                <p className="ml-6 mt-2 text-xs text-gray-400">
                  Flight price and hours will be looked up and added automatically when you click "Calculate distance & cost" below.
                </p>
              )}
              {flyingBack && flightOptions.length > 1 && (
                <div className="ml-6 mt-3 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    {flightOptions.length} airport combinations compared — pick one (sorted cheapest first)
                  </p>
                  <div className="space-y-1.5">
                    {flightOptions.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedFlightOptionIdx(i)}
                        className={`w-full text-left border rounded-lg px-3 py-2 text-xs flex items-center justify-between ${
                          i === selectedFlightOptionIdx ? 'border-[#378ADD] bg-blue-50/60' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span>
                          <span className="font-medium text-gray-900">
                            {opt.origin.name} ({opt.origin.code}) → {opt.destination.name} ({opt.destination.code})
                          </span>
                          <span className="text-gray-400 ml-2">
                            {opt.flight.isDirect ? 'direct' : `${opt.flight.stops} stop${opt.flight.stops === 1 ? '' : 's'}`}
                          </span>
                        </span>
                        <span className="font-semibold text-gray-900">{formatCents(opt.effectiveCostCents)} total</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Total includes flight + ground transport both ends. {selectedFlightOptionIdx === 0 ? 'Currently using the cheapest option.' : ''}
                  </p>
                </div>
              )}
              <div className="ml-6 mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Override flight price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={flightPriceOverride}
                    onChange={(e) => setFlightPriceOverride(e.target.value)}
                    placeholder="e.g. 249.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Override flight hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={flightHoursOverride}
                    onChange={(e) => setFlightHoursOverride(e.target.value)}
                    placeholder="e.g. 4.7"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="ml-6 mt-1 text-xs text-gray-400">
                Fill both in to use your own flight price/time instead of the auto-search (e.g. when Duffel can&apos;t
                see a cheaper direct fare from a carrier it doesn&apos;t carry, like Flair). Leave blank to search automatically.
                Ground transport legs stay auto-calculated either way. Applies whenever the driver flies back, including
                the auto-selected long-haul comparison.
              </p>
            </div>
          </div>
          </>)}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Additional time & charges</label>
              <button type="button" onClick={addCharge} className="text-xs text-gray-600 hover:text-gray-900 underline">
                + Add
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Use this for flights, ferries, Ubers, or anything else that adds cost or time.
            </p>
            {additionalCharges
              .map((charge, i) => ({ charge, i }))
              .filter(({ charge }) => !charge.kind)
              .map(({ charge, i }) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    placeholder="Description (e.g. Flight home)"
                    value={charge.description}
                    onChange={(e) => updateCharge(i, { description: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={() => removeCharge(i)} className="text-xs text-gray-400 hover:text-red-600 px-2">
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cost to bill dealer ($)</label>
                    <input
                      type="number" step="0.01"
                      value={charge.dealerAmountCents / 100}
                      onChange={(e) => updateCharge(i, { dealerAmountCents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Hours to add</label>
                    <input
                      type="number" step="0.5"
                      value={charge.hoursAdded}
                      onChange={(e) => updateCharge(i, { hoursAdded: parseFloat(e.target.value || '0') })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={charge.paidToDriver} onChange={(e) => updateCharge(i, { paidToDriver: e.target.checked })} />
                  Pay this to the driver too (e.g. reimbursed fare)
                </label>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          <button
            type="button"
            onClick={runCalculation}
            disabled={calculating}
            className="w-full border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {calculating ? 'Calculating...' : 'Calculate distance & cost'}
          </button>
          {ferryDebugNote && <p className="text-xs text-gray-400">{ferryDebugNote}</p>}
          {decisionNote && <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">{decisionNote}</p>}
          {calcError && <p className="text-sm text-red-600">{calcError}</p>}

          {pricing && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-2 bg-gray-50">
              {isAdmin && (
                <>
                  <p className="text-xs text-gray-500">
                    {pricing.tripDistanceKm} km {pricing.oneWayFlightBack ? 'one-way' : 'round trip'}
                    {durationMinutes ? ` · ${Math.round(pricing.baseDrivingHours * 10) / 10} hrs driving` : ''}
                    {pricing.dealerBilledHours !== pricing.baseDrivingHours && (
                      <> · <span className="font-medium">{Math.round(pricing.dealerBilledHours * 10) / 10} hrs total billed</span></>
                    )}
                    {pricing.overnightRequired && <span className="text-amber-600"> · Overnight stay required</span>}
                  </p>

                  <div className="space-y-1 pt-2 border-t border-gray-200">
                    <BreakdownRow label="Driving pay (dealer billed hours)" cents={pricing.hourlyDealerCents} />
                    <BreakdownRow label="Fuel" cents={pricing.gasCostCents} />
                    <BreakdownRow label="Meals" cents={pricing.mealCostCents} />
                    <BreakdownRow label="Wear & tear" cents={pricing.wearAndTearCents} />
                    <BreakdownRow label="Trailer fee" cents={pricing.trailerFeeCents} />
                    <BreakdownRow label="Hotel" cents={pricing.hotelCents} />
                    <BreakdownRow label="Overnight fee" cents={pricing.overnightFeeCents} />
                    <BreakdownRow label="Out-of-province inspection" cents={pricing.inspectionFeeCents} />
                    <BreakdownRow label="Registry visit" cents={pricing.registryFeeCents} />
                    <BreakdownRow label="Drivflo insurance" cents={pricing.garageInsuranceFeeCents} />
                    <BreakdownRow label="Ferry" cents={additionalCharges.find((c) => c.kind === 'ferry')?.dealerAmountCents ?? 0} />
                    <BreakdownRow label="Bus" cents={additionalCharges.find((c) => c.kind === 'bus')?.dealerAmountCents ?? 0} />
                    <BreakdownRow label="Flight" cents={additionalCharges.find((c) => c.kind === 'flight')?.dealerAmountCents ?? 0} />
                    <BreakdownRow label="Ground transport to airport" cents={additionalCharges.find((c) => c.kind === 'ground-to-airport')?.dealerAmountCents ?? 0} />
                    <BreakdownRow label="Ground transport home" cents={additionalCharges.find((c) => c.kind === 'ground-home')?.dealerAmountCents ?? 0} />
                    <BreakdownRow
                      label="Other additional charges"
                      cents={additionalCharges.filter((c) => !c.kind).reduce((sum, c) => sum + c.dealerAmountCents, 0)}
                    />
                  </div>

                  <div className="space-y-1 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Driver payout (what the driver actually receives)</p>
                    <BreakdownRow label="Driving pay (driver hours)" cents={pricing.hourlyDriverCents} />
                    <BreakdownRow label="Meals" cents={pricing.mealCostCents} />
                    <BreakdownRow label="Wear & tear" cents={pricing.wearAndTearCents} />
                    <BreakdownRow label="Overnight fee" cents={pricing.overnightFeeCents} />
                    <p className="text-[11px] text-gray-400">
                      Note: driver hours don&apos;t include inspection/registry wait time (billed to dealer only) — flight ticket cost is dealer-paid, not part of driver pay.
                      {secondDriver && ' This breakdown is the combined total for both drivers — each driver’s own job post shows their individual full pay separately, not half of this.'}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-xs font-medium text-gray-700">
                      <span>{secondDriver ? 'Total driver pay (both drivers combined)' : 'Total driver pay'}</span>
                      <span>{formatCents(pricing.estimatedDriverPayCents)}</span>
                    </div>
                    {pricing.reimbursementCents > 0 && (
                      <>
                        <div className="flex items-center justify-between pt-1 text-xs text-gray-600">
                          <span>+ Reimbursements (Uber/bus, etc. — separate from pay)</span>
                          <span>{formatCents(pricing.reimbursementCents)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-medium text-gray-900">
                          <span>Total driver receives</span>
                          <span>{formatCents(pricing.estimatedDriverPayCents + pricing.reimbursementCents)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-xs text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatCents(pricing.costBasisCents)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Markup{pricingSettings ? ` (${pricingSettings.dealer_markup_percent}%)` : ''}</span>
                    <span>{formatCents(pricing.estimatedDealerCostCents - pricing.costBasisCents)}</span>
                  </div>
                </>
              )}

              {!isAdmin && (
                <p className="text-xs text-gray-500">
                  ≈ {Math.round(pricing.dealerBilledHours * 10) / 10} hrs total
                </p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-700">Estimated dealer cost</span>
                <span className="text-base font-semibold text-gray-900">{formatCents(pricing.estimatedDealerCostCents)}</span>
              </div>
              <p className="text-xs text-gray-400 pt-1">
                Estimated price. Additional charges may apply for wait time, repairs, tolls, parking, storage, additional mileage, or other job-related expenses. Final pricing may vary.
              </p>
              {flyingBack && distanceKm != null && durationMinutes != null && pricingSettings && (
                <NearbyDatesFlightCheck
                  scheduledFor={scheduledFor}
                  distanceKm={distanceKm}
                  durationMinutes={durationMinutes}
                  vehicleMode={vehicleMode}
                  numDrivers={secondDriver ? 2 : 1}
                  pricingSettings={pricingSettings}
                  originAddress={stops.map((s) => s.trim()).filter(Boolean)[0] ?? ''}
                  destinationAddress={stops.map((s) => s.trim()).filter(Boolean).slice(-1)[0] ?? ''}
                  outOfProvinceInspection={outOfProvinceInspection}
                  registryVisit={registryVisit}
                  insuranceVisit={insuranceVisit}
                  ferryRequired={ferryRequired}
                  manualCharges={additionalCharges.filter((c) => !c.kind)}
                  onSelectDate={(d) => {
                    setScheduledFor(d)
                    setCalcError('Date updated — click "Calculate distance & cost" again to refresh the quote for this new date.')
                  }}
                />
              )}
            </div>
          )}

          {pricing && isAdmin && distanceKm != null && durationMinutes != null && pricingSettings && (
            <ReturnOptionsComparison
              distanceKm={distanceKm}
              durationMinutes={durationMinutes}
              vehicleMode={vehicleMode}
              outOfProvinceInspection={outOfProvinceInspection}
              registryVisit={registryVisit}
              insuranceVisit={insuranceVisit}
                  ferryRequired={ferryRequired}
              pricingSettings={pricingSettings}
              originAddress={stops.map((s) => s.trim()).filter(Boolean)[0] ?? ''}
              destinationAddress={stops.map((s) => s.trim()).filter(Boolean).slice(-1)[0] ?? ''}
              scheduledFor={scheduledFor}
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-[#378ADD] text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
            >
              {loading ? 'Posting...' : 'Post job'}
            </button>
            <button type="button" onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 px-3 py-2.5">
              Cancel
            </button>
          </div>
        </form>
      </main>
      {showReservePopup && (
        <FirstNationsReservePopup
          dropoffAddress={stops[stops.length - 1] ?? ''}
          onConfirm={(reserveAddress) => {
            // Route becomes: original stops ... -> original dropoff address (to
            // pick the customer up there) -> the reserve (final delivery),
            // since the customer needs to be brought along to receive the
            // vehicle there. Uses the actual dropoff stop that was already
            // filled in, not the separate (often blank) customer contact field.
            setStops((prev) => {
              const originalDropoff = prev[prev.length - 1]
              const withoutLast = prev.slice(0, -1)
              return [...withoutLast, originalDropoff, reserveAddress]
            })
            setShowReservePopup(false)
          }}
          onSkip={() => setShowReservePopup(false)}
          onClose={() => setShowReservePopup(false)}
        />
      )}
    </div>
  )
}

function BreakdownRow({ label, cents }: { label: string; cents: number }) {
  if (!cents) return null
  return (
    <div className="flex items-center justify-between text-xs text-gray-600">
      <span>{label}</span>
      <span>{formatCents(cents)}</span>
    </div>
  )
}
