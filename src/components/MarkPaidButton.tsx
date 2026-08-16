'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCents } from '@/lib/pricing'

export default function MarkPaidButton({
  driverId,
  driverName,
  periodStart,
  periodEnd,
  earningsCents,
  reimbursementsCents,
  drawsCents,
  netOwedCents,
}: {
  driverId: string
  driverName: string | null
  periodStart: string
  periodEnd: string
  earningsCents: number
  reimbursementsCents: number
  drawsCents: number
  netOwedCents: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState((netOwedCents / 100).toFixed(2))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const cents = Math.round(parseFloat(amount) * 100)
    if (Number.isNaN(cents)) {
      setError('Enter a valid amount.')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('mark_driver_paid', {
      p_driver_id: driverId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_earnings_cents: earningsCents,
      p_reimbursements_cents: reimbursementsCents,
      p_draws_deducted_cents: drawsCents,
      p_amount_paid_cents: cents,
      p_notes: notes.trim() || null,
    })
    setSaving(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
      >
        Mark paid ({formatCents(netOwedCents)})
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5">
            <p className="text-sm font-semibold text-gray-900 mb-1">Mark {driverName || 'this driver'} as paid</p>
            <p className="text-xs text-gray-500 mb-3">
              Earnings {formatCents(earningsCents)} + reimbursements {formatCents(reimbursementsCents)}
              {drawsCents > 0 && ` \u2212 draws ${formatCents(drawsCents)}`}
            </p>
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <label className="block text-xs text-gray-500 mb-1">Amount actually paid ($)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
              autoFocus
            />
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. e-transfer sent"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
            />
            <p className="text-xs text-gray-400 mb-3">
              This records the payment, settles any outstanding draws, and marks their reimbursements as paid.
              You still need to actually send the money yourself \u2014 this doesn&apos;t move funds automatically yet.
            </p>
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={saving}
                className="flex-1 bg-green-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving\u2026' : 'Confirm paid'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
