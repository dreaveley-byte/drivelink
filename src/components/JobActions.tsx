'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function JobActions({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const canEdit = status === 'awaiting_driver'
  const canCancel = status !== 'completed' && status !== 'cancelled'

  async function cancelJob() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', jobId)
    setLoading(false)
    setConfirming(false)
    router.refresh()
  }

  if (!canEdit && !canCancel) return null

  return (
    <div className="flex items-center gap-3">
      {canEdit && (
        <Link href={`/dashboard/jobs/${jobId}/edit`} className="text-xs text-gray-600 hover:text-gray-900">
          Edit
        </Link>
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
    </div>
  )
}
