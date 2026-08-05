'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculatePricing, formatCents, type PricingSettings, type AdditionalCharge, type PricingResult } from '@/lib/pricing'
import Logo from '@/components/Logo'
import ReturnOptionsComparison from '@/components/ReturnOptionsComparison'
import NearbyDatesFlightCheck from '@/components/NearbyDatesFlightCheck'
import { localInputToUtcIso, toLocalDatetimeInputValue, toLocalDateString } from '@/lib/localDatetime'

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
  const [computingPickupTime, setComputingPickupTime] = useState(false)
  const [pickupTimeError, setPickupTimeError] = useState('')
  const [ferryLiveDataUsed, setFerryLiveDataUsed] = useState(false)
  const [decisionNote, setDecisionNote] = useState('')
  const [ferryDebugNote, setFerryDebugNote] = useState('')
  const [secondDriver, setSecondDriver] = useState(false)
  const [chaseVehicle, setChaseVehicle] = useState(false)
  const [isTradeIn, setIsTradeIn] = useState(false)
  const [isFirstNationsDelivery, setIsFirstNationsDelivery] = useState(false)
  const [flyingBack, setFlyingBack] = useState(false)
  const [vehicleMode, setVehicleMode] = useState<'driven' | 'towed'>('driven')
  // Drivers always use their own vehicle — no toggle needed, wear & tear always applies.
  const [outOfProvinceInspection, setOutOfProvinceInspection] = useState(false)
  const [registryVisit, setRegistryVisit] = useState(false)
  const [ferryRequired, setFerryRequired] = useState(false)
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
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'platform_admin') {
        setIsAdmin(true)
        const { data: orgs } = await supabase.from('organizations').select('id, name').order('name')
        setOrganizations(orgs ?? [])
        if (orgs?.[0]) setSelectedOrgId(orgs[0].id)
      }
    })
  }, [])

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

      const driveHours = data.durationMinutes / 60
      const mealBreaks = Math.min(
        Math.floor(driveHours / pricingSettings.meal_allowance_every_hours),
        pricingSettings.meal_allowance_max_count
      )
      const breakHours = (mealBreaks * pricingSettings.break_duration_minutes) / 60
      const totalHoursNeeded = driveHours + breakHours

      // Safe to do this arithmetic directly — both value and "now" are being
      // interpreted in the same (local) context here on the client.
      const pickupDate = new Date(value)
      pickupDate.setTime(pickupDate.getTime() - totalHoursNeeded * 60 * 60 * 1000)
      setScheduledFor(toLocalDatetimeInputValue(pickupDate))
    } catch {
      setPickupTimeError('Something went wrong calculating the pickup time.')
    }
    setComputingPickupTime(false)
  }

  const runCalculation = useCallback(async () => {
    setCalcError('')
    setDecisionNote('')
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
        body: JSON.stringify({ addresses: filledStops, departureTime: localInputToUtcIso(scheduledFor) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCalcError(data.error || 'Could not calculate distance.')
        setCalculating(false)
        return
      }

      setDistanceKm(data.distanceKm)
      setDurationMinutes(data.durationMinutes)

      const oneWayHours = data.durationMinutes / 60
      const inspectionHours = outOfProvinceInspection ? pricingSettings.out_of_province_inspection_min_hours : 0
      const registryHours = registryVisit ? pricingSettings.registry_visit_min_hours : 0

      // --- Ferry: look this up once regardless of round-trip/one-way, since the
      // terminal match itself doesn't depend on that — only the crossing count does.
      let ferryInfo: { fromTerminal: { name: string }; toTerminal: { name: string }; sailingDurationMinutes: number; avgGapMinutes: number; sailingsPerDay: number; groundHome: { distanceKm: number; durationMinutes: number } | null } | null = null
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
      // back to the dealer/home. Uses the real driven distance from the ferry API
      // when available (same Uber base+per-km formula as the airport leg), falling
      // back to the flat admin estimate otherwise.
      function ferryReturnGroundTransport(): AdditionalCharge {
        if (ferryInfo?.groundHome) {
          const km = ferryInfo.groundHome.distanceKm
          return {
            description: `Return ground transport (${km}km from terminal)`,
            kind: 'ground-home' as const,
            dealerAmountCents: Math.max(Math.round(pricingSettings!.uber_base_fare_cents + km * pricingSettings!.uber_per_km_cents), pricingSettings!.uber_minimum_fare_cents),
            hoursAdded: Math.round((ferryInfo.groundHome.durationMinutes / 60) * 100) / 100,
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
        if (!flightRes.ok || !flightBody.flight) return null

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
        result.push({
          description: `Flight back: ${flightBody.origin.code} → ${flightBody.destination.code} (${flightBody.flight.isDirect ? 'direct' : `${flightBody.flight.stops} stop${flightBody.flight.stops === 1 ? '' : 's'}`})`,
          kind: 'flight' as const,
          dealerAmountCents: flightBody.flight.priceCents,
          hoursAdded: flightBody.flight.hoursToAdd,
          paidToDriver: false,
        })
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

      const forcedRoundTrip = isTradeIn || (chaseVehicle && secondDriver)
      const longHaul = oneWayHours > 4

      let finalCharges: AdditionalCharge[] = manualCharges
      let effectiveFlyingBack = flyingBack

      if (forcedRoundTrip) {
        effectiveFlyingBack = false
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
            { distanceKm: data.distanceKm, durationMinutes: data.durationMinutes, vehicleMode, numDrivers: 1, outOfProvinceInspection, registryVisit, ferryRequired: false, additionalCharges: charges, oneWayFlightBack: true },
            pricingSettings
          )
          options.push({ label: 'Flight', flying: true, secondDrv: false, chase: false, charges, cost: r.estimatedDealerCostCents })
        }

        {
          const fc = ferryCharge('oneway-vehicle')
          const charges = fc ? [...manualCharges, ...busCharges, fc] : [...manualCharges, ...busCharges]
          const r = calculatePricing(
            { distanceKm: data.distanceKm, durationMinutes: data.durationMinutes, vehicleMode, numDrivers: 1, outOfProvinceInspection, registryVisit, ferryRequired: false, additionalCharges: charges, oneWayFlightBack: true },
            pricingSettings
          )
          options.push({ label: 'Bus', flying: true, secondDrv: false, chase: false, charges, cost: r.estimatedDealerCostCents })
        }

        {
          const fc = ferryCharge('roundtrip-vehicle')
          const charges = fc ? [...manualCharges, fc] : manualCharges
          const r = calculatePricing(
            { distanceKm: data.distanceKm, durationMinutes: data.durationMinutes, vehicleMode, numDrivers: 2, outOfProvinceInspection, registryVisit, ferryRequired: false, additionalCharges: charges, oneWayFlightBack: false },
            pricingSettings
          )
          options.push({ label: '2nd driver + chase', flying: false, secondDrv: true, chase: true, charges, cost: r.estimatedDealerCostCents })
        }

        const winner = options.reduce((best, o) => (o.cost < best.cost ? o : best))
        effectiveFlyingBack = winner.flying
        finalCharges = winner.charges
        setFlyingBack(winner.flying)
        setSecondDriver(winner.secondDrv)
        setChaseVehicle(winner.chase)

        setDecisionNote(
          `Long haul (${Math.round(oneWayHours * 10) / 10}hrs one-way) — auto-selected ${winner.label} ($${(winner.cost / 100).toFixed(2)}), cheapest of: ` +
          options.map((o) => `${o.label} $${(o.cost / 100).toFixed(2)}`).join(', ') +
          '.'
        )
      } else {
        // Short trip, nothing forcing a round trip — respect the manual checkboxes as-is.
        if (flyingBack) {
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
          // No trade-in, no chase+2nd driver, not flying — the vehicle only goes one way.
          // If a ferry's involved, the driver returns as a walk-on passenger (much cheaper
          // than a second vehicle fare) plus a ride from the terminal back home.
          const fc = ferryCharge('oneway-walkon-return')
          const groundHomeCharge = ferryReturnGroundTransport()
          finalCharges = fc ? [...manualCharges, fc, groundHomeCharge] : manualCharges
          setDecisionNote(
            fc
              ? `Short trip, one-way delivery — ferry return is walk-on passenger + Uber home (not a 2nd vehicle fare). Ground transport home: $${(groundHomeCharge.dealerAmountCents / 100).toFixed(2)} (${ferryInfo?.groundHome ? `calculated, ${ferryInfo.groundHome.distanceKm}km` : 'flat estimate'}).`
              : 'Short trip, one-way delivery — no ferry detected on this route.'
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
  }, [stops, vehicleMode, secondDriver, chaseVehicle, isTradeIn, outOfProvinceInspection, registryVisit, ferryRequired, additionalCharges, flyingBack, pricingSettings, scheduledFor])

  // Single source of truth for the pricing summary — recomputes any time the
  // relevant inputs change, using the last-fetched distance/duration.
  useEffect(() => {
    if (distanceKm == null || durationMinutes == null || !pricingSettings) return
    const result = calculatePricing(
      {
        distanceKm,
        durationMinutes,
        vehicleMode,
        numDrivers: secondDriver ? 2 : 1,
        outOfProvinceInspection,
        registryVisit,
        ferryRequired: false,
        additionalCharges,
        oneWayFlightBack: flyingBack,
      },
      pricingSettings
    )
    setPricing(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [additionalCharges, vehicleMode, secondDriver, outOfProvinceInspection, registryVisit, ferryRequired, ferryLiveDataUsed, flyingBack, distanceKm, durationMinutes])

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

    const { data: newJob, error: jobError } = await supabase.from('jobs').insert({
      organization_id: orgIdToUse,
      job_type_id: jobTypeId,
      created_by: user.id,
      pickup_address: filledStops[0],
      dropoff_address: filledStops[filledStops.length - 1],
      recipient_name: customerFullName || null,
      recipient_phone: customerPhone || null,
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
      scheduled_for: scheduledFor || null,
      delivery_deadline: deliveryDeadline || null,
      second_driver_required: secondDriver,
      chase_vehicle_required: chaseVehicle,
      is_trade_in_pickup: isTradeIn,
      is_first_nations_delivery: isFirstNationsDelivery,
      one_way_flight_back: flyingBack,
      vehicle_mode: vehicleMode,
      used_own_vehicle: true,
      out_of_province_inspection: outOfProvinceInspection,
      registry_visit: registryVisit,
      ferry_required: ferryRequired,
      additional_charges: additionalCharges,
      overnight_required: pricing?.overnightRequired ?? false,
      estimated_distance_km: pricing?.tripDistanceKm ?? distanceKm,
      estimated_duration_minutes: durationMinutes,
      estimated_dealer_cost_cents: pricing?.estimatedDealerCostCents ?? null,
      estimated_driver_pay_cents: pricing?.estimatedDriverPayCents ?? null,
      estimated_driver_reimbursement_cents: pricing?.reimbursementCents ?? null,
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

    router.push('/dashboard')
    router.refresh()
  }

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
              onChange={(e) => setJobTypeId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {jobTypes.map((jt) => (
                <option key={jt.id} value={jt.id}>{jt.name}</option>
              ))}
            </select>
          </div>

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
                <input value={stockNumber} onChange={(e) => setStockNumber(e.target.value)}
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
              <input value={vin} onChange={(e) => setVin(e.target.value)}
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

          <div className="space-y-3 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900">Customer / Recipient</p>
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
            {deliveryDeadline && !computingPickupTime && !pickupTimeError && scheduledFor && (
              <p className="text-xs text-gray-500 mt-1">
                Driver needs to leave by {new Date(scheduledFor).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })} to make it on time.
              </p>
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
            {outOfProvinceInspection && scheduledFor && [5, 6].includes(new Date(scheduledFor).getDay()) && (
              <p className="text-xs text-amber-600 -mt-1 ml-6">
                ⚠️ This is scheduled for a {new Date(scheduledFor).getDay() === 5 ? 'Friday' : 'Saturday'} — most registries and
                inspection shops are closed Sundays, so the inspection may not complete until Monday. An extra hotel night and
                flat fees may apply if so.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={registryVisit} onChange={(e) => setRegistryVisit(e.target.checked)} />
              Registry visit required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={ferryRequired} onChange={(e) => setFerryRequired(e.target.checked)} />
              Force ferry crossing (if not detected automatically)
            </label>
            <p className="text-xs text-gray-400 -mt-1 ml-6">
              Ferries are detected and priced automatically based on the pickup/dropoff addresses — only check this if you know a ferry is needed and it wasn't picked up.
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isFirstNationsDelivery} onChange={(e) => setIsFirstNationsDelivery(e.target.checked)} />
              Delivery is to a First Nations reserve
            </label>
            <div className="pt-2 border-t border-gray-100">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={flyingBack}
                  onChange={(e) => setFlyingBack(e.target.checked)}
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
                    </p>
                    <div className="flex items-center justify-between pt-1 text-xs font-medium text-gray-700">
                      <span>Total driver pay</span>
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
              {loading ? 'Posting...' : 'Post job'}
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
