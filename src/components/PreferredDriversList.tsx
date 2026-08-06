'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PreferredDriversList({
  organizationId,
  drivers,
  initiallyPreferred,
}: {
  organizationId: string
  drivers: { id: string; full_name: string | null; phone: string | null }[]
  initiallyPreferred: string[]
}) {
  const [preferred, setPreferred] = useState<Set<string>>(new Set(initiallyPreferred))
  const [saving, setSaving] = useState<string | null>(null)

  async function toggle(driverId: string) {
    setSaving(driverId)
    const supabase = createClient()
    const isPreferred = preferred.has(driverId)

    if (isPreferred) {
      await supabase.from('preferred_drivers').delete().eq('organization_id', organizationId).eq('driver_id', driverId)
      setPreferred((prev) => {
        const next = new Set(prev)
        next.delete(driverId)
        return next
      })
    } else {
      await supabase.from('preferred_drivers').insert({ organization_id: organizationId, driver_id: driverId })
      setPreferred((prev) => new Set(prev).add(driverId))
    }
    setSaving(null)
  }

  if (drivers.length === 0) {
    return <p className="text-sm text-gray-400">No approved drivers on the platform yet.</p>
  }

  return (
    <div className="space-y-2">
      {drivers.map((d) => {
        const isPreferred = preferred.has(d.id)
        return (
          <div key={d.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{d.full_name || 'Unnamed driver'}</p>
              {d.phone && <p className="text-xs text-gray-400">{d.phone}</p>}
            </div>
            <button
              type="button"
              onClick={() => toggle(d.id)}
              disabled={saving === d.id}
              className={`text-xs px-3 py-1.5 rounded-lg border ${
                isPreferred
                  ? 'bg-[#378ADD] text-white border-[#378ADD]'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              } disabled:opacity-50`}
            >
              {saving === d.id ? '...' : isPreferred ? '★ Preferred' : 'Prefer this driver'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
