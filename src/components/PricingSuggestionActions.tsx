'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PricingSuggestionActions({
  suggestionId,
  fieldName,
  suggestedValue,
}: {
  suggestionId: string
  fieldName: string
  suggestedValue: number
}) {
  const router = useRouter()
  const [saving, setSaving] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function approve() {
    if (!confirm(`Apply this change to pricing settings now? This affects all future jobs of this type.`)) return
    setSaving('approve')
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Apply the actual pricing change first - if this fails, the
    // suggestion should stay pending rather than being marked approved
    // without the change actually having taken effect.
    const { error: settingsError } = await supabase
      .from('pricing_settings')
      .update({ [fieldName]: suggestedValue })
      .eq('id', 1)

    if (settingsError) {
      setSaving(null)
      setError(`Could not apply the change: ${settingsError.message}`)
      return
    }

    const { error: statusError } = await supabase
      .from('pricing_suggestions')
      .update({ status: 'applied', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', suggestionId)

    setSaving(null)
    if (statusError) {
      setError(`Applied the change, but couldn't update the suggestion's status: ${statusError.message}`)
      return
    }
    router.refresh()
  }

  async function reject() {
    setSaving('reject')
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: updateError } = await supabase
      .from('pricing_suggestions')
      .update({ status: 'rejected', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', suggestionId)
    setSaving(null)
    if (updateError) {
      setError(`Could not reject: ${updateError.message}`)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={approve}
          disabled={saving !== null}
          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {saving === 'approve' ? 'Applying…' : 'Approve & apply'}
        </button>
        <button
          onClick={reject}
          disabled={saving !== null}
          className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {saving === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
