'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculatePricing, formatCents, type PricingSettings, type AdditionalCharge, type PricingResult } from '@/lib/pricing'
import Logo from '@/components/Logo'
import ReturnOptionsComparison from '@/components/ReturnOptionsComparison'
import NearbyDatesFlightCheck from '@/components/NearbyDatesFlightCheck'
import { localInputToUtcIso, toLocalDatetimeInputValue, toLocalDateString, zonedLocalInputToUtcIso, utcIsoToZonedInputValue, zonedAbbreviation } from '@/lib/localDatetime'

type JobType = { id: string; name: string }

export default function EditJobPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string

  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [jobTypeId, setJobTypeId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const [stops, setStops] = useState<string[]>(['', ''])

  const [vehicleYear, setVehicleYear] = useState('')
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

  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
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
  const [isFirstNationsDelivery, setIsFirstNationsDelivery] = useState(false)
  const [flyingBack, setFlyingBack] = useState(false)
  const [vehicleMode, setVehicleMode] = useState<'driven' | 'towed'>('driven')
  const [outOfProvinceInspection, setOutOfProvinceInspection] = useState(false)
  const [registryVisit, setRegistryVisit] = useState(false)
  const [ferryRequired, setFerryRequired] = useState(false)
  const [useGarageInsurance, setUseGarageInsurance] = useState(false)
  const [includeTowDeductibleCoverage, setIncludeTowDeductibleCoverage] = useState(false)
  const [flightPriceOverride, setFlightPriceOverride] = useState('')
  const [flightHoursOverride, setFlightHoursOverride] = useState('')
  // True whenever the driver does NOT drive the vehicle back themselves — covers
  // both flying back AND the short-trip Uber/walk-on-return case. Gas and driver
  // hours should only be charged one-way in either case; flyingBack alone used to
  // gate this, which silently billed a full round trip's worth of gas/hours even
  // when the driver only drove one-way and took an Uber back.
  const [effectiveOneWayReturn, setEffectiveOneWayReturn] = useState(false)
  const [multiVehicleArrangement, setMultiVehicleArrangement] = useState<'none' | 'two_trades_one_purchase' | 'two_purchases_one_trade' | 'two_vehicles_two_trades'>('none')
  const [linkedJobId, setLinkedJobId] = useState<string | null>(null)
  const [linkedJobQuery, setLinkedJobQuery] = useState('')
  const [linkedJobResults, setLinkedJobResults] = useState<{ id: string; stock_number: string | null; vehicle_year: number | null; vehicle_make: string | null; vehicle_model: string | null }[]>([])
  const [linkedJobSearching, setLinkedJobSearching] = useState(false)
  const [ridesAlongWithLinked, setRidesAlongWithLinked] = useState(false)
  const [companionJobId, setCompanionJobId] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
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
  const [pageLoading, setPageLoading] = useState(true)
  const [notEditable, setNotEditable] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.from('job_types').select('id, name').eq('active', true).then(({ data }) => {
      setJobTypes(data ?? [])
    })

    supabase.from('pricing_settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setPricingSettings(data)
    })

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'platform_admin') setIsAdmin(true)

      const { data: job } = await supabase
        .from('jobs')
        .select('*, job_stops(address, stop_order)')
        .eq('id', jobId)
        .single()

      if (!job) {
        setError('Job not found.')
        setPageLoading(false)
        return
      }
      if (job.status !== 'awaiting_driver') {
        setNotEditable(true)
        setPageLoading(false)
        return
      }

      setJobTypeId(job.job_type_id ?? '')

      const stopRows = (job.job_stops ?? []).slice().sort((a: { stop_order: number }, b: { stop_order: number }) => a.stop_order - b.stop_order)
      setStops(stopRows.length >= 2 ? stopRows.map((s: { address: string }) => s.address) : [job.pickup_address, job.dropoff_address])

      setVehicleYear(job.vehicle_year?.toString() ?? '')
      setVehicleMake(job.vehicle_make ?? '')
      setVehicleModel(job.vehicle_model ?? '')
      setStockNumber(job.stock_number ?? '')
      setVin(job.vin ?? '')
      setMileage(job.mileage?.toString() ?? '')
      setKeyCount(job.key_count?.toString() ?? '')
      setHasWheelLock(job.has_wheel_lock ?? false)
      setHasChargingCables(job.has_charging_cables ?? false)
      setOtherIncludedItems(job.other_included_items ?? '')
      setCustomerFullName(job.customer_full_name ?? '')
      setCustomerPhone(job.customer_phone ?? '')
      setCustomerAddress(job.customer_address ?? '')
      setRecipientName(job.recipient_name ?? '')
      setRecipientPhone(job.recipient_phone ?? '')
      setScheduledFor(job.scheduled_for ? job.scheduled_for.slice(0, 16) : '')
      setDeliveryDeadline(job.delivery_deadline ? job.delivery_deadline.slice(0, 16) : '')
      setSecondDriver(job.second_driver_required ?? false)
      setChaseVehicle(job.chase_vehicle_required ?? false)
      setIsTradeIn(job.is_trade_in_pickup ?? false)
      setTradeInYear(job.trade_in_year ? String(job.trade_in_year) : '')
      setTradeInMake(job.trade_in_make ?? '')
      setTradeInModel(job.trade_in_model ?? '')
      setTradeInVin(job.trade_in_vin ?? '')
      setIsFirstNationsDelivery(job.is_first_nations_delivery ?? false)
      setFlyingBack(job.one_way_flight_back ?? false)
      setVehicleMode(job.vehicle_mode ?? 'driven')
      setOutOfProvinceInspection(job.out_of_province_inspection ?? false)
      setRegistryVisit(job.registry_visit ?? false)
      setFerryRequired(job.ferry_required ?? false)
      setUseGarageInsurance(job.use_garage_insurance ?? false)
      setIncludeTowDeductibleCoverage(job.include_tow_deductible_coverage ?? false)
      setMultiVehicleArrangement(job.multi_vehicle_arrangement ?? 'none')
      setLinkedJobId(job.linked_job_id ?? null)
      setRidesAlongWithLinked(job.rides_along_with_linked ?? false)
      setCompanionJobId(job.companion_job_id ?? null)
      setOrganizationId(job.organization_id ?? null)
      setAdditionalCharges(job.additional_charges ?? [])
      setNotes(job.notes ?? '')

      setPageLoading(false)
    })
  }, [jobId, router])

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
      .neq('id', jobId)
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

      // The delivery time entered means wall-clock time AT THE DESTINATION —
      // 5pm for an Edmonton drop-off is 5pm Edmonton time, not the browser's zone.
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
    const isCourierJob = jobTypes.find((jt) => jt.id === jobTypeId)?.name === 'Courier / Package'
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
        if (!hasOverride && (!flightRes.ok || !flightBody.flight)) return null

        const result: AdditionalCharge[] = [
          {
            description: 'Return ground transport',
            kind: 'ground-home' as const,
            dealerAmountCents: pricingSettings!.return_ground_transport_fee_cents,
            hoursAdded: pricingSettings!.return_ground_transport_hours,
            paidToDriver: true,
          },
        ]
        if (flightBody.groundToAirport) {
          const km = flightBody.groundToAirport.distanceKm
          result.push({
            description: 'Ground transport to airport',
            kind: 'ground-to-airport' as const,
            dealerAmountCents: Math.max(Math.round(pricingSettings!.uber_base_fare_cents + km * pricingSettings!.uber_per_km_cents), pricingSettings!.uber_minimum_fare_cents),
            hoursAdded: Math.round((flightBody.groundToAirport.durationMinutes / 60) * 100) / 100,
            paidToDriver: true,
          })
        }
        if (hasOverride) {
          result.push({
            description: `Flight back (manual override)${flightBody.origin && flightBody.destination ? `: ${flightBody.origin.code} → ${flightBody.destination.code}` : ''}`,
            kind: 'flight' as const,
            dealerAmountCents: Math.round(parseFloat(flightPriceOverride) * 100),
            hoursAdded: parseFloat(flightHoursOverride),
            paidToDriver: false,
          })
        } else {
          result.push({
            description: `Flight back: ${flightBody.origin.code} → ${flightBody.destination.code} (${flightBody.flight.isDirect ? 'direct' : `${flightBody.flight.stops} stop${flightBody.flight.stops === 1 ? '' : 's'}`})`,
            kind: 'flight' as const,
            dealerAmountCents: flightBody.flight.priceCents,
            hoursAdded: flightBody.flight.hoursToAdd,
            paidToDriver: false,
          })
        }
        return result
      }

      function buildBusCharges(): AdditionalCharge[] {
        const km = data.distanceKm
        const AVG_BUS_SPEED_KMH = 65
        return [
          {
            description: 'Bus back (estimate)',
            kind: 'bus' as const,
            dealerAmountCents: Math.round(pricingSettings!.bus_base_fare_cents + km * pricingSettings!.bus_per_km_cents),
            hoursAdded: Math.round((km / AVG_BUS_SPEED_KMH) * 100) / 100,
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
      // pairing) that never actually applies to a multi-vehicle deal.
      const forcedRoundTrip = isTradeIn || (chaseVehicle && secondDriver) || multiVehicleArrangement !== 'none'
      const longHaul = oneWayHours > 4

      let finalCharges: AdditionalCharge[] = manualCharges

      if (forcedRoundTrip) {
        setEffectiveOneWayReturn(false)
        const fc = ferryCharge('roundtrip-vehicle')
        finalCharges = fc ? [...manualCharges, fc] : manualCharges
        if (isTradeIn) setDecisionNote('Trade-in pickup means the driver needs the vehicle both ways — treated as a round trip.')
        else setDecisionNote(`2nd driver (${secondDriver}) + chase vehicle (${chaseVehicle}) means a round trip — flying back was turned off.`)
      } else if (longHaul) {
        // Compare all three ways to get the driver home, pick the cheapest.
        const [flyCharges, busCharges] = await Promise.all([buildFlyCharges(), Promise.resolve(buildBusCharges())])

        const options: { label: string; flying: boolean; secondDrv: boolean; chase: boolean; charges: AdditionalCharge[]; cost: number }[] = []

        if (flyCharges) {
          const fc = ferryCharge('oneway-vehicle')
          const charges = fc ? [...manualCharges, ...flyCharges, fc] : [...manualCharges, ...flyCharges]
          const r = calculatePricing(
            { distanceKm: data.distanceKm, durationMinutes: data.durationMinutes, vehicleMode, numDrivers: 1, outOfProvinceInspection, registryVisit, ferryRequired: false, useGarageInsurance, includeTowDeductibleCoverage, additionalCharges: charges, oneWayFlightBack: true },
            pricingSettings
          )
          options.push({ label: 'Flight', flying: true, secondDrv: false, chase: false, charges, cost: r.estimatedDealerCostCents })
        }

        {
          const fc = ferryCharge('oneway-vehicle')
          const charges = fc ? [...manualCharges, ...busCharges, fc] : [...manualCharges, ...busCharges]
          const r = calculatePricing(
            { distanceKm: data.distanceKm, durationMinutes: data.durationMinutes, vehicleMode, numDrivers: 1, outOfProvinceInspection, registryVisit, ferryRequired: false, useGarageInsurance, includeTowDeductibleCoverage, additionalCharges: charges, oneWayFlightBack: true },
            pricingSettings
          )
          options.push({ label: 'Bus', flying: true, secondDrv: false, chase: false, charges, cost: r.estimatedDealerCostCents })
        }

        if (!isCourierJob) {
          const fc = ferryCharge('roundtrip-vehicle')
          const charges = fc ? [...manualCharges, fc] : manualCharges
          const r = calculatePricing(
            { distanceKm: data.distanceKm, durationMinutes: data.durationMinutes, vehicleMode, numDrivers: 2, outOfProvinceInspection, registryVisit, ferryRequired: false, useGarageInsurance, includeTowDeductibleCoverage, additionalCharges: charges, oneWayFlightBack: false },
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
          `Long haul (${Math.round(oneWayHours * 10) / 10}hrs one-way) — auto-selected ${winner.label} ($${(winner.cost / 100).toFixed(2)}), cheapest of: ` +
          options.map((o) => `${o.label} $${(o.cost / 100).toFixed(2)}`).join(', ') +
          '.' + flightStopsNote
        )
      } else {
        // Short trip, nothing forcing a round trip — respect the manual checkboxes as-is.
        if (flyingBack) {
          setEffectiveOneWayReturn(true)
          const flyCharges = await buildFlyCharges()
          if (flyCharges) {
            const fc = ferryCharge('oneway-vehicle')
            finalCharges = fc ? [...manualCharges, ...flyCharges, fc] : [...manualCharges, ...flyCharges]
            setDecisionNote('Short trip, flying back (manually selected).')
          } else {
            setCalcError('Could not find a flight price — add one manually below if needed.')
            const fc = ferryCharge('oneway-vehicle')
            finalCharges = fc ? [...manualCharges, fc] : manualCharges
          }
        } else {
          // No trade-in, no chase+2nd driver, not flying — the vehicle only goes one way,
          // so the driver always needs some way back to the dealership. That's an Uber-style
          // ground transport charge regardless of route — if a ferry's ALSO involved, the
          // driver returns as a walk-on passenger (much cheaper than a second vehicle fare)
          // on top of that same ride home. Since the driver isn't actually driving back
          // themselves, gas/hours need to be billed one-way too, not as a full round trip.
          setEffectiveOneWayReturn(true)
          const fc = ferryCharge('oneway-walkon-return')
          const groundHomeCharge = ferryReturnGroundTransport()
          finalCharges = [...manualCharges, groundHomeCharge, ...(fc ? [fc] : [])]
          setDecisionNote(
            fc
              ? `Short trip, one-way delivery — ferry return is walk-on passenger + Uber home (not a 2nd vehicle fare). Ground transport home: $${(groundHomeCharge.dealerAmountCents / 100).toFixed(2)} (${ferryInfo?.groundHome ? `calculated, ${ferryInfo.groundHome.distanceKm}km` : 'flat estimate'}).`
              : `Short trip, one-way delivery — no ferry on this route. Ground transport home: $${(groundHomeCharge.dealerAmountCents / 100).toFixed(2)} (flat estimate).`
          )
        }
      }

      // Always update the saved charges — this is what clears stale flight/ferry/ground
      // transport entries and what the sync effect below uses for every later recompute.
      setAdditionalCharges(finalCharges)
    } catch {
      setCalcError('Something went wrong reaching the mapping service.')
    }
    setCalculating(false)
  }, [stops, vehicleMode, secondDriver, chaseVehicle, isTradeIn, outOfProvinceInspection, registryVisit, ferryRequired, additionalCharges, flyingBack, pricingSettings, scheduledFor, flightPriceOverride, flightHoursOverride, originTimeZone, destinationTimeZone])

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

    const outboundVehicleCount =
      multiVehicleArrangement === 'two_purchases_one_trade' || multiVehicleArrangement === 'two_vehicles_two_trades'
        ? 2
        : multiVehicleArrangement === 'two_trades_one_purchase'
          ? 1
          : undefined
    const returnVehicleCount =
      multiVehicleArrangement === 'two_trades_one_purchase' || multiVehicleArrangement === 'two_vehicles_two_trades'
        ? 2
        : multiVehicleArrangement === 'two_purchases_one_trade'
          ? 1
          : undefined

    const result = calculatePricing(
      {
        distanceKm,
        durationMinutes,
        vehicleMode,
        numDrivers: secondDriver ? 2 : 1,
        outOfProvinceInspection,
        registryVisit,
        ferryRequired: false,
        useGarageInsurance,
        includeTowDeductibleCoverage,
        additionalCharges,
        oneWayFlightBack: effectiveOneWayReturn,
        outboundVehicleCount,
        returnVehicleCount,
      },
      pricingSettings
    )
    setPricing(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [additionalCharges, vehicleMode, secondDriver, outOfProvinceInspection, registryVisit, ferryRequired, ferryLiveDataUsed, useGarageInsurance, includeTowDeductibleCoverage, multiVehicleArrangement, ridesAlongWithLinked, flyingBack, effectiveOneWayReturn, distanceKm, durationMinutes])

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
              ferryRequired: false,
              useGarageInsurance: false,
          includeTowDeductibleCoverage: false,
              additionalCharges: additionalCharges.filter((c) => !c.kind),
              oneWayFlightBack: effectiveOneWayReturn,
            },
            pricingSettings
          )
        : pricing

    const { error: jobError } = await supabase.from('jobs').update({
      job_type_id: jobTypeId,
      pickup_address: filledStops[0],
      dropoff_address: filledStops[filledStops.length - 1],
      recipient_name: recipientName || null,
      recipient_phone: recipientPhone || null,
      vehicle_year: vehicleYear ? parseInt(vehicleYear) : null,
      vehicle_make: vehicleMake || null,
      vehicle_model: vehicleModel || null,
      stock_number: stockNumber || null,
      vin: vin || null,
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
      vehicle_mode: vehicleMode,
      out_of_province_inspection: outOfProvinceInspection,
      registry_visit: registryVisit,
      ferry_required: ferryRequired,
      use_garage_insurance: useGarageInsurance,
      include_tow_deductible_coverage: includeTowDeductibleCoverage,
      linked_job_id: linkedJobId,
      multi_vehicle_arrangement: multiVehicleArrangement,
      rides_along_with_linked: ridesAlongWithLinked,
      additional_charges: additionalCharges,
      overnight_required: pricing?.overnightRequired ?? false,
      estimated_distance_km: pricing?.tripDistanceKm ?? null,
      estimated_duration_minutes: durationMinutes,
      estimated_dealer_cost_cents: pricing?.estimatedDealerCostCents ?? null,
      estimated_driver_pay_cents: primaryDriverPricing?.estimatedDriverPayCents ?? null,
      estimated_driver_reimbursement_cents: primaryDriverPricing?.reimbursementCents ?? null,
      trade_in_year: isTradeIn && tradeInYear ? parseInt(tradeInYear) : null,
      trade_in_make: isTradeIn ? tradeInMake || null : null,
      trade_in_model: isTradeIn ? tradeInModel || null : null,
      trade_in_vin: isTradeIn ? tradeInVin || null : null,
      notes: notes || null,
    }).eq('id', jobId)

    if (jobError) {
      setError(jobError.message)
      setLoading(false)
      return
    }

    // Replace the stop rows with the current set
    await supabase.from('job_stops').delete().eq('job_id', jobId)
    const stopRows = filledStops.map((address, i) => ({
      job_id: jobId,
      stop_order: i,
      address,
      stop_type: i === 0 ? 'pickup' : i === filledStops.length - 1 ? 'dropoff' : 'waypoint',
    }))
    await supabase.from('job_stops').insert(stopRows)

    // Linking is bidirectional — make sure the linked job points back at this one.
    if (linkedJobId) {
      await supabase.from('jobs').update({ linked_job_id: jobId }).eq('id', linkedJobId)
    }

    // Second driver required and no companion job yet — create a fully
    // independent companion job post (its own full pay, not a split) so a
    // different driver can claim it separately. Guarded by companionJobId so
    // saving the same edit twice doesn't create duplicates.
    if (secondDriver && !companionJobId && organizationId && pricingSettings && distanceKm != null && durationMinutes != null) {
      const { data: { user } } = await supabase.auth.getUser()
      const soloPricing = calculatePricing(
        {
          distanceKm,
          durationMinutes,
          vehicleMode,
          numDrivers: 1,
          outOfProvinceInspection,
          registryVisit,
          ferryRequired: false,
          useGarageInsurance: false,
          includeTowDeductibleCoverage: false,
          additionalCharges: additionalCharges.filter((c) => !c.kind),
          oneWayFlightBack: effectiveOneWayReturn,
        },
        pricingSettings
      )

      const { data: companionJob, error: companionError } = await supabase.from('jobs').insert({
        organization_id: organizationId,
        job_type_id: jobTypeId,
        created_by: user?.id,
        pickup_address: filledStops[0],
        dropoff_address: filledStops[filledStops.length - 1],
        recipient_name: recipientName || null,
        recipient_phone: recipientPhone || null,
        vehicle_year: secondVehicleYear ? parseInt(secondVehicleYear) : null,
        vehicle_make: secondVehicleMake || null,
        vehicle_model: secondVehicleModel || null,
        stock_number: secondVehicleStockNumber || null,
        vin: secondVehicleVin || null,
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
        is_trade_in_pickup: isTradeIn,
        is_first_nations_delivery: isFirstNationsDelivery,
        one_way_flight_back: flyingBack,
        vehicle_mode: vehicleMode,
        used_own_vehicle: true,
        out_of_province_inspection: outOfProvinceInspection,
        registry_visit: registryVisit,
        ferry_required: ferryRequired,
        use_garage_insurance: false,
        is_second_driver_job: true,
        companion_job_id: jobId,
        trade_in_year: secondTradeInYear ? parseInt(secondTradeInYear) : null,
        trade_in_make: secondTradeInMake || null,
        trade_in_model: secondTradeInModel || null,
        trade_in_vin: secondTradeInVin || null,
        overnight_required: soloPricing.overnightRequired,
        estimated_distance_km: soloPricing.tripDistanceKm,
        estimated_duration_minutes: durationMinutes,
        estimated_dealer_cost_cents: null,
        estimated_driver_pay_cents: soloPricing.estimatedDriverPayCents,
        estimated_driver_reimbursement_cents: soloPricing.reimbursementCents,
        notes: notes ? `${notes}\n\n(Chase/2nd driver for the linked primary job)` : '(Chase/2nd driver for the linked primary job)',
      }).select('id').single()

      if (companionError) {
        setError(`Job saved, but creating the 2nd driver's job failed: ${companionError.message}. Contact support if this keeps happening.`)
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
          setError(`Job saved, but saving the 2nd driver's job's addresses failed: ${companionStopsError.message}.`)
          setLoading(false)
          return
        }
        await supabase.from('jobs').update({ companion_job_id: companionJob.id }).eq('id', jobId)
      }
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (pageLoading) return null

  if (notEditable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">This job can no longer be edited</h1>
          <p className="text-sm text-gray-500 mb-6">
            Once a driver has been assigned, the job details are locked. You can still cancel it from the dashboard if needed.
          </p>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-600 hover:text-gray-900 underline">
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Logo height={20} />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Edit job</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
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
                    // their own separate vehicle and job post.
                    setSecondDriver(true)
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
                  selected below.{' '}
                  {companionJobId
                    ? 'This job already has a companion job for the second driver.'
                    : 'A fully independent job post for them will be created automatically when you save, so a second driver can claim it separately.'}
                </p>
              )}
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

          {multiVehicleArrangement !== 'none' && (
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
            <p className="text-sm font-medium text-gray-900">Customer</p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Full name</label>
              <input value={customerFullName} onChange={(e) => setCustomerFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Address</label>
                <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Recipient name</label>
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Recipient phone</label>
              <input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Scheduled for (pickup time)</label>
            <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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
              <input type="checkbox" checked={isTradeIn} onChange={(e) => setIsTradeIn(e.target.checked)} />
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
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={secondDriver}
                onChange={(e) => {
                  const checked = e.target.checked
                  setSecondDriver(checked)
                  if (checked) setChaseVehicle(true)
                }}
              />
              Second driver required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={chaseVehicle} onChange={(e) => setChaseVehicle(e.target.checked)} />
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
              <input type="checkbox" checked={isFirstNationsDelivery} onChange={(e) => setIsFirstNationsDelivery(e.target.checked)} />
              Delivery is to a First Nations reserve
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
                <input type="checkbox" checked={flyingBack} onChange={(e) => setFlyingBack(e.target.checked)} />
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
            {calculating ? 'Calculating...' : 'Recalculate distance & cost'}
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
                      {secondDriver && ' This breakdown is the combined total for both drivers — each driver\u2019s own job post shows their individual full pay separately, not half of this.'}
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
                Final actual charges may vary slightly. Additional charges may apply for anything not listed above.
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
              {loading ? 'Saving...' : 'Save changes'}
            </button>
            <button type="button" onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 px-3 py-2.5">
              Cancel
            </button>
          </div>
        </form>
      </main>
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
