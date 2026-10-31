'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Admin-only: set a custom markup % for one dealer. Blank = use the global
// markup from Settings. Discount codes and per-job discounts still apply on top.
export default function DealerMarkupEditor({
  organizationId,
  initialValue,
  globalMarkup,
}: {
  organizationId: string
  initialValue: number | null
  globalMarkup: number | null
}) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function save() {
    setError('')
    setMessage('')
    const trimmed = value.trim()
    let next: number | null = null
    if (trimmed !== '') {
      next = parseFloat(trimmed)
      if (isNaN(next) || next <= 0) {
        setError('Enter a markup above 0 (for example 115), or leave it blank to use the global markup.')
        return
      }
    }
    setSaving(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.from('organizations').update({ markup_percent_override: next }).eq('id', organizationId)
    setSaving(false)
    if (updateError) {
      setError(`Could not save: ${updateError.message}`)
      return
    }
    setMessage(next == null ? 'Saved - this dealer now uses the global markup.' : `Saved - this dealer's jobs now use ${next}% markup.`)
    router.refresh()
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-sm text-gray-900">Custom markup % for this dealer</p>
      <p className="text-xs text-gray-500 mb-2">
        Used for new jobs and recalculated jobs{globalMarkup != null ? ` instead of the global ${globalMarkup}%` : ' instead of the global markup'}. Leave blank to use the global markup.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.5"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={globalMarkup != null ? String(globalMarkup) : 'global'}
          className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <span className="text-sm text-gray-500">%</span>
        <button type="button" onClick={save} disabled={saving} className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {message && <p className="text-xs text-green-700 mt-2">{message}</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
