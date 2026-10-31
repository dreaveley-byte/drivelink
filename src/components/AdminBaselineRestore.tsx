'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

type Baselines = {
  fuel: number
  inspection: number
  food: number
  hotel: number
  ferry: number
  return_transport: number
  // Only present once the car wash accrual migration has been run.
  car_wash?: number
}

const ALL_FIELDS: { key: keyof Baselines; label: string }[] = [
  { key: 'fuel', label: 'Fuel' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'food', label: 'Food' },
  { key: 'hotel', label: 'Hotel' },
  { key: 'ferry', label: 'Ferry' },
  { key: 'return_transport', label: 'Return transport' },
  { key: 'car_wash', label: 'Car wash' },
]

// The "accrued" baselines are what was already priced into the dealer's quote
// for each cost category. Approved receipts are only billed to the dealer
// where they go OVER these amounts - so if they've been wiped to $0, every
// receipt gets billed in full on top of a quote that already covered it.
// This lets admin restore them (pre-filled from the job's saved pricing when
// it exists) and immediately re-bills every approved receipt against them.
export default function AdminBaselineRestore({
  jobId,
  current,
  saved,
  dealerPaid,
}: {
  jobId: string
  current: Baselines
  /** what the job's saved pricing breakdown says each baseline should be, or null if no breakdown was saved */
  saved: Baselines | null
  dealerPaid: boolean
}) {
  const router = useRouter()
  // Car wash is only editable once the job actually has that baseline (i.e. the migration is in).
  const FIELDS = ALL_FIELDS.filter((f) => f.key !== 'car_wash' || current.car_wash !== undefined)
  const initial = (b: Baselines | null) =>
    Object.fromEntries(FIELDS.map((f) => [f.key, b ? ((b[f.key] ?? 0) / 100).toFixed(2) : ''])) as Record<keyof Baselines, string>

  const [values, setValues] = useState<Record<keyof Baselines, string>>(initial(saved ?? current))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved_, setSavedOk] = useState(false)

  const currentTotal = FIELDS.reduce((s, f) => s + (current[f.key] ?? 0), 0)
  const savedTotal = saved ? FIELDS.reduce((s, f) => s + (saved[f.key] ?? 0), 0) : 0
  const looksWiped = currentTotal === 0 && savedTotal > 0
  const differsFromSaved = !!saved && FIELDS.some((f) => (saved[f.key] ?? 0) !== (current[f.key] ?? 0))

  async function save() {
    setError('')
    setSavedOk(false)
    const cents: Record<string, number | null> = {}
    for (const f of FIELDS) {
      const raw = values[f.key].trim()
      if (raw === '') {
        cents[f.key] = null
        continue
      }
      const n = parseFloat(raw)
      if (isNaN(n) || n < 0) {
        setError(`${f.label}: enter a valid dollar amount (0 or more), or leave it blank to keep it unchanged.`)
        return
      }
      cents[f.key] = Math.round(n * 100)
    }
    if (!reason.trim()) {
      setError('Add a short reason - it is saved with the change.')
      return
    }
    if (dealerPaid && !window.confirm('The dealer has already been marked as paid for this job. Changing the baselines will change the total billed to them. Continue?')) {
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('admin_set_job_baselines', {
      p_job_id: jobId,
      p_fuel: cents.fuel,
      p_inspection: cents.inspection,
      p_food: cents.food,
      p_hotel: cents.hotel,
      p_ferry: cents.ferry,
      p_return_transport: cents.return_transport,
      ...(current.car_wash !== undefined ? { p_car_wash: cents.car_wash } : {}),
      p_reason: reason.trim(),
    })
    setSaving(false)
    if (rpcError) {
      setError(`Could not save: ${rpcError.message}`)
      return
    }
    setSavedOk(true)
    setReason('')
    router.refresh()
  }

  return (
    <div className={`rounded-xl p-6 mb-4 border-2 ${looksWiped ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}>
      <p className="text-sm font-medium text-gray-900 mb-1">Accrued baselines (already priced into the dealer&apos;s quote)</p>
      {looksWiped ? (
        <p className="text-sm text-red-700 font-medium mb-3">
          ⚠️ Every baseline on this job is $0, but its saved pricing shows {formatCents(savedTotal)} was priced in. That usually means a
          recalculation wiped them - and it makes every approved receipt get billed to the dealer in full on top of the quote.
        </p>
      ) : differsFromSaved ? (
        <p className="text-xs text-amber-700 mb-3">The current baselines differ from this job&apos;s saved pricing. That can be intentional - the saved values are pre-filled below.</p>
      ) : (
        <p className="text-xs text-gray-500 mb-3">These match the job&apos;s saved pricing. Only change them if something is clearly wrong.</p>
      )}
      {!saved && (
        <p className="text-xs text-gray-500 mb-3">No saved pricing breakdown on this job, so there&apos;s nothing to pre-fill - enter the amounts that were in the quote.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-xs text-gray-500 mb-1">
              {f.label} <span className="text-gray-400">(now {formatCents(current[f.key] ?? 0)})</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder="no change"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
            />
          </div>
        ))}
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required, e.g. baselines were wiped by a failed recalculation)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 bg-white"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Restore baselines & re-bill receipts'}
        </button>
        {saved_ && <span className="text-xs text-green-700">✓ Saved - the dealer&apos;s total has been recalculated</span>}
      </div>
      <p className="text-xs text-gray-400 mt-2">Saving re-checks every approved receipt against these amounts and updates what the dealer is billed.</p>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
