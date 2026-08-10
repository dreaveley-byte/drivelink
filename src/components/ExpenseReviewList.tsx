'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Expense = {
  id: string
  category: string
  description: string | null
  amount_cents: number
  status: string
  receipt_url: string | null
  created_at: string
  submitted_by_name: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  wait_time: 'Wait time',
  repairs: 'Repairs',
  tolls: 'Tolls',
  parking: 'Parking',
  storage: 'Storage',
  additional_mileage: 'Additional mileage',
  other: 'Other',
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function ExpenseReviewList({ jobId, expenses, isAdmin }: { jobId: string; expenses: Expense[]; isAdmin: boolean }) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function review(expenseId: string, approve: boolean, amountCents: number) {
    setLoadingId(expenseId)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('job_expenses')
      .update({
        status: approve ? 'approved' : 'rejected',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', expenseId)

    if (!error && approve) {
      const { data: job } = await supabase.from('jobs').select('approved_expenses_cents').eq('id', jobId).single()
      await supabase
        .from('jobs')
        .update({ approved_expenses_cents: (job?.approved_expenses_cents ?? 0) + amountCents })
        .eq('id', jobId)
    }

    setLoadingId(null)
    if (error) {
      alert(`Could not update this expense: ${error.message}`)
      return
    }
    router.refresh()
  }

  if (expenses.length === 0) return null

  return (
    <div className="border border-gray-200 rounded-xl p-6">
      <p className="text-sm font-medium text-gray-900 mb-3">Submitted expenses</p>
      <div className="space-y-3">
        {expenses.map((exp) => (
          <div key={exp.id} className="flex items-start gap-3 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
            {exp.receipt_url && (
              <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={exp.receipt_url} alt="Receipt" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
              </a>
            )}
            <div className="flex-1">
              <p className="text-sm text-gray-900">
                {CATEGORY_LABELS[exp.category] ?? exp.category} — <span className="font-medium">{formatCents(exp.amount_cents)}</span>
              </p>
              {exp.description && <p className="text-xs text-gray-500">{exp.description}</p>}
              <p className="text-xs text-gray-400">
                {exp.submitted_by_name || 'Driver'} · {new Date(exp.created_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
              {exp.status === 'approved' && <p className="text-xs text-green-600 mt-1">✓ Approved</p>}
              {exp.status === 'rejected' && <p className="text-xs text-red-600 mt-1">✕ Rejected</p>}
              {exp.status === 'pending' && isAdmin && (
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => review(exp.id, true, exp.amount_cents)}
                    disabled={loadingId === exp.id}
                    className="text-xs bg-gray-900 text-white rounded px-2.5 py-1 hover:bg-gray-800 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => review(exp.id, false, exp.amount_cents)}
                    disabled={loadingId === exp.id}
                    className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
              {exp.status === 'pending' && !isAdmin && (
                <p className="text-xs text-amber-600 mt-1">Pending admin review</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
