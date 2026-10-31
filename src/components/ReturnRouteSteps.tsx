'use client'

import { formatCents, groundLegPricing, type GroundLeg, type PricingSettings } from '@/lib/pricing'

type Airport = { code: string; name: string }

export type ReturnRouteOption = {
  origin: Airport
  destination: Airport
  flight: { priceCents: number; isDirect: boolean; stops: number; departingAt?: string | null }
  groundToAirport: GroundLeg | null
  groundFromAirport: GroundLeg | null
}

function short(address: string) {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  return parts.length > 2 ? parts.slice(0, 2).join(', ') : address
}

// Spells out how the driver gets home on a fly-back quote, leg by leg with
// the cost of each, so the dealer can see (and sanity-check) the route that
// the price is based on rather than just a total.
export default function ReturnRouteSteps({
  pickup,
  dropoff,
  driveKm,
  driveMinutes,
  option,
  settings,
}: {
  pickup: string
  dropoff: string
  driveKm: number | null
  driveMinutes: number | null
  option: ReturnRouteOption
  settings: PricingSettings
}) {
  const to = option.groundToAirport ? groundLegPricing(option.groundToAirport, settings) : null
  const home = option.groundFromAirport ? groundLegPricing(option.groundFromAirport, settings) : null

  const steps: { title: string; detail: string; cost?: number }[] = []
  steps.push({
    title: `Drive the vehicle: ${short(pickup)} → ${short(dropoff)}`,
    detail: driveKm != null && driveMinutes != null ? `${driveKm} km · about ${Math.round((driveMinutes / 60) * 10) / 10} h` : '',
  })
  if (option.groundToAirport && to) {
    steps.push({
      title: `${to.mode === 'bus' ? 'Bus' : 'Ride'} to ${option.origin.name} airport (${option.origin.code})`,
      detail: `${option.groundToAirport.distanceKm} km${to.mode === 'bus' ? ' · intercity bus, an airport this far away is reached by bus rather than a ride' : ''}`,
      cost: to.dealerAmountCents,
    })
  }
  steps.push({
    title: `Fly ${option.origin.code} → ${option.destination.code}`,
    detail:
      (option.flight.isDirect ? 'Direct' : `${option.flight.stops} stop${option.flight.stops === 1 ? '' : 's'}`) +
      (option.flight.departingAt ? ` · departs ${new Date(option.flight.departingAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}` : ''),
    cost: option.flight.priceCents,
  })
  if (option.groundFromAirport && home) {
    steps.push({
      title: `${home.mode === 'bus' ? 'Bus' : 'Ride'} home from ${option.destination.name} (${option.destination.code}) → ${short(pickup)}`,
      detail: `${option.groundFromAirport.distanceKm} km`,
      cost: home.dealerAmountCents,
    })
  }

  const total = steps.reduce((sum, s) => sum + (s.cost ?? 0), 0)

  return (
    <div className="ml-6 mt-3 border border-gray-200 rounded-lg p-3 bg-gray-50/60">
      <p className="text-xs font-medium text-gray-700 mb-2">Return route used for this quote</p>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span className="shrink-0 w-4 h-4 rounded-full bg-gray-200 text-gray-600 text-[10px] flex items-center justify-center mt-0.5">{i + 1}</span>
            <span className="flex-1">
              <span className="text-gray-900">{s.title}</span>
              {s.detail && <span className="block text-gray-500">{s.detail}</span>}
            </span>
            {s.cost != null && <span className="text-gray-900 font-medium whitespace-nowrap">{formatCents(s.cost)}</span>}
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-gray-500 mt-2">
        Fares for the trip home (not including the driver&apos;s billed time): <span className="font-medium text-gray-700">{formatCents(total)}</span>
      </p>
    </div>
  )
}
