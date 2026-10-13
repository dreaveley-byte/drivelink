'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

type AuditRow = {
  id: string
  changed_at: string
  reason: string
  old_dealer_cost_cents: number | null
  new_dealer_cost_cents: number | null
  old_driver_pay_cents: number | null
  new_driver_pay_cents: number | null
  cleared_pay_override: boolean
  changed_by_name: string | null
}

// Lets admin see at a glance whether this job is actually billing the dealer
// and paying the driver, and fix either figure directly at ANY status
// (including a job that's already started or completed). Every change needs
// a reason and is logged, so a correction is never a silent edit.
export default function AdminBillingCorrection({
  jobId,
  jobStatus,
  hasDriver,
  dealerCostCents,
  driverPayCents,
  suggestedDealerCents,
  suggestedDriverCents,
  hasPayOverride,
  audit,
}: {
  jobId: string
  jobStatus: string
  hasDriver: boolean
  /** estimated_dealer_cost_cents as currently stored */
  dealerCostCents: number | null
  /** the driver pay the receipt is actually using right now */
  driverPayCents: number | null
  /** what the saved pricing breakdown says it should be, if one exists */
  suggestedDealerCents: number | null
  suggestedDriverCents: number | null
  hasPayOverride: boolean
  audit: AuditRow[]
}) {
  const router = useRouter()
  const [dealerInput, setDealerInput] = useState('')
  const [driverInput, setDriverInput] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const dealerMissing = (dealerCostCents ?? 0) <= 0
  const driverMissing = (driverPayCents ?? 0) <= 0
  const started = ['assigned', 'picked_up', 'in_progress', 'delivered', 'completed'].includes(jobStatus)
  const problem = started && hasDriver && (dealerMissing || driverMissing)

  const dealerDiffers = suggestedDealerCents != null && dealerCostCents != null && dealerCostCents > 0 && Math.abs(suggestedDealerCents - dealerCostCents) > 1
  const driverDiffers = suggestedDriverCents != null && driverPayCents != null && driverPayCents > 0 && !hasPayOverride && Math.abs(suggestedDriverCents - driverPayCents) > 1

  function parseDollars(raw: string): number | null | 'invalid' {
    const t = raw.trim()
    if (t === '') return null
    const n = parseFloat(t)
    if (isNaN(n) || n < 0) return 'invalid'
    return Math.round(n * 100)
  }

  async function save() {
    setError('')
    setSaved(false)
    const dealer = parseDollars(dealerInput)
    const driver = parseDollars(driverInput)
    if (dealer === 'invalid' || driver === 'invalid') {
      setError('Enter valid dollar amounts (0 or more), or leave a field blank to leave it unchanged.')
      return
    }
    if (dealer === null && driver === null) {
      setError('Enter a dealer charge, a driver pay, or both.')
      return
    }
    if (!reason.trim()) {
      setError('Add a short reason - it is saved with the change.')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('admin_set_job_amounts', {
      p_job_id: jobId,
      p_dealer_cost_cents: dealer,
      p_driver_pay_cents: driver,
      p_reason: reason.trim(),
    })
    setSaving(false)
    if (rpcError) {
      setError(`Could not save: ${rpcError.message}`)
      return
    }
    setSaved(true)
    setDealerInput('')
    setDriverInput('')
    setReason('')
    router.refresh()
  }

  return (
    <div className={`rounded-xl p-6 mb-4 border-2 ${problem ? 'border-red-500 bg-red-50' : 'border-gray-900'}`}>
      <p className="text-sm font-medium text-gray-900 mb-1">Billing &amp; pay check</p>

      {problem && (
        <p className="text-sm text-red-700 font-medium mb-3">
          ⚠️ {dealerMissing && driverMissing
            ? 'The dealer is not being billed AND the driver is not being paid on this job.'
            : dealerMissing
              ? 'The dealer is not being billed for this job.'
              : 'The driver is not being paid for this job.'}{' '}
          Set the correct amounts below.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">Dealer charge (before extras)</p>
          <p className={`font-semibold ${dealerMissing ? 'text-red-600' : 'text-gray-900'}`}>
            {dealerCostCents != null ? formatCents(dealerCostCents) : 'Not set'}
          </p>
          {suggestedDealerCents != null && (
            <p className={`text-xs mt-1 ${dealerDiffers || dealerMissing ? 'text-amber-700' : 'text-gray-400'}`}>
              Saved pricing says {formatCents(suggestedDealerCents)}
            </p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-0.5">Driver pay (before expenses/bonus)</p>
          <p className={`font-semibold ${driverMissing ? 'text-red-600' : 'text-gray-900'}`}>
            {driverPayCents != null ? formatCents(driverPayCents) : 'Not set'}
          </p>
          {suggestedDriverCents != null && (
            <p className={`text-xs mt-1 ${driverDiffers || driverMissing ? 'text-amber-700' : 'text-gray-400'}`}>
              Saved pricing says {formatCents(suggestedDriverCents)}
            </p>
          )}
        </div>
      </div>

      {(dealerDiffers || driverDiffers) && !problem && (
        <p className="text-xs text-amber-700 mb-3">
          The amounts above differ from the saved pricing breakdown. That can be intentional (an override or later edit), but worth a look if it isn&apos;t.
        </p>
      )}

      {(dealerMissing || driverMissing) && !started && (
        <p className="text-xs text-gray-500 mb-3">This job hasn&apos;t been claimed yet, so these amounts may still be filled in when it&apos;s posted or edited.</p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Set dealer charge ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={dealerInput}
            onChange={(e) => setDealerInput(e.target.value)}
            placeholder={suggestedDealerCents != null ? (suggestedDealerCents / 100).toFixed(2) : 'leave blank = no change'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Set driver pay ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={driverInput}
            onChange={(e) => setDriverInput(e.target.value)}
            placeholder={suggestedDriverCents != null ? (suggestedDriverCents / 100).toFixed(2) : 'leave blank = no change'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>
      </div>
      {hasPayOverride && (
        <p className="text-xs text-gray-500 mb-2">
          An hours override is currently active on this job. Setting a driver pay here replaces it.
        </p>
      )}
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required, e.g. recalculation didn't save after drive started)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 bg-white"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save correction'}
        </button>
        {saved && <span className="text-xs text-green-700">✓ Saved</span>}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {audit.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Correction history</p>
          <div className="space-y-2">
            {audit.map((a) => (
              <div key={a.id} className="text-xs text-gray-600">
                <p>
                  {new Date(a.changed_at).toLocaleString('en-CA', { timeZone: 'America/Vancouver', dateStyle: 'medium', timeStyle: 'short' })}
                  {a.changed_by_name ? ` · ${a.changed_by_name}` : ''}
                </p>
                {a.new_dealer_cost_cents !== a.old_dealer_cost_cents && (
                  <p>Dealer charge: {a.old_dealer_cost_cents != null ? formatCents(a.old_dealer_cost_cents) : 'not set'} → {a.new_dealer_cost_cents != null ? formatCents(a.new_dealer_cost_cents) : 'not set'}</p>
                )}
                {a.new_driver_pay_cents !== a.old_driver_pay_cents && (
                  <p>Driver pay: {a.old_driver_pay_cents != null ? formatCents(a.old_driver_pay_cents) : 'not set'} → {a.new_driver_pay_cents != null ? formatCents(a.new_driver_pay_cents) : 'not set'}{a.cleared_pay_override ? ' (hours override cleared)' : ''}</p>
                )}
                <p className="text-gray-400">Reason: {a.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
