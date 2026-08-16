'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeactivateDiscountCodeButton({ codeId }: { codeId: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function deactivate() {
    if (!confirm('Deactivate this code? Dealers already using it will keep their current discount until it naturally expires, but no one else can redeem it.')) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('discount_codes').update({ active: false }).eq('id', codeId)
    setSaving(false)
    router.refresh()
  }

  return (
    <button
      onClick={deactivate}
      disabled={saving}
      className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50"
    >
      {saving ? 'Saving\u2026' : 'Deactivate'}
    </button>
  )
}
