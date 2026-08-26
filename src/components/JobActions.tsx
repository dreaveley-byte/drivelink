'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toLocalDatetimeInputValue, localInputToUtcIso } from '@/lib/localDatetime'

export default function JobActions({ jobId, status, archived = false, isAdmin = false }: { jobId: string; status: string; archived?: boolean; isAdmin?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [forcingComplete, setForcingComplete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [completedAtValue, setCompletedAtValue] = useState(() => toLocalDatetimeInputValue(new Date()))

  const canEdit = status === 'awaiting_driver'
  const canCancel = status !== 'completed' && status !== 'cancelled'
  const canArchive = !archived && (status === 'completed' || status === 'cancelled')
  // A cancelled job can be reopened for editing and reposted to drivers —
  // the edit page itself resets status/driver_id/archived_at on save.
  const canRepost = status === 'cancelled'
  // Only makes sense once a driver's actually engaged with the job — no point
  // force-completing something nobody's picked up yet.
  const canForceComplete = isAdmin && !['awaiting_driver', 'completed', 'cancelled'].includes(status)
  // Permanent delete — admin only, and only on jobs that have already run
  // their course (completed/cancelled), never on anything still active.
  const canDelete = isAdmin && (status === 'completed' || status === 'cancelled')

  async function cancelJob() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', jobId)
    setLoading(false)
    setConfirming(false)
    router.refresh()
  }

  async function archiveJob() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('jobs').update({ archived_at: new Date().toISOString() }).eq('id', jobId)
    setLoading(false)
    router.refresh()
  }

  async function unarchiveJob() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('jobs').update({ archived_at: null }).eq('id', jobId)
    setLoading(false)
    router.refresh()
  }

  async function forceComplete() {
    setLoading(true)
    const supabase = createClient()
    const completedAtIso = localInputToUtcIso(completedAtValue)
    const { error } = await supabase
      .from('jobs')
      .update({ status: 'completed', return_gps_at: completedAtIso ?? new Date().toISOString() })
      .eq('id', jobId)
    setLoading(false)
    if (error) {
      alert(`Could not force-complete this job: ${error.message}`)
      return
    }
    setForcingComplete(false)
    router.refresh()
  }

  async function deleteJob() {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('jobs').delete().eq('id', jobId)
    setDeleting(false)
    if (error) {
      alert(`Could not delete this job: ${error.message}`)
      return
    }
    setConfirmingDelete(false)
    router.refresh()
  }

  if (archived) {
    return (
      <div className="flex items-center gap-3">
        {canRepost && (
          <Link href={`/dashboard/jobs/${jobId}/edit`} className="text-xs text-gray-600 hover:text-gray-900">
            Repost
          </Link>
        )}
        <button onClick={unarchiveJob} disabled={loading} className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50">
          {loading ? '...' : 'Unarchive'}
        </button>
      </div>
    )
  }

  if (!canEdit && !canCancel && !canArchive && !canForceComplete && !canDelete && !canRepost) return null

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        {canEdit && (
          <Link href={`/dashboard/jobs/${jobId}/edit`} className="text-xs text-gray-600 hover:text-gray-900">
            Edit
          </Link>
        )}
        {canRepost && (
          <Link href={`/dashboard/jobs/${jobId}/edit`} className="text-xs text-gray-600 hover:text-gray-900">
            Repost
          </Link>
        )}
        {canArchive && (
          <button onClick={archiveJob} disabled={loading} className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50">
            {loading ? '...' : 'Archive'}
          </button>
        )}
        {canForceComplete && !forcingComplete && (
          <button onClick={() => setForcingComplete(true)} className="text-xs text-gray-600 hover:text-gray-900">
            Force complete
          </button>
        )}
        {canCancel && !confirming && (
          <button onClick={() => setConfirming(true)} className="text-xs text-red-600 hover:text-red-700">
            Cancel
          </button>
        )}
        {canCancel && confirming && (
          <span className="text-xs text-gray-600 flex items-center gap-2">
            Cancel this job?
            <button onClick={cancelJob} disabled={loading} className="text-red-600 font-medium hover:text-red-700 disabled:opacity-50">
              {loading ? '...' : 'Yes'}
            </button>
            <button onClick={() => setConfirming(false)} className="text-gray-500 hover:text-gray-700">
              No
            </button>
          </span>
        )}
        {canDelete && !confirmingDelete && (
          <button onClick={() => setConfirmingDelete(true)} className="text-xs text-red-700 hover:text-red-800 underline">
            Delete
          </button>
        )}
      </div>
      {confirmingDelete && (
        <div className="border-2 border-red-300 rounded-lg p-2.5 bg-red-50 max-w-xs">
          <p className="text-xs text-red-700 font-medium mb-1.5">
            Permanently delete this job? This removes it and everything tied to it (checklist, photos, expenses, chat) — this cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={deleteJob} disabled={deleting} className="text-xs text-white bg-red-700 rounded px-2.5 py-1 hover:bg-red-800 disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Yes, delete permanently'}
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="text-xs text-gray-600 hover:text-gray-800">
              Cancel
            </button>
          </div>
        </div>
      )}
      {forcingComplete && (
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Completion time</label>
            <input
              type="datetime-local"
              value={completedAtValue}
              onChange={(e) => setCompletedAtValue(e.target.value)}
              className="text-xs border border-gray-300 rounded px-1.5 py-1"
            />
          </div>
          <button onClick={forceComplete} disabled={loading} className="text-xs text-white bg-gray-900 rounded px-2 py-1 hover:bg-gray-800 disabled:opacity-50">
            {loading ? '...' : 'Confirm'}
          </button>
          <button onClick={() => setForcingComplete(false)} className="text-xs text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
