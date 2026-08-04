'use client'

import { useState } from 'react'
import { formatCents, type AdditionalCharge } from '@/lib/pricing'

export default function FlightSearchButton({
  originAddress,
  destinationAddress,
  onSelect,
}: {
  originAddress: string
  destinationAddress: string
  onSelect: (charge: AdditionalCharge) => void
}) {
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    origin: { code: string; name: string }
    destination: { code: string; name: string }
    flight: {
      priceCents: number
      currency: string
      stops: number
      isDirect: boolean
      flightDurationMinutes: number
      hoursToAdd: number
    } | null
  } | null>(null)
  const [added, setAdded] = useState(false)

  async function search() {
    if (!originAddress || !destinationAddress) {
      setError('Enter both a pickup and dropoff address first.')
      return
    }
    setSearching(true)
    setError('')
    setResult(null)
    setAdded(false)
    const res = await fetch('/api/flights/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originAddress, destinationAddress }),
    })
    const body = await res.json().catch(() => ({}))
    setSearching(false)
    if (!res.ok) {
      setError(body.error || 'Could not search flights.')
      return
    }
    setResult(body)
  }

  function addToQuote() {
    if (!result?.flight) return
    onSelect({
      description: `Flight back: ${result.origin.code} → ${result.destination.code} (${result.flight.isDirect ? 'direct' : `${result.flight.stops} stop${result.flight.stops === 1 ? '' : 's'}`})`,
      dealerAmountCents: result.flight.priceCents,
      hoursAdded: result.flight.hoursToAdd,
      paidToDriver: true,
    })
    setAdded(true)
  }

  return (
    <div>
      <button
        type="button"
        onClick={search}
        disabled={searching}
        className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        {searching ? 'Searching flights…' : 'Search flight price'}
      </button>

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {result && (
        <div className="mt-2 text-xs border border-gray-200 rounded-lg p-2 bg-gray-50">
          {result.flight ? (
            <>
              <p className="text-gray-700">
                {result.origin.code} → {result.destination.code} ·{' '}
                {result.flight.isDirect ? 'Direct flight' : `${result.flight.stops} stop${result.flight.stops === 1 ? '' : 's'}`} ·{' '}
                <span className="font-medium">{formatCents(result.flight.priceCents)}</span>
              </p>
              <p className="text-gray-400 mt-0.5">
                Flight time {Math.floor(result.flight.flightDurationMinutes / 60)}h {result.flight.flightDurationMinutes % 60}m
                {' '}+ 3h airport buffer = {result.flight.hoursToAdd} hrs added to the job
              </p>
              {added ? (
                <p className="text-green-700 mt-1">Added to quote.</p>
              ) : (
                <button
                  type="button"
                  onClick={addToQuote}
                  className="mt-1 text-xs bg-[#378ADD] text-white px-2.5 py-1 rounded-lg hover:bg-[#2d6ead]"
                >
                  Add to quote
                </button>
              )}
            </>
          ) : (
            <p className="text-gray-400">No flights found for that route.</p>
          )}
        </div>
      )}
    </div>
  )
}
