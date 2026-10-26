'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STATUS_LABELS: Record<string, string> = {
  awaiting_driver: 'Awaiting Driver',
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  in_progress: 'In Progress',
  delivered: 'Delivered',
}

// Undo for a job that was completed by mistake (e.g. a force-complete on a
// drive that is still going). Puts it back to the status it had just before,
// clears the completion date and locked-in final pay, and logs the change.
// compact: a small button for job cards. showUntil: epoch ms after which the
// button hides itself (used for the short undo window on the admin dashboard).
export default function AdminReopenJob({
  jobId,
  jobStatus,
  compact = false,
  showUntil,
}: {
  jobId: string
  jobStatus: string
  compact?: boolean
  showUntil?: number
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (showUntil == null) return
    const timer = setTimeout(() => setExpired(true), Math.max(0, showUntil - new Date().getTime()))
    return () => clearTimeout(timer)
  }, [showUntil])

  if (jobStatus !== 'completed' || expired) return null

  async function reopen() {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('admin_reopen_completed_job', { p_job_id: jobId })
    setSaving(false)
    if (rpcError) {
      setError(`Could not reopen: ${rpcError.message}`)
      return
    }
    setConfirming(false)
    window.alert(`Job reopened - it is now ${STATUS_LABELS[data as string] ?? data}.`)
    router.refresh()
    window.location.reload()
  }

  return (
    <div className={compact ? '' : 'border border-amber-300 bg-amber-50 rounded-xl p-4'}>
      {!compact && (
        <>
          <p className="text-sm font-medium text-gray-900 mb-1">Completed by mistake?</p>
          <p className="text-xs text-gray-600 mb-3">
            Reopens this job at the status it had just before it was completed, clears the completion date and locked-in
            driver pay (it goes back to the current estimate), and logs who reopened it.
          </p>
        </>
      )}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={compact
          ? 'text-xs bg-amber-600 text-white px-2.5 py-1 rounded-lg hover:bg-amber-700 whitespace-nowrap'
          : 'text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800'}
      >
        {compact ? 'Undo complete' : 'Reopen this job'}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {confirming && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5">
            <p className="text-sm font-semibold text-gray-900 mb-2">Reopen this job?</p>
            <p className="text-sm text-gray-600 mb-4">
              It will go back to its previous status and the driver can carry on with it. Anything already sent to the
              customer or driver can&apos;t be unsent.
            </p>
            <div className="flex gap-2">
              <button
                onClick={reopen}
                disabled={saving}
                className="flex-1 bg-gray-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Reopening…' : 'Confirm'}
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
