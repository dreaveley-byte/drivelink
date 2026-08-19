'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeExpenseAddAmount, type ExpenseBaselines } from '@/lib/expenses'

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function AdminJobAdjustments({
  jobId,
  driverId,
  currentHoursOverride,
  calculatedDriverPayCents,
  hourlyRateCents,
  approvedExpensesCents,
  baselines,
  existingExpenses,
}: {
  jobId: string
  driverId: string | null
  currentHoursOverride: number | null
  calculatedDriverPayCents: number | null
  hourlyRateCents: number
  approvedExpensesCents: number
  baselines: ExpenseBaselines
  existingExpenses: { category: string; status: string; amount_cents: number }[]
}) {
  const router = useRouter()
  const [hoursInput, setHoursInput] = useState(currentHoursOverride != null ? String(currentHoursOverride) : '')
  const [savingHours, setSavingHours] = useState(false)

  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expCategory, setExpCategory] = useState('other')
  const [expCustomCategory, setExpCustomCategory] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expDescription, setExpDescription] = useState('')
  const [expReceiptFile, setExpReceiptFile] = useState<File | null>(null)
  const [paidByAdminDirectly, setPaidByAdminDirectly] = useState(false)
  const [savingExpense, setSavingExpense] = useState(false)
  const [error, setError] = useState('')

  async function saveHoursOverride() {
    setError('')
    setSavingHours(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const trimmed = hoursInput.trim()
    const hours = trimmed === '' ? null : parseFloat(trimmed)
    if (trimmed !== '' && (isNaN(hours as number) || (hours as number) < 0)) {
      setError('Enter a valid number of hours, or clear the field to remove the override.')
      setSavingHours(false)
      return
    }

    // Deliberately does NOT touch estimated_driver_pay_cents — that field
    // stays as whatever the pricing engine actually calculated, so clearing
    // the override always correctly reveals the true calculated value again
    // rather than whatever was last overridden to. Anywhere driver pay is
    // displayed should show admin_hours_override * hourly rate when the
    // override is set, and estimated_driver_pay_cents otherwise.
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        admin_hours_override: hours,
        admin_hours_override_by: hours != null ? user?.id : null,
        admin_hours_override_at: hours != null ? new Date().toISOString() : null,
        admin_pay_override_cents: hours != null ? Math.round(hours * hourlyRateCents) : null,
      })
      .eq('id', jobId)

    setSavingHours(false)
    if (updateError) {
      setError(`Could not save: ${updateError.message}`)
      return
    }
    router.refresh()
  }

  async function addExpense() {
    setError('')
    const amountCents = Math.round(parseFloat(expAmount || '0') * 100)
    if (!amountCents || amountCents <= 0) {
      setError('Enter a valid amount.')
      return
    }
    if (expCategory === 'other' && !expCustomCategory.trim()) {
      setError('Enter what kind of expense this is.')
      return
    }
    setSavingExpense(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let receiptPath: string | null = null
    if (expReceiptFile) {
      const ext = expReceiptFile.name.split('.').pop() || 'jpg'
      const path = `${jobId}/${Date.now()}-admin.${ext}`
      const { error: uploadError } = await supabase.storage.from('expense-receipts').upload(path, expReceiptFile)
      if (uploadError) {
        setError(`Could not upload receipt photo: ${uploadError.message}`)
        setSavingExpense(false)
        return
      }
      receiptPath = path
    }

    const priorApprovedSameCategoryCents = existingExpenses
      .filter((e) => e.category === expCategory && e.status === 'approved')
      .reduce((sum, e) => sum + e.amount_cents, 0)
    const addAmountCents = computeExpenseAddAmount(expCategory, amountCents, priorApprovedSameCategoryCents, baselines)

    const { error: insertError } = await supabase.from('job_expenses').insert({
      job_id: jobId,
      // If admin paid this directly, it shouldn't flow into the driver's
      // reimbursement (payroll sums expenses by who submitted them) - keep
      // submitted_by as the admin themselves in that case. Otherwise, this
      // is standing in for a receipt the driver forgot to submit, so it
      // needs to be attributed to the actual driver on the job to correctly
      // show up in their reimbursement total.
      submitted_by: paidByAdminDirectly ? user?.id : (driverId ?? user?.id),
      category: expCategory,
      custom_category: expCategory === 'other' ? expCustomCategory.trim() : null,
      description: expDescription || null,
      amount_cents: amountCents,
      receipt_photo_path: receiptPath,
      status: 'approved',
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      approved_addition_cents: addAmountCents,
      added_by_admin: true,
      paid_by_admin_directly: paidByAdminDirectly,
    })

    if (!insertError) {
      await supabase
        .from('jobs')
        .update({ approved_expenses_cents: approvedExpensesCents + addAmountCents })
        .eq('id', jobId)
    }

    setSavingExpense(false)
    if (insertError) {
      setError(`Could not add this expense: ${insertError.message}`)
      return
    }
    setShowAddExpense(false)
    setExpCategory('other')
    setExpCustomCategory('')
    setExpAmount('')
    setExpDescription('')
    setExpReceiptFile(null)
    router.refresh()
  }

  return (
    <div className="border-2 border-gray-900 rounded-xl p-6">
      <p className="text-sm font-medium text-gray-900 mb-1">Admin adjustments</p>
      <p className="text-xs text-gray-500 mb-4">Override driver pay hours or add a charge directly — available any time, not just during the review hold.</p>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1">Override driver-paid hours</label>
        <p className="text-xs text-gray-400 mb-1.5">
          {currentHoursOverride != null
            ? `Currently overridden to ${currentHoursOverride} hrs (${formatCents(Math.round(currentHoursOverride * hourlyRateCents))} at ${formatCents(hourlyRateCents)}/hr). Clear the field and save to go back to the calculated hours.`
            : `Not overridden — using the calculated hours (${calculatedDriverPayCents != null ? formatCents(calculatedDriverPayCents) : '—'} driver pay).`}
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            min="0"
            value={hoursInput}
            onChange={(e) => setHoursInput(e.target.value)}
            placeholder="e.g. 8.5"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={saveHoursOverride}
            disabled={savingHours}
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {savingHours ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100">
        {!showAddExpense ? (
          <button
            onClick={() => setShowAddExpense(true)}
            className="text-sm text-gray-700 hover:text-gray-900 underline"
          >
            + Add a charge directly (no receipt needed)
          </button>
        ) : (
          <div className="space-y-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-700">Add a charge</p>
            <select
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white"
            >
              <option value="wait_time">Wait time</option>
              <option value="fuel">Fuel</option>
              <option value="food">Food</option>
              <option value="repairs">Repairs</option>
              <option value="inspection">Inspection</option>
              <option value="return_transport">Return transport (flight/bus/Uber)</option>
              <option value="tolls">Tolls</option>
              <option value="parking">Parking</option>
              <option value="storage">Storage</option>
              <option value="additional_mileage">Additional mileage</option>
              <option value="hotel">Hotel</option>
              <option value="other">Other</option>
            </select>
            {expCategory === 'other' && (
              <input
                value={expCustomCategory}
                onChange={(e) => setExpCustomCategory(e.target.value)}
                placeholder="What kind of expense is this?"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
              />
            )}
            <input
              type="number"
              step="0.01"
              min="0"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              placeholder="Amount ($)"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
            />
            <input
              value={expDescription}
              onChange={(e) => setExpDescription(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
            />
            <div>
              <label className="block text-xs text-gray-500 mb-1">Receipt photo (optional)</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setExpReceiptFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs"
              />
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={paidByAdminDirectly}
                onChange={(e) => setPaidByAdminDirectly(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Admin paid this directly — don't reimburse the driver
                {paidByAdminDirectly && <span className="block text-gray-400 mt-0.5">Still added to the dealer's bill, just not to the driver's pay.</span>}
              </span>
            </label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={addExpense}
                disabled={savingExpense}
                className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {savingExpense ? 'Adding…' : 'Add expense'}
              </button>
              <button
                onClick={() => setShowAddExpense(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
