'use client'

import { useState } from 'react'
import { formatCents, type PricingSettings } from '@/lib/pricing'

type DayResult = {
  offset: number
  startDate: Date
  flightDepartureDate: string
  priceCents: number | null
  currency: string | null
  error: string | null
}

export default function NearbyDatesFlightCheck({
  scheduledFor,
  distanceKm,
  durationMinutes,
  pricingSettings,
  originAddress,
  destinationAddress,
  outOfProvinceInspection,
  registryVisit,
  onSelectDate,
}: {
  scheduledFor: string
  distanceKm: number
  durationMinutes: number
  pricingSettings: PricingSettings
  originAddress: string
  destinationAddress: string
  outOfProvinceInspection: boolean
  registryVisit: boolean
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
    return d.toISOString().slice(0, 10)
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

        const result: DayResult = { offset, startDate, flightDepartureDate, priceCents: null, currency: null, error: null }
        if (res.ok && body.flight) {
          result.priceCents = body.flight.priceCents
          result.currency = body.flight.currency
        } else {
          result.error = body.error || 'No flight found'
        }
        return result
      })
    )

    setResults(days)
    setChecking(false)
  }

  const cheapestCents = results
    ? Math.min(...results.filter((r) => r.priceCents != null).map((r) => r.priceCents as number))
    : null

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={checkDates}
        disabled={checking || !scheduledFor}
        className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        {checking ? 'Checking nearby dates…' : 'Check nearby dates for a cheaper flight'}
      </button>
      {!scheduledFor && <p className="text-xs text-gray-400 mt-1">Set a scheduled date first.</p>}

      {results && (
        <div className="mt-2 space-y-1.5">
          {results.map((r) => {
            const isCheapest = r.priceCents != null && r.priceCents === cheapestCents
            return (
              <div
                key={r.offset}
                className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border ${isCheapest ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
              >
                <span className={isCheapest ? 'text-green-800 font-medium' : 'text-gray-700'}>
                  {r.startDate.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {r.offset === 0 && ' (current)'}
                </span>
                <div className="flex items-center gap-2">
                  {r.priceCents != null ? (
                    <span className={isCheapest ? 'text-green-800 font-semibold' : 'text-gray-600'}>
                      {formatCents(r.priceCents)} {r.currency}
                      {isCheapest && ' ✓'}
                    </span>
                  ) : (
                    <span className="text-gray-400">{r.error}</span>
                  )}
                  {r.offset !== 0 && r.priceCents != null && (
                    <button
                      type="button"
                      onClick={() => {
                        const newDate = new Date(scheduledFor)
                        newDate.setDate(newDate.getDate() + r.offset)
                        onSelectDate(newDate.toISOString().slice(0, 16))
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
