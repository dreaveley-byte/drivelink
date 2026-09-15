'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminDriverReassign({
  jobId,
  jobStatus,
  currentDriverId,
  currentDriverName,
  onSaved,
}: {
  jobId: string
  jobStatus: string
  currentDriverId: string | null
  currentDriverName: string | null
  onSaved?: (driverId: string | null, driverName: string | null) => void
}) {
  const router = useRouter()
  const [drivers, setDrivers] = useState<{ id: string; full_name: string | null }[]>([])
  const [selectedId, setSelectedId] = useState(currentDriverId ?? '')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Fetches its own driver list client-side, rather than requiring the
  // page it's dropped into to fetch and pass one down - this component
  // needs to work equally well from a server component (the receipt
  // page) and a client component (the edit page, which is 'use client'
  // start to finish), and self-fetching is the one approach that works
  // unchanged in both.
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'driver')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setDrivers(data ?? []))
  }, [])

  // Keeps the dropdown's selection in sync after a save (router.refresh()
  // brings a new currentDriverId down as a prop, but React won't reset
  // local state from a changed prop on its own).
  useEffect(() => {
    setSelectedId(currentDriverId ?? '')
  }, [currentDriverId])

  const isUnchanged = (selectedId || null) === (currentDriverId ?? null)
  const selectedDriver = drivers.find((d) => d.id === selectedId)
  const willUnassign = selectedId === ''

  async function save() {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const update: Record<string, unknown> = { driver_id: selectedId || null }
    // A blunt override, on purpose - this doesn't try to reset checklist
    // progress, GPS tracking, or anything else the previous driver did,
    // since an admin using this deliberately needs the flexibility to
    // hand a job to someone else mid-delivery without losing that work.
    // It DOES fix up status so the job behaves correctly for job-claiming
    // and the driver's own dashboard afterward:
    if (willUnassign) {
      // Send it back to the claimable pool, unless it's already done.
      if (!['delivered', 'completed', 'cancelled'].includes(jobStatus)) {
        update.status = 'awaiting_driver'
      }
    } else if (!currentDriverId && jobStatus === 'awaiting_driver') {
      // Was unassigned, now has a driver - move it out of the claimable pool.
      update.status = 'assigned'
    }
    const { error: updateError } = await supabase.from('jobs').update(update).eq('id', jobId)
    setSaving(false)
    if (updateError) {
      setError(`Could not save: ${updateError.message}`)
      return
    }
    setConfirming(false)
    onSaved?.(selectedId || null, selectedDriver?.full_name ?? null)
    router.refresh()
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-medium text-gray-900 mb-1">Assigned driver</p>
      <p className="text-xs text-gray-400 mb-3">
        Override — set, remove, or hand off the driver on this job at any point in the delivery. Doesn&apos;t reset
        checklist progress, tracking, or anything else already completed.
      </p>
      <div className="flex gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">— Unassigned —</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name || 'Unnamed driver'}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={isUnchanged}
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40"
        >
          Save
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Currently: {currentDriverName || 'Unassigned'}
      </p>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {confirming && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5">
            <p className="text-sm font-semibold text-gray-900 mb-2">Change assigned driver?</p>
            <p className="text-sm text-gray-600 mb-4">
              {willUnassign
                ? `Remove ${currentDriverName || 'the current driver'} from this job and send it back to the available pool?`
                : currentDriverId
                  ? `Reassign this job from ${currentDriverName || 'the current driver'} to ${selectedDriver?.full_name || 'this driver'}?`
                  : `Assign this job to ${selectedDriver?.full_name || 'this driver'}?`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 bg-gray-900 text-white text-sm font-medium py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Confirm'}
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
