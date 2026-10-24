'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCents, type AdditionalCharge } from '@/lib/pricing'

type BreakdownLine = { key: string; label: string; amountCents: number; fromBreakdown: boolean; charge?: AdditionalCharge }

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
  markupPercent,
  minimumDriverPayCents,
  initialDriverPayCents,
}: {
  jobId: string
  initialBreakdown: Record<string, number> | null
  initialCharges: AdditionalCharge[]
  markupPercent: number
  minimumDriverPayCents: number
  initialDriverPayCents: number | null
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
      charge: c,
    }))
    return [...fromBreakdown, ...fromCharges]
  })

  const [driverPayInput, setDriverPayInput] = useState(
    initialDriverPayCents != null ? (initialDriverPayCents / 100).toFixed(2) : ''
  )

  // The lines are the cost BEFORE markup - the same way the job's price is
  // first calculated - so the dealer is billed the lines' total x markup.
  // Saving the plain total (as this editor used to) silently dropped the
  // markup from the whole quote.
  const total = lines.reduce((sum, l) => sum + l.amountCents, 0)
  const dealerCostCents = Math.round(total * (markupPercent / 100))

  // Driver pay follows the same hours the dealer is billed for, plus wear &
  // tear and any overnight fee, never below the minimum pay.
  const lineAmount = (key: string) => lines.find((l) => l.key === key)?.amountCents ?? 0
  const suggestedDriverPayCents = Math.max(
    lineAmount('hourlyDealerCents') + lineAmount('wearAndTearCents') + lineAmount('overnightFeeCents'),
    minimumDriverPayCents
  )

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

    const driverPayCents = driverPayInput.trim() === '' ? null : Math.round(parseFloat(driverPayInput) * 100)
    if (driverPayCents != null && (!Number.isFinite(driverPayCents) || driverPayCents < 0)) {
      setSaving(false)
      setError('Driver pay must be a dollar amount of 0 or more.')
      return
    }

    // Start from the full saved breakdown and only change the lines shown
    // here. Rebuilding it from just these lines (as before) threw away
    // everything else stored in it, such as the calculated driver pay.
    const newBreakdown: Record<string, number> = { ...(initialBreakdown ?? {}) }
    for (const [key] of BREAKDOWN_LABELS) {
      const line = lines.find((l) => l.key === key)
      newBreakdown[key] = line ? line.amountCents : 0
    }
    newBreakdown.costBasisCents = total
    newBreakdown.estimatedDealerCostCents = dealerCostCents
    if (driverPayCents != null) newBreakdown.estimatedDriverPayCents = driverPayCents

    const newCharges: AdditionalCharge[] = lines
      .filter((l) => !l.fromBreakdown)
      .map((l) => ({
        hoursAdded: 0,
        paidToDriver: false,
        ...(l.charge ?? {}),
        description: l.label,
        dealerAmountCents: l.amountCents,
      }))

    const { data: updatedRows, error: updateError } = await supabase
      .from('jobs')
      .update({
        pricing_breakdown: JSON.stringify(newBreakdown),
        additional_charges: newCharges,
      })
      .eq('id', jobId)
      .select('id')

    if (updateError || !updatedRows || updatedRows.length === 0) {
      setSaving(false)
      setError(`Could not save: ${updateError?.message ?? 'no job was updated'}`)
      return
    }

    // Dealer cost and driver pay go through the audited admin function, which
    // also clears any driver pay override that would otherwise hide the new figure.
    const { error: amountsError } = await supabase.rpc('admin_set_job_amounts', {
      p_job_id: jobId,
      p_dealer_cost_cents: dealerCostCents,
      p_driver_pay_cents: driverPayCents,
      p_reason: 'Quote edited on the job edit page',
    })

    setSaving(false)
    if (amountsError) {
      setError(`The line items saved but the totals did not: ${amountsError.message}`)
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

      <div className="flex justify-between text-xs text-gray-500 pt-2 mt-2 border-t border-gray-200">
        <span>Lines total (before markup)</span>
        <span>{formatCents(total)}</span>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>Markup ({markupPercent}%)</span>
        <span>{formatCents(dealerCostCents - total)}</span>
      </div>
      <div className="flex justify-between text-sm pt-1">
        <span className="text-gray-900 font-medium">New dealer cost</span>
        <span className="text-gray-900 font-semibold">{formatCents(dealerCostCents)}</span>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Driver pay (what the driver sees)</p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">$</span>
          <input
            type="number"
            step="0.01"
            value={driverPayInput}
            onChange={(e) => setDriverPayInput(e.target.value)}
            className="w-24 text-xs border border-gray-300 rounded px-2 py-1 bg-white"
          />
          <button
            type="button"
            onClick={() => setDriverPayInput((suggestedDriverPayCents / 100).toFixed(2))}
            className="text-xs text-blue-600 hover:underline"
          >
            Use suggested {formatCents(suggestedDriverPayCents)}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          Suggested = hourly line + wear &amp; tear + overnight fee, at least the {formatCents(minimumDriverPayCents)} minimum. Saving also clears any driver pay override.
        </p>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-2 text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save adjusted quote'}
      </button>
    </div>
  )
}
