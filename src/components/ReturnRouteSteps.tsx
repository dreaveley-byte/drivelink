'use client'

import { formatCents, type AdditionalCharge } from '@/lib/pricing'

function short(address: string) {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  return parts.length > 2 ? parts.slice(0, 2).join(', ') : address
}

// Order the return-trip charges in the order the driver actually does them.
const KIND_ORDER: Record<string, number> = { 'ground-to-airport': 1, bus: 2, flight: 2, ferry: 3, 'ground-home': 4 }

// Spells out how the driver gets home on this quote, leg by leg with the
// price of each, so the dealer can see (and sanity-check) the route behind the
// total. Built from the quote's own charges, so it always matches what's being
// billed - commercial flight, Harbour Air, bus or walk-on ferry - and it still
// shows when a saved job is reopened.
export default function ReturnRouteSteps({
  pickup,
  dropoff,
  driveKm,
  driveMinutes,
  charges,
}: {
  pickup: string
  dropoff: string
  driveKm: number | null
  driveMinutes: number | null
  charges: AdditionalCharge[]
}) {
  const legs = charges
    .filter((c) => c.kind && KIND_ORDER[c.kind] != null && !(c.kind === 'ferry' && !/walk-on/i.test(c.description)))
    .sort((a, b) => KIND_ORDER[a.kind!] - KIND_ORDER[b.kind!])
  if (legs.length === 0) return null

  const total = legs.reduce((sum, c) => sum + c.dealerAmountCents, 0)

  return (
    <div className="ml-6 mt-3 border border-gray-200 rounded-lg p-3 bg-gray-50/60">
      <p className="text-xs font-medium text-gray-700 mb-2">Return route used for this quote</p>
      <ol className="space-y-1.5">
        <li className="flex items-start gap-2 text-xs">
          <span className="shrink-0 w-4 h-4 rounded-full bg-gray-200 text-gray-600 text-[10px] flex items-center justify-center mt-0.5">1</span>
          <span className="flex-1">
            <span className="text-gray-900">Drive the vehicle: {short(pickup)} → {short(dropoff)}</span>
            {driveKm != null && driveMinutes != null && (
              <span className="block text-gray-500">{driveKm} km · about {Math.round((driveMinutes / 60) * 10) / 10} h</span>
            )}
          </span>
        </li>
        {legs.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span className="shrink-0 w-4 h-4 rounded-full bg-gray-200 text-gray-600 text-[10px] flex items-center justify-center mt-0.5">{i + 2}</span>
            <span className="flex-1 text-gray-900">{c.description}</span>
            <span className="text-gray-900 font-medium whitespace-nowrap">{formatCents(c.dealerAmountCents)}</span>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-gray-500 mt-2">
        Fares for the trip home (the driver&apos;s billed time is priced separately): <span className="font-medium text-gray-700">{formatCents(total)}</span>
      </p>
    </div>
  )
}
