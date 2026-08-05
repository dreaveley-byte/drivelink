'use client'

import { useState } from 'react'
import { calculatePricing, formatCents, type PricingSettings } from '@/lib/pricing'

export default function ReturnOptionsComparison({
  distanceKm,
  durationMinutes,
  vehicleMode,
  outOfProvinceInspection,
  registryVisit,
  pricingSettings,
  originAddress,
  destinationAddress,
  scheduledFor,
}: {
  distanceKm: number
  durationMinutes: number
  vehicleMode: 'driven' | 'towed'
  outOfProvinceInspection: boolean
  registryVisit: boolean
  pricingSettings: PricingSettings
  originAddress: string
  destinationAddress: string
  scheduledFor?: string
}) {
  const [busFare, setBusFare] = useState('')
  const [flightPriceCents, setFlightPriceCents] = useState<number | null>(null)
  const [flightHours, setFlightHours] = useState(0)
  const [flightSummary, setFlightSummary] = useState('')
  const [groundToAirportCents, setGroundToAirportCents] = useState(0)
  const [groundToAirportHours, setGroundToAirportHours] = useState(0)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  async function searchFlight() {
    setSearching(true)
    setSearchError('')

    // If the total time on the ground (driving + inspection + registry) exceeds
    // the overnight threshold, the driver is free to fly the day after they set
    // out, not the scheduled start date itself.
    const oneWayHours = durationMinutes / 60
    const inspectionHours = outOfProvinceInspection ? pricingSettings.out_of_province_inspection_min_hours : 0
    const registryHours = registryVisit ? pricingSettings.registry_visit_min_hours : 0
    const overnightNeeded = oneWayHours + inspectionHours + registryHours > pricingSettings.max_driving_hours_before_overnight
    let flightDepartureDate: string | undefined
    if (scheduledFor) {
      const d = new Date(scheduledFor)
      if (overnightNeeded) d.setDate(d.getDate() + 1)
      flightDepartureDate = d.toISOString().slice(0, 10)
    }

    const res = await fetch('/api/flights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originAddress,
        destinationAddress,
        departureDate: flightDepartureDate,
      }),
    })
    const body = await res.json().catch(() => ({}))
    setSearching(false)
    if (!res.ok) {
      setSearchError(body.error || 'Could not search flights.')
      return
    }
    if (!body.flight) {
      setSearchError('No flights found for that route.')
      return
    }
    setFlightPriceCents(body.flight.priceCents)
    setFlightHours(body.flight.hoursToAdd ?? 0)
    setFlightSummary(
      `${body.origin.code} → ${body.destination.code} · ${body.flight.isDirect ? 'Direct' : `${body.flight.stops} stop${body.flight.stops === 1 ? '' : 's'}`} · ${body.flight.currency}`
    )
    if (body.groundToAirport) {
      const km = body.groundToAirport.distanceKm
      setGroundToAirportCents(
        Math.max(Math.round(pricingSettings.uber_base_fare_cents + km * pricingSettings.uber_per_km_cents), pricingSettings.uber_minimum_fare_cents)
      )
      setGroundToAirportHours(Math.round((body.groundToAirport.durationMinutes / 60) * 100) / 100)
    } else {
      setGroundToAirportCents(0)
      setGroundToAirportHours(0)
    }
  }

  const baseInput = { distanceKm, durationMinutes, vehicleMode, outOfProvinceInspection, registryVisit }

  const secondDriverResult = calculatePricing(
    { ...baseInput, numDrivers: 2, oneWayFlightBack: false, additionalCharges: [] },
    pricingSettings
  )

  const flightResult =
    flightPriceCents != null
      ? calculatePricing(
          {
            ...baseInput,
            numDrivers: 1,
            oneWayFlightBack: true,
            additionalCharges: [
              { description: 'Flight back', dealerAmountCents: flightPriceCents, hoursAdded: flightHours, paidToDriver: false },
              {
                description: 'Ground transport to airport',
                dealerAmountCents: groundToAirportCents,
                hoursAdded: groundToAirportHours,
                paidToDriver: true,
              },
              {
                description: 'Return ground transport',
                dealerAmountCents: pricingSettings.return_ground_transport_fee_cents,
                hoursAdded: pricingSettings.return_ground_transport_hours,
                paidToDriver: true,
              },
            ],
          },
          pricingSettings
        )
      : null

  const busFareCents = busFare ? Math.round(parseFloat(busFare) * 100) : null
  const busResult =
    busFareCents != null && !isNaN(busFareCents)
      ? calculatePricing(
          {
            ...baseInput,
            numDrivers: 1,
            oneWayFlightBack: true,
            additionalCharges: [{ description: 'Bus back', dealerAmountCents: busFareCents, hoursAdded: 0, paidToDriver: false }],
          },
          pricingSettings
        )
      : null

  const options = [
    { label: '2nd Driver (drives back)', result: secondDriverResult },
    { label: 'Solo + Flight back', result: flightResult },
    { label: 'Solo + Bus back', result: busResult },
  ].filter((o) => o.result)

  const cheapestCost = Math.min(...options.map((o) => o.result!.estimatedDealerCostCents))

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="text-xs text-gray-400 uppercase tracking-wide">Compare Return Options (Admin)</p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={searchFlight}
          disabled={searching}
          className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {searching ? 'Searching…' : 'Search flight price'}
        </button>
        {flightSummary && <span className="text-xs text-gray-500">{flightSummary} · {formatCents(flightPriceCents ?? 0)}</span>}
      </div>
      {searchError && <p className="text-xs text-red-600">{searchError}</p>}

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-600">Bus fare ($):</label>
        <input
          type="number"
          step="0.01"
          value={busFare}
          onChange={(e) => setBusFare(e.target.value)}
          placeholder="e.g. 85.00"
          className="w-24 text-xs border border-gray-300 rounded-lg px-2 py-1"
        />
      </div>

      <div className="space-y-1.5 pt-2 border-t border-gray-100">
        {[
          { label: '2nd Driver (drives back)', result: secondDriverResult },
          { label: 'Solo + Flight back', result: flightResult },
          { label: 'Solo + Bus back', result: busResult },
        ].map(({ label, result }) => {
          const isCheapest = result && options.length > 1 && result.estimatedDealerCostCents === cheapestCost
          return (
            <div
              key={label}
              className={`flex items-center justify-between text-sm px-2 py-1.5 rounded-lg ${isCheapest ? 'bg-green-50 border border-green-300' : ''}`}
            >
              <span className={isCheapest ? 'text-green-800 font-medium' : 'text-gray-600'}>
                {label} {isCheapest && '✓ cheapest'}
              </span>
              <span className={isCheapest ? 'text-green-800 font-semibold' : 'text-gray-900'}>
                {result ? formatCents(result.estimatedDealerCostCents) : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
