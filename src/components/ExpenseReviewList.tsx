'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Expense = {
  id: string
  category: string
  custom_category: string | null
  description: string | null
  amount_cents: number
  status: string
  receipt_url: string | null
  created_at: string
  submitted_by_name: string | null
  approved_addition_cents?: number | null
  added_by_admin?: boolean
}

type Baselines = { fuel: number; inspection: number; food: number }

const CATEGORY_LABELS: Record<string, string> = {
  wait_time: 'Wait time',
  fuel: 'Fuel',
  food: 'Food',
  repairs: 'Repairs',
  inspection: 'Inspection',
  tolls: 'Tolls',
  parking: 'Parking',
  storage: 'Storage',
  additional_mileage: 'Additional mileage',
  return_transport: 'Return transport (Uber/bus back)',
  other: 'Other',
}

// Fuel, inspection, and food are already budgeted for in the base job price.
// A receipt in one of these categories should only add to the job's total if
// (and to the extent) the driver's actual cost exceeded what was already
// priced in — food specifically should never add anything at all, per policy.
const BASELINE_CATEGORIES = ['fuel', 'inspection', 'food'] as const

function categoryLabel(exp: Expense) {
  if (exp.category === 'other' && exp.custom_category) return exp.custom_category
  return CATEGORY_LABELS[exp.category] ?? exp.category
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

// How much approving this specific expense would actually add to the job's
// total, given everything already approved in the same category so far.
function computeAddAmount(expense: Expense, allExpenses: Expense[], baselines: Baselines): number {
  if (expense.category === 'food') return 0
  if (expense.category !== 'fuel' && expense.category !== 'inspection') return expense.amount_cents

  const baseline = baselines[expense.category as 'fuel' | 'inspection']
  const priorApprovedSum = allExpenses
    .filter((e) => e.category === expense.category && e.status === 'approved' && e.id !== expense.id)
    .reduce((sum, e) => sum + e.amount_cents, 0)
  const newSum = priorApprovedSum + expense.amount_cents
  return Math.max(0, newSum - baseline) - Math.max(0, priorApprovedSum - baseline)
}

export default function ExpenseReviewList({
  jobId,
  expenses,
  isAdmin,
  baselines,
}: {
  jobId: string
  expenses: Expense[]
  isAdmin: boolean
  baselines: Baselines
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCategory, setEditCategory] = useState('')
  const [editCustomCategory, setEditCustomCategory] = useState('')

  function startEdit(exp: Expense) {
    setEditingId(exp.id)
    setEditCategory(exp.category)
    setEditCustomCategory(exp.custom_category ?? '')
  }

  async function saveCategory(expenseId: string) {
    setLoadingId(expenseId)
    const supabase = createClient()
    const { error } = await supabase
      .from('job_expenses')
      .update({ category: editCategory, custom_category: editCategory === 'other' ? (editCustomCategory || null) : null })
      .eq('id', expenseId)
    setLoadingId(null)
    if (error) {
      alert(`Could not update category: ${error.message}`)
      return
    }
    setEditingId(null)
    router.refresh()
  }

  async function review(expense: Expense, approve: boolean) {
    setLoadingId(expense.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const addAmount = approve ? computeAddAmount(expense, expenses, baselines) : 0

    const { error } = await supabase
      .from('job_expenses')
      .update({
        status: approve ? 'approved' : 'rejected',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        approved_addition_cents: approve ? addAmount : null,
      })
      .eq('id', expense.id)

    if (!error && approve && addAmount > 0) {
      const { data: job } = await supabase.from('jobs').select('approved_expenses_cents').eq('id', jobId).single()
      await supabase
        .from('jobs')
        .update({ approved_expenses_cents: (job?.approved_expenses_cents ?? 0) + addAmount })
        .eq('id', jobId)
    }

    setLoadingId(null)
    if (error) {
      alert(`Could not update this expense: ${error.message}`)
      return
    }
    router.refresh()
  }

  // Reverts an approve/reject decision back to pending — for when a button
  // was tapped by accident. Subtracts back exactly what was added at approval
  // time (stored on the row), so this can never drift out of sync.
  async function undoReview(expense: Expense) {
    setLoadingId(expense.id)
    const supabase = createClient()

    const { error } = await supabase
      .from('job_expenses')
      .update({ status: 'pending', reviewed_by: null, reviewed_at: null, approved_addition_cents: null })
      .eq('id', expense.id)

    const addedAmount = expense.approved_addition_cents ?? 0
    if (!error && addedAmount > 0) {
      const { data: job } = await supabase.from('jobs').select('approved_expenses_cents').eq('id', jobId).single()
      await supabase
        .from('jobs')
        .update({ approved_expenses_cents: Math.max(0, (job?.approved_expenses_cents ?? 0) - addedAmount) })
        .eq('id', jobId)
    }

    setLoadingId(null)
    if (error) {
      alert(`Could not undo this: ${error.message}`)
      return
    }
    router.refresh()
  }

  // Deletes an expense outright (not just reject) — for admin-added charges
  // entered in error, or any entry that shouldn't exist on the job at all.
  async function deleteExpense(expense: Expense) {
    if (!confirm('Delete this expense entirely? This cannot be undone.')) return
    setLoadingId(expense.id)
    const supabase = createClient()

    const addedAmount = expense.approved_addition_cents ?? 0
    const { error } = await supabase.from('job_expenses').delete().eq('id', expense.id)

    if (!error && addedAmount > 0) {
      const { data: job } = await supabase.from('jobs').select('approved_expenses_cents').eq('id', jobId).single()
      await supabase
        .from('jobs')
        .update({ approved_expenses_cents: Math.max(0, (job?.approved_expenses_cents ?? 0) - addedAmount) })
        .eq('id', jobId)
    }

    setLoadingId(null)
    if (error) {
      alert(`Could not delete this expense: ${error.message}`)
      return
    }
    router.refresh()
  }

  if (expenses.length === 0) return null

  return (
    <div className="border border-gray-200 rounded-xl p-6">
      <p className="text-sm font-medium text-gray-900 mb-3">Submitted expenses</p>
      <div className="space-y-3">
        {expenses.map((exp) => {
          const isBaselineCategory = (BASELINE_CATEGORIES as readonly string[]).includes(exp.category)
          const previewAddAmount = exp.status === 'pending' ? computeAddAmount(exp, expenses, baselines) : null
          return (
            <div key={exp.id} className="flex items-start gap-3 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
              {exp.receipt_url && (
                <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={exp.receipt_url} alt="Receipt" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
                </a>
              )}
              <div className="flex-1">
                {editingId === exp.id ? (
                  <div className="flex items-center gap-2 mb-1">
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    {editCategory === 'other' && (
                      <input
                        value={editCustomCategory}
                        onChange={(e) => setEditCustomCategory(e.target.value)}
                        placeholder="Describe category"
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                      />
                    )}
                    <button
                      onClick={() => saveCategory(exp.id)}
                      disabled={loadingId === exp.id}
                      className="text-xs bg-gray-900 text-white rounded px-2.5 py-1 hover:bg-gray-800 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-900">
                    {categoryLabel(exp)} — <span className="font-medium">{formatCents(exp.amount_cents)}</span>
                    {isAdmin && exp.status === 'pending' && (
                      <button onClick={() => startEdit(exp)} className="text-xs text-blue-600 hover:underline ml-2">
                        Change category
                      </button>
                    )}
                  </p>
                )}
                {exp.description && <p className="text-xs text-gray-500">{exp.description}</p>}
                {isBaselineCategory && exp.status === 'pending' && isAdmin && (
                  <p className="text-xs text-gray-400">
                    {exp.category === 'food'
                      ? 'Food is already covered by the base price — approving this won\u2019t add to the total.'
                      : previewAddAmount === 0
                      ? `Covered by the ${formatCents(baselines[exp.category as 'fuel' | 'inspection'])} already priced in — approving this won't add to the total.`
                      : `Only the amount beyond what's already priced in (${formatCents(baselines[exp.category as 'fuel' | 'inspection'])}) will be added — approving this adds ${formatCents(previewAddAmount ?? 0)}.`}
                  </p>
                )}
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  {exp.added_by_admin ? 'Added by admin' : (exp.submitted_by_name || 'Driver')} · {new Date(exp.created_at).toLocaleString('en-CA', { timeZone: 'America/Vancouver', dateStyle: 'medium', timeStyle: 'short' })}
                  {isAdmin && (
                    <button
                      onClick={() => deleteExpense(exp)}
                      disabled={loadingId === exp.id}
                      className="text-red-500 hover:text-red-700 underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </p>
                {exp.status === 'approved' && isAdmin && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-green-600">
                      ✓ Approved{!!exp.approved_addition_cents && exp.approved_addition_cents !== exp.amount_cents && ` (added ${formatCents(exp.approved_addition_cents)})`}
                      {exp.approved_addition_cents === 0 && ' (no charge added — covered by base price)'}
                    </p>
                    <button
                      onClick={() => undoReview(exp)}
                      disabled={loadingId === exp.id}
                      className="text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50"
                    >
                      Undo
                    </button>
                  </div>
                )}
                {exp.status === 'approved' && !isAdmin && <p className="text-xs text-green-600 mt-1">✓ Approved</p>}
                {exp.status === 'rejected' && isAdmin && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-red-600">✕ Rejected</p>
                    <button
                      onClick={() => undoReview(exp)}
                      disabled={loadingId === exp.id}
                      className="text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50"
                    >
                      Undo
                    </button>
                  </div>
                )}
                {exp.status === 'rejected' && !isAdmin && <p className="text-xs text-red-600 mt-1">✕ Rejected</p>}
                {exp.status === 'pending' && isAdmin && (
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => review(exp, true)}
                      disabled={loadingId === exp.id}
                      className="text-xs bg-gray-900 text-white rounded px-2.5 py-1 hover:bg-gray-800 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => review(exp, false)}
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
          )
        })}
      </div>
    </div>
  )
}
