'use client'

import { useMemo, useState } from 'react'
import { formatCents, type AdditionalCharge, type PricingResult } from '@/lib/pricing'
import type { Itinerary, ItineraryStep, StepStatus } from '@/lib/itinerary'

function tzAbbr(iso: string, tz: string | null): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz ?? undefined, timeZoneName: 'short' }).formatToParts(new Date(iso))
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}

function fmtTime(iso: string, tz: string | null): string {
  try {
    const t = new Intl.DateTimeFormat('en-CA', { timeZone: tz ?? undefined, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso))
    return `${t} ${tzAbbr(iso, tz)}`
  } catch {
    return iso
  }
}

function fmtDay(iso: string, tz: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz ?? undefined, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function dayKey(iso: string, tz: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz ?? undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

function fmtDur(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  return h > 0 ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`
}

const STATUS: Record<StepStatus, { label: string; cls: string }> = {
  live: { label: 'Live data (not booked)', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  estimate: { label: 'Estimate', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  unavailable: { label: 'Unavailable', cls: 'bg-red-50 text-red-700 border-red-300' },
  skipped: { label: 'Not required', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

type Line = { label: string; cents: number }

function quoteLinesFrom(pricing: PricingResult, charges: AdditionalCharge[]): { lines: Line[]; markup: number } {
  const base: Line[] = [
    { label: 'Driver time (dealer-billed hours)', cents: pricing.hourlyDealerCents },
    { label: 'Fuel', cents: pricing.gasCostCents },
    { label: 'Meals', cents: pricing.mealCostCents },
    { label: 'Car wash', cents: pricing.carWashCents ?? 0 },
    { label: 'Wear & tear', cents: pricing.wearAndTearCents },
    { label: 'Trailer', cents: pricing.trailerFeeCents },
    { label: 'Hotel', cents: pricing.hotelCents },
    { label: 'Overnight fee', cents: pricing.overnightFeeCents },
    { label: 'Inspection', cents: pricing.inspectionFeeCents },
    { label: 'Registry visit fee', cents: pricing.registryFeeCents },
    { label: 'Ferry', cents: pricing.ferryFeeCents },
    { label: 'Drivflo insurance', cents: pricing.garageInsuranceFeeCents },
  ].filter((l) => l.cents > 0)
  const extra: Line[] = charges.filter((c) => c.dealerAmountCents > 0).map((c) => ({ label: c.description, cents: c.dealerAmountCents }))
  const listed = [...base, ...extra].reduce((a, l) => a + l.cents, 0)
  const other = pricing.costBasisCents - listed
  const lines = Math.abs(other) >= 1 ? [...base, ...extra, { label: 'Other adjustments (minimum pay etc.)', cents: other }] : [...base, ...extra]
  return { lines, markup: pricing.estimatedDealerCostCents - pricing.costBasisCents }
}

export default function AdminTripItinerary({
  pickupAddress,
  dropoffAddress,
  startUtc,
  registryRequired,
  pricing,
  additionalCharges,
}: {
  pickupAddress: string
  dropoffAddress: string
  /** pickup date/time as a UTC ISO string, or null if not entered yet */
  startUtc: string | null
  registryRequired: boolean
  pricing: PricingResult | null
  additionalCharges: AdditionalCharge[]
}) {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [builtFor, setBuiltFor] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const signature = `${pickupAddress}|${dropoffAddress}|${startUtc}|${registryRequired}`
  const stale = !!itinerary && builtFor !== signature
  const ready = !!pickupAddress.trim() && !!dropoffAddress.trim() && !!startUtc

  async function build() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupAddress, dropoffAddress, startUtc, registryRequired }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not build the trip plan.')
      setItinerary(data.itinerary)
      setBuiltFor(signature)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the trip plan.')
    } finally {
      setLoading(false)
    }
  }

  const quote = useMemo(() => (pricing ? quoteLinesFrom(pricing, additionalCharges) : null), [pricing, additionalCharges])

  // Compare the itinerary's own fares with the return fares already in the quote.
  const mismatch = useMemo(() => {
    if (!itinerary || !pricing) return null
    const itineraryFares = itinerary.costs.filter((c) => !/registry/i.test(c.label)).reduce((a, c) => a + c.cents, 0)
    const quoteFares = additionalCharges
      .filter((c) => c.kind === 'flight' || c.kind === 'bus' || c.kind === 'ground-to-airport' || c.kind === 'ground-home')
      .reduce((a, c) => a + c.dealerAmountCents, 0)
    if (quoteFares === 0) return { itineraryFares, quoteFares, note: 'The quote has no flight, bus or ride-home charges, but this itinerary uses them.' }
    const diff = Math.abs(itineraryFares - quoteFares)
    if (diff > Math.max(2500, quoteFares * 0.1)) return { itineraryFares, quoteFares, note: 'The return fares in the quote differ from this itinerary.' }
    return null
  }, [itinerary, pricing, additionalCharges])

  const grouped = useMemo(() => {
    if (!itinerary) return []
    const out: any[] = []
    let lastDay = ''
    let prev: ItineraryStep | null = null
    for (const step of itinerary.steps) {
      if (step.startUtc) {
        const k = dayKey(step.startUtc, step.startTz)
        if (k !== lastDay) {
          out.push({ type: 'day', label: fmtDay(step.startUtc, step.startTz), key: `d-${k}-${step.id}` })
          lastDay = k
        }
      }
      if (prev?.endUtc && step.startUtc && step.kind !== 'wait') {
        const gap = Math.round((new Date(step.startUtc).getTime() - new Date(prev.endUtc).getTime()) / 60000)
        if (gap >= 5) out.push({ type: 'gap', minutes: gap, key: `g-${step.id}` })
      }
      out.push({ type: 'step', step, key: step.id })
      if (step.endUtc) prev = step
    }
    return out
  }, [itinerary])

  return (
    <div className="mt-6 border-2 border-gray-900 rounded-xl p-4 bg-white">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">Full trip itinerary — admin review before ordering</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Door-to-door plan: delivery drive, handover, registry, bus to the airport, flight and ride home — each step starts when the one before it ends.
          </p>
        </div>
        <button
          type="button"
          onClick={build}
          disabled={!ready || loading}
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40"
        >
          {loading ? 'Building… (this can take up to a minute)' : itinerary ? 'Rebuild itinerary' : 'Build full itinerary'}
        </button>
      </div>

      {!ready && <p className="text-xs text-gray-500">Enter the pickup address, delivery address and pickup date/time above first.</p>}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {stale && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mb-3">
          The addresses, pickup time or registry option changed after this itinerary was built — rebuild it before relying on it.
        </p>
      )}

      {itinerary && (
        <>
          <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
            <p className="font-semibold text-red-700">NOT CONFIRMED</p>
            <p>
              Live searches (flights, directions, schedules) are not booked or held, and prices can change. Estimates are labelled. Built {new Date(itinerary.generatedAt).toLocaleString('en-CA')}.
            </p>
          </div>

          {itinerary.warnings.slice(1).length > 0 && (
            <div className="mb-3 space-y-1">
              {itinerary.warnings.slice(1).map((w, i) => (
                <p key={i} className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">⚠ {w}</p>
              ))}
            </div>
          )}

          <ol className="space-y-0">
            {grouped.map((item: any) => {
              if (item.type === 'day') {
                return (
                  <li key={item.key} className="pt-3 pb-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">{item.label}</p>
                  </li>
                )
              }
              if (item.type === 'gap') {
                return (
                  <li key={item.key} className="pl-4 py-1.5 border-l-2 border-dashed border-gray-300 ml-2 text-xs text-gray-500">
                    ⏱ Waiting / connection buffer: {fmtDur(item.minutes)}
                  </li>
                )
              }
              const s: ItineraryStep = item.step
              const st = STATUS[s.status]
              return (
                <li key={item.key} className={`border rounded-lg p-3 my-1.5 ${s.status === 'unavailable' ? 'border-red-300 bg-red-50/40' : s.status === 'skipped' ? 'border-gray-200 bg-gray-50' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{s.title}</p>
                    <span className={`text-[11px] border rounded-full px-2 py-0.5 whitespace-nowrap ${st.cls}`}>{st.label}</span>
                  </div>
                  {s.startUtc && s.endUtc && (
                    <p className="text-xs text-gray-800 mt-1">
                      <span className="font-medium">{fmtTime(s.startUtc, s.startTz)}</span>
                      {' → '}
                      <span className="font-medium">{fmtTime(s.endUtc, s.endTz)}</span>
                      {dayKey(s.startUtc, s.startTz) !== dayKey(s.endUtc, s.endTz) && <span className="text-gray-500"> ({fmtDay(s.endUtc, s.endTz)})</span>}
                      <span className="text-gray-500"> · {fmtDur((new Date(s.endUtc).getTime() - new Date(s.startUtc).getTime()) / 60000)}</span>
                    </p>
                  )}
                  {(s.from || s.to) && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {s.from && <span>From: {s.from}</span>}
                      {s.from && s.to && ' · '}
                      {s.to && <span>To: {s.to}</span>}
                    </p>
                  )}
                  <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                    {s.details.map((d, i) => (
                      <li key={i} className="whitespace-pre-wrap">{d}</li>
                    ))}
                  </ul>
                  {s.costCents != null && (
                    <p className="text-xs mt-1">
                      <span className="text-gray-500">Cost: </span>
                      <span className="font-medium text-gray-900">{s.costCents === 0 ? 'Free' : formatCents(s.costCents)}</span>
                      {s.costBasis && s.costBasis !== 'free' && <span className="text-gray-500"> ({s.costBasis})</span>}
                    </p>
                  )}
                  {s.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-800 mt-1">⚠ {w}</p>
                  ))}
                  <p className="text-[11px] text-gray-400 mt-1">Source: {s.source}</p>
                </li>
              )
            })}
          </ol>

          <div className="mt-4 pt-3 border-t-2 border-gray-900">
            <p className="text-sm font-semibold text-gray-900">
              Total trip duration:{' '}
              {itinerary.totalMinutes != null ? (
                <>
                  {fmtDur(itinerary.totalMinutes)}
                  {itinerary.endUtc && (
                    <span className="font-normal text-gray-600">
                      {' '}
                      ({fmtDay(itinerary.startUtc, itinerary.startTz)} {fmtTime(itinerary.startUtc, itinerary.startTz)} → {fmtDay(itinerary.endUtc, itinerary.endTz)} {fmtTime(itinerary.endUtc, itinerary.endTz)})
                    </span>
                  )}
                </>
              ) : (
                <span className="text-red-700">cannot be calculated — a step above is unavailable</span>
              )}
            </p>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-gray-700 mb-1">Transport costs in this itinerary</p>
                {itinerary.costs.length === 0 && <p className="text-gray-400">None priced.</p>}
                {itinerary.costs.map((c, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span className="text-gray-600">{c.label} <span className="text-gray-400">({c.basis})</span></span>
                    <span className="text-gray-900">{formatCents(c.cents)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 mt-1 border-t border-gray-200 font-medium">
                  <span>Itinerary transport total</span>
                  <span>{formatCents(itinerary.transportCents)}</span>
                </div>
              </div>

              <div>
                <p className="font-semibold text-gray-700 mb-1">Transport order quote (what the dealer is charged)</p>
                {!quote && <p className="text-gray-400">Calculate the price above to see the quote here.</p>}
                {quote && (
                  <>
                    {quote.lines.map((l, i) => (
                      <div key={i} className="flex justify-between py-0.5">
                        <span className="text-gray-600">{l.label}</span>
                        <span className="text-gray-900">{formatCents(l.cents)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 mt-1 border-t border-gray-200">
                      <span className="text-gray-600">Subtotal</span>
                      <span>{formatCents(pricing!.costBasisCents)}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-600">Markup / discount</span>
                      <span>{formatCents(quote.markup)}</span>
                    </div>
                    <div className="flex justify-between pt-1 mt-1 border-t border-gray-900 text-sm font-semibold">
                      <span>Total transport order price</span>
                      <span>{formatCents(pricing!.estimatedDealerCostCents)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {mismatch && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mt-3">
                ⚠ {mismatch.note} Quote: {formatCents(mismatch.quoteFares)} vs itinerary: {formatCents(mismatch.itineraryFares)}. Click “Calculate distance &amp; cost” again so the quote uses the same trip, or review the difference before ordering.
              </p>
            )}

            {itinerary.alternatives.length > 0 && (
              <div className="mt-3 text-xs">
                <p className="font-semibold text-gray-700 mb-1">Other airport combinations considered</p>
                {itinerary.alternatives.map((a, i) => (
                  <p key={i} className="text-gray-600">
                    {a.label} — {formatCents(a.totalCents)} in fares{a.departs ? `, flight departs (your time zone) ${fmtDay(a.departs, null)} ${fmtTime(a.departs, null)}` : ''}
                  </p>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
