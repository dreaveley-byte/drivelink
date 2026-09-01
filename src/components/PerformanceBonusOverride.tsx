'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCents } from '@/lib/pricing'

export default function PerformanceBonusOverride({
  jobId,
  computedBonusCents,
  eligible,
  overrideCents,
  allChecklistComplete,
  customerRating,
}: {
  jobId: string
  computedBonusCents: number | null
  eligible: boolean | null
  overrideCents: number | null
  allChecklistComplete: boolean
  customerRating: number | null
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [amountInput, setAmountInput] = useState(overrideCents != null ? (overrideCents / 100).toFixed(2) : '')
  const [error, setError] = useState<string | null>(null)

  async function setOverride(cents: number | null) {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('jobs')
      .update({ performance_bonus_override_cents: cents })
      .eq('id', jobId)
    setSaving(false)
    if (updateError) {
      setError(`Could not update: ${updateError.message}`)
      return
    }
    setShowForm(false)
    router.refresh()
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 mb-4">
      <p className="text-sm font-semibold text-gray-900 mb-2">Performance bonus eligibility</p>
      <ul className="text-xs text-gray-600 space-y-1 mb-3">
        <li>{allChecklistComplete ? '✓' : '✗'} All checklist items completed</li>
        <li>
          {customerRating === 5 ? '✓' : '✗'} 5-star customer rating
          {customerRating != null && customerRating !== 5 && ` (received ${customerRating}★)`}
          {customerRating == null && ' (not yet submitted)'}
        </li>
      </ul>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-gray-600">Computed bonus (auto)</span>
        <span className={eligible ? 'text-green-700 font-medium' : 'text-gray-400'}>
          {computedBonusCents != null ? formatCents(computedBonusCents) : '—'} {eligible === false && '(not eligible)'}
        </span>
      </div>
      {overrideCents != null && (
        <div className="flex items-center justify-between text-sm mb-2 bg-amber-50 -mx-1 px-1 py-1 rounded">
          <span className="text-amber-700">Admin override active</span>
          <span className="text-amber-700 font-semibold">{formatCents(overrideCents)}</span>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {!showForm ? (
        <div className="flex gap-2">
          <button onClick={() => setShowForm(true)} disabled={saving} className="text-xs text-[#378ADD] underline disabled:opacity-50">
            {overrideCents != null ? 'Change override' : 'Override bonus'}
          </button>
          {overrideCents != null && (
            <button onClick={() => setOverride(null)} disabled={saving} className="text-xs text-gray-400 underline disabled:opacity-50">
              {saving ? 'Removing…' : 'Remove override'}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-xs"
          />
          <button
            onClick={() => setOverride(Math.round(parseFloat(amountInput || '0') * 100))}
            disabled={saving || !amountInput}
            className="text-xs bg-[#378ADD] text-white px-2.5 py-1 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => setShowForm(false)} className="text-xs text-gray-500">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
