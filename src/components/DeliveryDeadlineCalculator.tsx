'use client'

import { useState } from 'react'
import type { PricingSettings } from '@/lib/pricing'

export default function DeliveryDeadlineCalculator({
  deliveryDeadline,
  onDeliveryDeadlineChange,
  originAddress,
  destinationAddress,
  pricingSettings,
  onPickupTimeCalculated,
}: {
  deliveryDeadline: string
  onDeliveryDeadlineChange: (v: string) => void
  originAddress: string
  destinationAddress: string
  pricingSettings: PricingSettings | null
  onPickupTimeCalculated: (pickupTime: string) => void
}) {
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ pickupTime: string; driveHours: number; breakHours: number } | null>(null)

  async function calculate() {
    if (!deliveryDeadline || !originAddress || !destinationAddress || !pricingSettings) {
      setError('Enter pickup and dropoff addresses and a delivery deadline first.')
      return
    }
    setCalculating(true)
    setError('')
    setResult(null)

    const res = await fetch('/api/distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: [originAddress, destinationAddress], departureTime: deliveryDeadline }),
    })
    const data = await res.json().catch(() => ({}))
    setCalculating(false)

    if (!res.ok) {
      setError(data.error || 'Could not calculate drive time.')
      return
    }

    const driveHours = data.durationMinutes / 60
    const mealBreaks = Math.min(
      Math.floor(driveHours / pricingSettings.meal_allowance_every_hours),
      pricingSettings.meal_allowance_max_count
    )
    const breakHours = (mealBreaks * pricingSettings.break_duration_minutes) / 60
    const totalHoursNeeded = driveHours + breakHours

    const pickupDate = new Date(deliveryDeadline)
    pickupDate.setTime(pickupDate.getTime() - totalHoursNeeded * 60 * 60 * 1000)
    const pickupTime = pickupDate.toISOString().slice(0, 16)

    setResult({ pickupTime, driveHours: Math.round(driveHours * 10) / 10, breakHours: Math.round(breakHours * 10) / 10 })
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <label className="block text-sm text-gray-700">Customer needs vehicle by (optional)</label>
      <input
        type="datetime-local"
        value={deliveryDeadline}
        onChange={(e) => onDeliveryDeadlineChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={calculate}
        disabled={calculating || !deliveryDeadline}
        className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        {calculating ? 'Calculating…' : 'Calculate required pickup time'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {result && (
        <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2">
          <p className="text-gray-700">
            Drive time {result.driveHours}h + breaks {result.breakHours}h ={' '}
            <span className="font-medium">
              pick up by {new Date(result.pickupTime).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </p>
          <button
            type="button"
            onClick={() => onPickupTimeCalculated(result.pickupTime)}
            className="mt-1 text-xs bg-[#378ADD] text-white px-2.5 py-1 rounded-lg hover:bg-[#2d6ead]"
          >
            Use this pickup time
          </button>
        </div>
      )}
    </div>
  )
}
