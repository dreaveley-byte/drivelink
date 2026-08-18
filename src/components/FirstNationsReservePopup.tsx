'use client'

import { useState } from 'react'

type Reserve = { name: string; address: string; placeId: string; distanceKm: number }

export default function FirstNationsReservePopup({
  dropoffAddress,
  onConfirm,
  onSkip,
  onClose,
}: {
  dropoffAddress: string
  onConfirm: (reserveAddress: string) => void
  onSkip: () => void
  onClose: () => void
}) {
  const [step, setStep] = useState<'ask' | 'list'>('ask')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reserves, setReserves] = useState<Reserve[]>([])
  const [manualAddress, setManualAddress] = useState('')

  async function handleYes() {
    if (!dropoffAddress.trim()) {
      setError('Enter the dropoff address first, then check this box again \u2014 that\u2019s what nearby reserves get searched around.')
      return
    }
    setStep('list')
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/places/nearby-reserves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: dropoffAddress }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not search for nearby reserves.')
      } else {
        setReserves(data.reserves ?? [])
      }
    } catch {
      setError('Could not search for nearby reserves.')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        {step === 'ask' ? (
          <>
            <p className="text-sm font-semibold text-gray-900 mb-2">First Nations delivery</p>
            <p className="text-sm text-gray-600 mb-4">Should we be delivering on the nearest reserve?</p>
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleYes} className="flex-1 bg-[#378ADD] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#2d6ead]">
                Yes
              </button>
              <button onClick={onSkip} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50">
                No
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-900 mb-1">Nearest reserves</p>
            <p className="text-xs text-gray-500 mb-3">Searched near the customer/recipient address. Pick one to set as the delivery location.</p>
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            {loading && <p className="text-sm text-gray-400 py-4 text-center">Searching…</p>}
            {!loading && !error && reserves.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">No reserves found nearby.</p>
            )}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {reserves.map((r) => (
                <button
                  key={r.placeId}
                  onClick={() => onConfirm(r.address)}
                  className="w-full text-left border border-gray-200 rounded-lg p-3 hover:border-[#378ADD] hover:bg-blue-50/40"
                >
                  <p className="text-sm font-medium text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.address}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.distanceKm} km away</p>
                </button>
              ))}
            </div>
            <div className="border-t border-gray-200 mt-4 pt-4">
              <label className="block text-xs text-gray-500 mb-1">Or enter the reserve delivery address manually</label>
              <div className="flex gap-2">
                <input
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Enter address"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={() => manualAddress.trim() && onConfirm(manualAddress.trim())}
                  disabled={!manualAddress.trim()}
                  className="bg-[#378ADD] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
                >
                  Use this
                </button>
              </div>
            </div>
            <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 underline mt-3">
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
