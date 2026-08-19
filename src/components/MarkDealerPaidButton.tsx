'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function MarkDealerPaidButton({
  jobId,
  isPaid,
  paidAt,
}: {
  jobId: string
  isPaid: boolean
  paidAt: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function markPaid() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('jobs')
      .update({ dealer_paid_at: new Date().toISOString(), dealer_paid_by: user?.id, dealer_paid_notes: notes || null })
      .eq('id', jobId)
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  async function undoPaid() {
    if (!confirm('Mark this job as unpaid again?')) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('jobs').update({ dealer_paid_at: null, dealer_paid_by: null, dealer_paid_notes: null }).eq('id', jobId)
    setSaving(false)
    router.refresh()
  }

  if (isPaid) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs border border-green-300 text-green-700 rounded-full px-2.5 py-1">
          Dealer paid {paidAt ? new Date(paidAt).toLocaleDateString('en-CA', { dateStyle: 'medium' }) : ''}
        </span>
        <button onClick={undoPaid} disabled={saving} className="text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50">
          Undo
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
      >
        Mark dealer invoice paid
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">Mark dealer invoice as paid</p>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. e-transfer received, invoice #1042"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={markPaid}
                disabled={saving}
                className="flex-1 bg-green-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Confirm paid'}
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
