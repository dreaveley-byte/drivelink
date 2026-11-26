'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCents } from '@/lib/pricing'

type Preview = {
  net_six_cents: number
  food_pool_cents: number
  pool_cents: number
  other_additions_cents: number
  dealer_overage_cents: number
  credit_issued_cents: number
  credit_available_cents: number
}

// Admin sign-off on a completed drive's final bill. Until approved, the dealer
// sees only the original estimate. Approving bills any net overage, issues the
// dealer's profit-share credit (if there's a net underage) and applies any
// credit the dealer already has. Safe to run again after an edit.
export default function AdminFinalBillReview({
  jobId,
  approvedAt,
  preview,
  estimateCents,
  idleCents,
  creditIssuedCents,
  creditAppliedCents,
  sharePercent,
}: {
  jobId: string
  approvedAt: string | null
  preview: Preview | null
  estimateCents: number
  idleCents: number
  creditIssuedCents: number
  creditAppliedCents: number
  sharePercent: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function approve() {
    setBusy(true)
    setError(null)
    const { error: e } = await createClient().rpc('approve_final_bill', { p_job_id: jobId })
    setBusy(false)
    if (e) setError(e.message)
    else router.refresh()
  }

  const pool = preview?.pool_cents ?? 0
  const total = estimateCents + (preview?.dealer_overage_cents ?? 0) + idleCents
  const wouldApply = Math.min(preview?.credit_available_cents ?? 0, Math.max(0, total))

  return (
    <div className={`max-w-2xl mx-auto px-6 pb-4 print:hidden`}>
      <div className={`border rounded-xl p-6 ${approvedAt ? 'border-green-200 bg-green-50/40' : 'border-amber-300 bg-amber-50/50'}`}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <p className="text-sm font-medium text-gray-900">Final bill review</p>
          <span className={`text-xs border rounded-full px-2.5 py-1 ${approvedAt ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>
            {approvedAt ? `Approved ${new Date(approvedAt).toLocaleString('en-CA', { timeZone: 'America/Vancouver', dateStyle: 'medium', timeStyle: 'short' })}` : 'Awaiting your approval'}
          </span>
        </div>

        {preview ? (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Fuel, inspection, hotel, ferry, return transport &amp; car wash (baseline − actual)</span><span className={preview.net_six_cents < 0 ? 'text-red-600' : 'text-gray-900'}>{formatCents(preview.net_six_cents)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Unused meal budget after the driver&apos;s bonus</span><span className="text-gray-900">{formatCents(preview.food_pool_cents)}</span></div>
            <div className="flex justify-between pt-1 border-t border-gray-200"><span className="text-gray-900 font-medium">Net {pool >= 0 ? 'underage (profit pool)' : 'overage'}</span><span className={`font-medium ${pool < 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCents(pool)}</span></div>
            {preview.other_additions_cents > 0 && (
              <div className="flex justify-between"><span className="text-gray-600">Other approved expenses billed in full (repairs, tolls…)</span><span className="text-gray-900">+{formatCents(preview.other_additions_cents)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-600">Dealer billed on top of estimate</span><span className="text-gray-900 font-medium">+{formatCents(preview.dealer_overage_cents)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Credit to the dealer for the next drive ({sharePercent}% of profit pool)</span><span className="text-green-700 font-medium">{formatCents(approvedAt ? creditIssuedCents : preview.credit_issued_cents)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Existing dealer credit applied to this bill</span><span className="text-green-700 font-medium">-{formatCents(approvedAt ? creditAppliedCents : wouldApply)}</span></div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No figures available yet.</p>
        )}

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <button onClick={approve} disabled={busy} className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {busy ? 'Working…' : approvedAt ? 'Re-approve after changes' : 'Approve final bill'}
          </button>
          <p className="text-xs text-gray-500">The dealer sees the overage, credit and final total only after approval. Driver pay is unaffected.</p>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  )
}
