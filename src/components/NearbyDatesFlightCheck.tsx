'use client'

import { useState } from 'react'
import { calculatePricing, formatCents, type PricingSettings, type AdditionalCharge } from '@/lib/pricing'
import { toLocalDateString, toLocalDatetimeInputValue } from '@/lib/localDatetime'

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
  ferryRequired,
  manualCharges,
  onSelectDate,
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
  ferryRequired: boolean
  manualCharges: AdditionalCharge[]
  onSelectDate: (newScheduledFor: string) => void
}) {
  const [results, setResults] = useState<DayResult[] | null>(null)
  const [checking, setChecking] = useState(false)

  function computeFlightDate(startDate: Date): string {
    const oneWayHours = durationMinutes / 60
    const inspectionHours = outOfProvinceInspection ? pricingSettings.out_of_province_inspection_min_hours : 0
    const registryHours = registryVisit ? pricingSettings.registry_visit_min_hours : 0
    const overnightNeeded = oneWayHours + inspectionHours + registryHours > pricingSettings.max_driving_hours_before_overnight
    const d = new Date(startDate)
    if (overnightNeeded) d.setDate(d.getDate() + 1)
    return toLocalDateString(d)
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

        const res = await fetch('/api/flights/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originAddress, destinationAddress, departureDate: flightDepartureDate }),
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
            ferryRequired,
            useGarageInsurance: false,
            additionalCharges: charges,
            oneWayFlightBack: true,
          },
          pricingSettings
        )

        result.totalCents = pricing.estimatedDealerCostCents
        result.totalHours = Math.round(pricing.dealerBilledHours * 10) / 10
        result.flightSummary = `${body.origin.code} → ${body.destination.code} · ${formatCents(body.flight.priceCents)} ${body.flight.currency}`
        return result
      })
    )

    setResults(days)
    setChecking(false)
  }

  const cheapestCents = results
    ? Math.min(...results.filter((r) => r.totalCents != null).map((r) => r.totalCents as number))
    : null

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
                      onClick={() => {
                        const newDate = new Date(scheduledFor)
                        newDate.setDate(newDate.getDate() + r.offset)
                        onSelectDate(toLocalDatetimeInputValue(newDate))
                      }}
                      className="text-xs bg-[#378ADD] text-white px-2 py-1 rounded-lg hover:bg-[#2d6ead]"
                    >
                      Use this day
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
