'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCents, type AdditionalCharge } from '@/lib/pricing'

type BreakdownLine = { key: string; label: string; amountCents: number; fromBreakdown: boolean }

const BREAKDOWN_LABELS: [string, string][] = [
  ['gasCostCents', 'Fuel'],
  ['mealCostCents', 'Meals'],
  ['wearAndTearCents', 'Wear & tear'],
  ['trailerFeeCents', 'Trailer fee'],
  ['hotelCents', 'Hotel'],
  ['overnightFeeCents', 'Overnight fee'],
  ['inspectionFeeCents', 'Inspection fee'],
  ['registryFeeCents', 'Registry fee'],
  ['ferryFeeCents', 'Ferry fee'],
  ['garageInsuranceFeeCents', 'Drivflo insurance'],
  ['hourlyDealerCents', 'Hourly (dealer-billed)'],
  ['extrasDealerCents', 'Other extras'],
]

export default function AdminQuoteEditor({
  jobId,
  initialBreakdown,
  initialCharges,
}: {
  jobId: string
  initialBreakdown: Record<string, number> | null
  initialCharges: AdditionalCharge[]
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [lines, setLines] = useState<BreakdownLine[]>(() => {
    const fromBreakdown: BreakdownLine[] = BREAKDOWN_LABELS
      .filter(([key]) => initialBreakdown && initialBreakdown[key])
      .map(([key, label]) => ({ key, label, amountCents: initialBreakdown![key], fromBreakdown: true }))
    const fromCharges: BreakdownLine[] = initialCharges.map((c, i) => ({
      key: `charge-${i}`,
      label: c.description,
      amountCents: c.dealerAmountCents,
      fromBreakdown: false,
    }))
    return [...fromBreakdown, ...fromCharges]
  })

  const total = lines.reduce((sum, l) => sum + l.amountCents, 0)

  function updateAmount(key: string, dollarValue: string) {
    const cents = Math.round((parseFloat(dollarValue) || 0) * 100)
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, amountCents: cents } : l)))
  }

  function updateLabel(key: string, label: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, label } : l)))
  }

  function deleteLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  function addLine() {
    setLines((prev) => [...prev, { key: `new-${Date.now()}`, label: '', amountCents: 0, fromBreakdown: false }])
  }

  async function save() {
    setError('')
    if (lines.some((l) => !l.label.trim())) {
      setError('Every line needs a label.')
      return
    }
    setSaving(true)
    const supabase = createClient()

    const newBreakdown: Record<string, number> = {}
    for (const l of lines) {
      if (l.fromBreakdown) newBreakdown[l.key] = l.amountCents
    }
    const newCharges: AdditionalCharge[] = lines
      .filter((l) => !l.fromBreakdown)
      .map((l) => ({ description: l.label, dealerAmountCents: l.amountCents, hoursAdded: 0, paidToDriver: false }))

    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        pricing_breakdown: JSON.stringify(newBreakdown),
        additional_charges: newCharges,
        estimated_dealer_cost_cents: total,
      })
      .eq('id', jobId)

    setSaving(false)
    if (updateError) {
      setError(`Could not save: ${updateError.message}`)
      return
    }
    window.location.reload()
  }

  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mt-1 mb-1">Quote breakdown (editable)</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-1.5">
        {lines.map((l) => (
          <div key={l.key} className="flex items-center gap-1.5">
            <input
              value={l.label}
              onChange={(e) => updateLabel(l.key, e.target.value)}
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 bg-white"
              placeholder="Description"
            />
            <span className="text-xs text-gray-400">$</span>
            <input
              type="number"
              step="0.01"
              value={(l.amountCents / 100).toFixed(2)}
              onChange={(e) => updateAmount(l.key, e.target.value)}
              className="w-20 text-xs border border-gray-300 rounded px-2 py-1 bg-white"
            />
            <button onClick={() => deleteLine(l.key)} className="text-xs text-red-500 hover:text-red-700 underline px-1">Delete</button>
          </div>
        ))}
      </div>
      <button onClick={addLine} className="text-xs text-blue-600 hover:underline mt-2">+ Add line item</button>

      <div className="flex justify-between text-sm pt-2 mt-2 border-t border-gray-200">
        <span className="text-gray-900 font-medium">New dealer cost</span>
        <span className="text-gray-900 font-semibold">{formatCents(total)}</span>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-2 text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Saving\u2026' : 'Save adjusted quote'}
      </button>
    </div>
  )
}
