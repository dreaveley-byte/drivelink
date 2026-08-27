'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ComplianceOverrideToggle({
  driverId,
  isOverridden,
  note,
}: {
  driverId: string
  isOverridden: boolean
  note: string | null
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function setOverride(value: boolean, overrideNote?: string) {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        compliance_override: value,
        compliance_override_note: value ? (overrideNote || null) : null,
        compliance_override_set_by: value ? user?.id : null,
        compliance_override_set_at: value ? new Date().toISOString() : null,
      })
      .eq('id', driverId)
    setSaving(false)
    if (updateError) {
      setError(`Could not update: ${updateError.message}`)
      return
    }
    setShowConfirm(false)
    router.refresh()
  }

  if (isOverridden) {
    return (
      <div className="border border-amber-300 bg-amber-50 rounded-lg p-3">
        <p className="text-sm font-medium text-amber-800">Compliance requirements manually overridden</p>
        {note && <p className="text-xs text-amber-700 mt-1">Note: {note}</p>}
        <p className="text-xs text-amber-600 mt-1">
          This driver can stay Active and claim jobs regardless of missing/expired documents.
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        <button
          onClick={() => setOverride(false)}
          disabled={saving}
          className="text-xs text-amber-800 underline mt-2 disabled:opacity-50"
        >
          {saving ? 'Removing…' : 'Remove override — re-enforce document requirements'}
        </button>
      </div>
    )
  }

  return (
    <div>
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="text-xs text-gray-500 underline"
        >
          Override document requirements for this driver
        </button>
      ) : (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-3">
          <p className="text-sm font-medium text-amber-800 mb-2">
            This lets the driver stay Active and claim jobs even with missing or expired documents. Use with caution.
          </p>
          <input
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Why? (optional, but recommended for your own records)"
            className="w-full border border-amber-300 rounded-lg px-2 py-1.5 text-xs mb-2"
          />
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setOverride(true, noteInput)}
              disabled={saving}
              className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Confirm override'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="text-xs text-gray-500 px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
