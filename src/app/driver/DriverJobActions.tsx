'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import { formatCents } from '@/lib/pricing'
import { getDefaultChecklist } from '@/lib/checklist'

type Job = {
  id: string
  status: string
  pickup_address: string
  dropoff_address: string
  recipient_name: string | null
  customer_full_name: string | null
  estimated_driver_pay_cents: number | null
  estimated_distance_km: number | null
  vehicle_year: number | null
  vehicle_make: string | null
  vehicle_model: string | null
  stock_number: string | null
  vin: string | null
  job_types: { name: string }[] | { name: string } | null
  organizations: { name: string }[] | { name: string } | null
}

// Pulls a city out of a full address string like "123 Main St, Coquitlam, BC, Canada".
// Falls back to the full address if it doesn't look like a standard formatted address.
function extractCity(address: string): string {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 3) return parts[parts.length - 3]
  return address
}

// Supabase's inferred type for joined tables can come back as either an array
// or a single object depending on the query shape — normalize to a plain value.
function joinName(value: { name: string }[] | { name: string } | null): string | null {
  if (!value) return null
  return Array.isArray(value) ? value[0]?.name ?? null : value.name
}

type ChecklistItem = {
  id: string
  label: string
  completed_at: string | null
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
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])

  useEffect(() => {
    if (!isActive) return
    const supabase = createClient()

    async function loadChecklist() {
      const { data } = await supabase
        .from('job_checklist_items')
        .select('id, label, completed_at')
        .eq('job_id', job.id)
        .order('sort_order')

      if (data && data.length > 0) {
        setChecklist(data)
        return
      }

      // Older jobs claimed before this feature existed won't have items yet — backfill them.
      const defaults = getDefaultChecklist(joinName(job.job_types))
      const rows = defaults.map((label, i) => ({ job_id: job.id, label, sort_order: i }))
      const { data: created } = await supabase.from('job_checklist_items').insert(rows).select('id, label, completed_at')
      if (created) setChecklist(created)
    }

    loadChecklist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, job.id])

  async function toggleChecklistItem(item: ChecklistItem) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const nowCompleting = !item.completed_at

    setChecklist((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, completed_at: nowCompleting ? new Date().toISOString() : null } : i))
    )

    await supabase
      .from('job_checklist_items')
      .update({
        completed_at: nowCompleting ? new Date().toISOString() : null,
        completed_by: nowCompleting ? user?.id : null,
      })
      .eq('id', item.id)
  }

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

    const defaults = getDefaultChecklist(joinName(job.job_types))
    await supabase.from('job_checklist_items').insert(
      defaults.map((label, i) => ({ job_id: job.id, label, sort_order: i }))
    )

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
    <div className="border border-gray-200 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">{joinName(job.job_types)}</p>
        {(job.vehicle_year || job.vehicle_make || job.vehicle_model || job.stock_number) && (
          <p className="text-xs text-gray-600 mt-0.5">
            {[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')}
            {job.stock_number && ` · Stock #${job.stock_number}`}
          </p>
        )}
        {joinName(job.organizations) && (
          <p className="text-xs text-gray-600 mt-0.5">{joinName(job.organizations)}</p>
        )}
        <p className="text-xs text-gray-500 mt-0.5">
          Drop-off: {extractCity(job.dropoff_address)}
          {job.estimated_distance_km != null && ` · ${Math.round(job.estimated_distance_km)} km round trip`}
        </p>
        {(job.customer_full_name || job.recipient_name) && (
          <p className="text-xs text-gray-400 mt-0.5">
            Customer: {job.customer_full_name || job.recipient_name}
          </p>
        )}
        {job.estimated_driver_pay_cents != null && (
          <p className="text-xs text-green-700 font-medium mt-0.5">
            Est. pay: {formatCents(job.estimated_driver_pay_cents)}
          </p>
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

      {isActive && checklist.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">
            Checklist ({checklist.filter((i) => i.completed_at).length}/{checklist.length})
          </p>
          <div className="space-y-1.5">
            {checklist.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!item.completed_at}
                  onChange={() => toggleChecklistItem(item)}
                />
                <span className={item.completed_at ? 'text-gray-400 line-through' : 'text-gray-700'}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
