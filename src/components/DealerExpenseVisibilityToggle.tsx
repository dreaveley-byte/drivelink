'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DealerExpenseVisibilityToggle({ organizationId, initialValue }: { organizationId: string; initialValue: boolean }) {
  const router = useRouter()
  const [checked, setChecked] = useState(initialValue)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const newValue = !checked
    setChecked(newValue)
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('organizations').update({ dealer_can_view_expenses: newValue }).eq('id', organizationId)
    setSaving(false)
    if (error) {
      setChecked(!newValue)
      alert(`Could not update this: ${error.message}`)
      return
    }
    router.refresh()
  }

  return (
    <label className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg p-3">
      <div>
        <p className="text-sm text-gray-900">Let this dealer view expense receipts</p>
        <p className="text-xs text-gray-500">When off, only admin can see submitted receipts and additional charges on their jobs.</p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-[#378ADD]' : 'bg-gray-300'} disabled:opacity-50`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  )
}
