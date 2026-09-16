'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// A safe alternative to editing status directly in the SQL editor. Unlike a
// raw UPDATE, this always immediately recomputes final_driver_pay_cents
// right after marking the job completed, so the driver's actual pay can
// never get silently locked in at a stale/zero figure the way it could
// before recompute_final_driver_pay() existed - and it logs the change to
// job_status_events, same as the normal driver-completed flow, so there's
// still an audit trail of who actually completed it and when.
export default function AdminForceComplete({
  jobId,
  jobStatus,
  hasDriver,
}: {
  jobId: string
  jobStatus: string
  hasDriver: boolean
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (['completed', 'cancelled'].includes(jobStatus)) return null

  async function complete() {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error: updateError } = await supabase.from('jobs').update({ status: 'completed' }).eq('id', jobId)
    if (updateError) {
      setSaving(false)
      setError(`Could not save: ${updateError.message}`)
      return
    }

    await supabase.from('job_status_events').insert({ job_id: jobId, status: 'completed', changed_by: user?.id })

    // The step a raw SQL UPDATE would silently skip - without this, pay
    // gets locked in at whatever it happened to be at this exact moment,
    // permanently, with no way to correct it later.
    await supabase.rpc('recompute_final_driver_pay', { p_job_id: jobId })

    setSaving(false)
    setConfirming(false)
    router.refresh()
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-medium text-gray-900 mb-1">Force complete</p>
      <p className="text-xs text-gray-400 mb-3">
        Marks this job completed regardless of its current progress, and correctly calculates driver pay in the same
        step. Use this instead of changing status directly in the SQL editor — a direct SQL update skips the pay
        calculation and can leave the driver showing $0.
      </p>
      {!hasDriver ? (
        <p className="text-xs text-gray-400">Assign a driver first — a job can&apos;t be completed with no driver on it.</p>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          Force complete this job
        </button>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {confirming && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5">
            <p className="text-sm font-semibold text-gray-900 mb-2">Force complete this job?</p>
            <p className="text-sm text-gray-600 mb-4">
              This marks it completed immediately, skipping any remaining checklist steps, and calculates the
              driver&apos;s final pay based on the current estimate. This can&apos;t be undone from here.
            </p>
            <div className="flex gap-2">
              <button
                onClick={complete}
                disabled={saving}
                className="flex-1 bg-gray-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Completing…' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
