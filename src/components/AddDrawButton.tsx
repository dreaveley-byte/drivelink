'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AddDrawButton({ driverId, driverName }: { driverId: string; driverName: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const cents = Math.round(parseFloat(amount) * 100)
    if (!cents || cents <= 0) {
      setError('Enter a valid amount.')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('driver_draws').insert({
      driver_id: driverId,
      amount_cents: cents,
      note: note.trim() || null,
      created_by: user?.id,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setOpen(false)
    setAmount('')
    setNote('')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
      >
        + Add draw
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5">
            <p className="text-sm font-semibold text-gray-900 mb-1">Record a draw</p>
            <p className="text-xs text-gray-500 mb-3">
              For {driverName || 'this driver'} — this amount will be deducted from their next payout.
            </p>
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
              autoFocus
            />
            <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. requested for personal expense"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={saving}
                className="flex-1 bg-[#378ADD] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Record draw'}
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
