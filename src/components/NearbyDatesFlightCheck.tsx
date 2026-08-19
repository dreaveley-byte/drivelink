'use client'

import { useState } from 'react'
import { calculatePricing, formatCents, type PricingSettings, type AdditionalCharge } from '@/lib/pricing'
import { toLocalDateString, toLocalDatetimeInputValue, zonedLocalInputToUtcIso, localInputToUtcIso } from '@/lib/localDatetime'

type DayResult = {
  offset: number
  startDate: Date
  totalCents: number | null
  totalHours: number | null
  flightSummary: string | null
  error: string | null
}

export default function NearbyDatesFlightCheck({
  scheduledFor,
  distanceKm,
  durationMinutes,
  vehicleMode,
  numDrivers,
  pricingSettings,
  originAddress,
  destinationAddress,
  outOfProvinceInspection,
  registryVisit,
  insuranceVisit,
  ferryRequired,
  manualCharges,
  onSelectDate,
  originTimeZone,
}: {
  scheduledFor: string
  distanceKm: number
  durationMinutes: number
  vehicleMode: 'driven' | 'towed'
  numDrivers: 1 | 2
  pricingSettings: PricingSettings
  originAddress: string
  destinationAddress: string
  outOfProvinceInspection: boolean
  registryVisit: boolean
  insuranceVisit: boolean
  ferryRequired: boolean
  manualCharges: AdditionalCharge[]
  onSelectDate: (newScheduledFor: string) => void | Promise<void>
  originTimeZone?: string | null
}) {
  const [results, setResults] = useState<DayResult[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [recalculatingOffset, setRecalculatingOffset] = useState<number | null>(null)

  // Total time on the road/at stops before the driver is actually free to head
  // to the airport: one-way driving + any inspection/registry/insurance visits.
  function totalOnGroundHours(): number {
    const oneWayHours = durationMinutes / 60
    const inspectionHours = outOfProvinceInspection ? pricingSettings.out_of_province_inspection_min_hours : 0
    const registryHours = registryVisit ? pricingSettings.registry_visit_min_hours : 0
    const insuranceHours = insuranceVisit ? pricingSettings.insurance_visit_min_hours : 0
    return oneWayHours + inspectionHours + registryHours + insuranceHours
  }

  function computeFlightDate(startDate: Date): string {
    const overnightNeeded = totalOnGroundHours() > pricingSettings.max_driving_hours_before_overnight
    const d = new Date(startDate)
    if (overnightNeeded) d.setDate(d.getDate() + 1)
    return toLocalDateString(d)
  }

  // Real UTC timestamp for when the driver is estimated to actually finish the
  // drop-off and be free to start heading to the airport, for a given nearby
  // start date — this (not just a bare calendar date) is what the flight search
  // API uses to filter out flights the driver couldn't realistically catch.
  function computeEarliestViableDepartureAt(startDate: Date): string | undefined {
    const startLocalValue = toLocalDatetimeInputValue(startDate)
    const startUtcIso = originTimeZone
      ? zonedLocalInputToUtcIso(startLocalValue, originTimeZone)
      : localInputToUtcIso(startLocalValue)
    if (!startUtcIso) return undefined
    const completionMs = new Date(startUtcIso).getTime() + totalOnGroundHours() * 60 * 60 * 1000
    return new Date(completionMs).toISOString()
  }

  async function checkDates() {
    if (!scheduledFor) return
    setChecking(true)
    const base = new Date(scheduledFor)
    const offsets = [-1, 0, 1, 2, 3]

    const days = await Promise.all(
      offsets.map(async (offset) => {
        const startDate = new Date(base)
        startDate.setDate(startDate.getDate() + offset)
        const flightDepartureDate = computeFlightDate(startDate)
        const earliestViableDepartureAt = computeEarliestViableDepartureAt(startDate)

        const res = await fetch('/api/flights/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originAddress, destinationAddress, departureDate: flightDepartureDate, earliestViableDepartureAt }),
        })
        const body = await res.json().catch(() => ({}))

        const result: DayResult = { offset, startDate, totalCents: null, totalHours: null, flightSummary: null, error: null }

        if (!res.ok || !body.flight) {
          result.error = body.error || 'No flight found'
          return result
        }

        const charges: AdditionalCharge[] = [
          ...manualCharges,
          {
            description: 'Return ground transport',
            dealerAmountCents: pricingSettings.return_ground_transport_fee_cents,
            hoursAdded: pricingSettings.return_ground_transport_hours,
            paidToDriver: true,
          },
        ]
        if (body.groundToAirport) {
          const km = body.groundToAirport.distanceKm
          charges.push({
            description: 'Ground transport to airport',
            dealerAmountCents: Math.max(Math.round(pricingSettings.uber_base_fare_cents + km * pricingSettings.uber_per_km_cents), pricingSettings.uber_minimum_fare_cents),
            hoursAdded: Math.round((body.groundToAirport.durationMinutes / 60) * 100) / 100,
            paidToDriver: true,
          })
        }
        charges.push({
          description: `Flight back: ${body.origin.code} → ${body.destination.code}`,
          dealerAmountCents: body.flight.priceCents,
          hoursAdded: body.flight.hoursToAdd,
          paidToDriver: false,
        })

        const pricing = calculatePricing(
          {
            distanceKm,
            durationMinutes,
            vehicleMode,
            numDrivers,
            outOfProvinceInspection,
            registryVisit,
            insuranceVisit,
            ferryRequired,
            useGarageInsurance: false,
            includeTowDeductibleCoverage: false,
            additionalCharges: charges,
            oneWayFlightBack: true,
          },
          pricingSettings
        )

        result.totalCents = pricing.estimatedDealerCostCents
        result.totalHours = Math.round(pricing.dealerBilledHours * 10) / 10
        const departsText = body.flight.departingAt
          ? ` · departs ${new Date(body.flight.departingAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}`
          : ''
        const bufferWarning = body.noFlightMetCheckInBuffer ? ' ⚠️ no flight caught the check-in buffer that day' : ''
        result.flightSummary = `${body.origin.code} → ${body.destination.code} · ${formatCents(body.flight.priceCents)} ${body.flight.currency}${departsText}${bufferWarning}`
        return result
      })
    )

    setResults(days)
    setChecking(false)
  }

  const cheapestCents = results
    ? Math.min(...results.filter((r) => r.totalCents != null).map((r) => r.totalCents as number))
    : null

  // Picking a nearby day should just work in one click — update the scheduled
  // date AND immediately re-run the full quote calculation (rather than only
  // updating the date and leaving it to the user to notice a message and go
  // find the "Calculate distance & cost" button somewhere else on the page).
  // The stale comparison results get cleared afterward since they were computed
  // against the old scheduled date and no longer reflect what's now selected.
  async function useThisDay(offset: number) {
    if (!scheduledFor) return
    const newDate = new Date(scheduledFor)
    newDate.setDate(newDate.getDate() + offset)
    const newValue = toLocalDatetimeInputValue(newDate)
    setRecalculatingOffset(offset)
    try {
      await onSelectDate(newValue)
    } finally {
      setRecalculatingOffset(null)
      setResults(null)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <button
        type="button"
        onClick={checkDates}
        disabled={checking || !scheduledFor}
        className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        {checking ? 'Checking nearby dates…' : 'Compare total price across nearby dates'}
      </button>
      {!scheduledFor && <p className="text-xs text-gray-400 mt-1">Set a scheduled date first.</p>}
      {recalculatingOffset != null && (
        <p className="text-xs text-blue-700 mt-1">Recalculating for this date…</p>
      )}

      {results && (
        <div className="mt-2 space-y-1.5">
          {results.map((r) => {
            const isCheapest = r.totalCents != null && r.totalCents === cheapestCents
            return (
              <div
                key={r.offset}
                className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border ${isCheapest ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
              >
                <div>
                  <p className={isCheapest ? 'text-green-800 font-medium' : 'text-gray-700'}>
                    {r.startDate.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {r.offset === 0 && ' (current)'}
                  </p>
                  {r.flightSummary && <p className="text-gray-400 mt-0.5">{r.flightSummary}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {r.totalCents != null ? (
                    <div className="text-right">
                      <p className={isCheapest ? 'text-green-800 font-semibold' : 'text-gray-900 font-medium'}>
                        {formatCents(r.totalCents)}{isCheapest && ' ✓'}
                      </p>
                      <p className="text-gray-400">≈ {r.totalHours} hrs</p>
                    </div>
                  ) : (
                    <span className="text-gray-400">{r.error}</span>
                  )}
                  {r.offset !== 0 && r.totalCents != null && (
                    <button
                      type="button"
                      onClick={() => useThisDay(r.offset)}
                      disabled={recalculatingOffset != null}
                      className="text-xs bg-[#378ADD] text-white px-2 py-1 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
                    >
                      {recalculatingOffset === r.offset ? 'Recalculating…' : 'Use this day'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
