'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Job = {
  id: string
  status: string
  pickup_address: string
  dropoff_address: string
  recipient_name: string | null
  job_types: { name: string } | null
}

const nextStatus: Record<string, string> = {
  assigned: 'picked_up',
  picked_up: 'in_progress',
  in_progress: 'delivered',
  delivered: 'completed',
}

const nextStatusLabel: Record<string, string> = {
  assigned: 'Mark picked up',
  picked_up: 'Mark in progress',
  in_progress: 'Mark delivered',
  delivered: 'Mark completed',
}

const statusLabels: Record<string, string> = {
  awaiting_driver: 'Awaiting Driver',
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  in_progress: 'In Progress',
  delivered: 'Delivered',
  completed: 'Completed',
}

export default function DriverJobActions({
  job,
  isActive,
  disabled = false,
}: {
  job: Job
  isActive: boolean
  disabled?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function claimJob() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('jobs')
      .update({ driver_id: user.id, status: 'assigned' })
      .eq('id', job.id)

    await supabase.from('job_status_events').insert({
      job_id: job.id,
      status: 'assigned',
      changed_by: user.id,
    })

    router.refresh()
    setLoading(false)
  }

  async function advanceStatus() {
    const newStatus = nextStatus[job.status]
    if (!newStatus) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('jobs').update({ status: newStatus }).eq('id', job.id)
    await supabase.from('job_status_events').insert({
      job_id: job.id,
      status: newStatus,
      changed_by: user?.id,
    })

    router.refresh()
    setLoading(false)
  }

  return (
    <div className="border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">{job.job_types?.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {job.pickup_address} → {job.dropoff_address}
        </p>
        {job.recipient_name && (
          <p className="text-xs text-gray-400 mt-0.5">Recipient: {job.recipient_name}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1">
          {statusLabels[job.status] ?? job.status}
        </span>

        {isActive && nextStatus[job.status] && (
          <button
            onClick={advanceStatus}
            disabled={loading}
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? '...' : nextStatusLabel[job.status]}
          </button>
        )}

        {!isActive && (
          <button
            onClick={claimJob}
            disabled={loading || disabled}
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? '...' : 'Claim'}
          </button>
        )}
      </div>
    </div>
  )
}
