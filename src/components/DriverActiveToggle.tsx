'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DriverActiveToggle({
  driverId,
  isActive,
}: {
  driverId: string
  isActive: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [blockedMessage, setBlockedMessage] = useState('')

  async function toggle() {
    setLoading(true)
    setBlockedMessage('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_active: !isActive })
      .eq('id', driverId)
      .select('is_active')
      .single()
    setLoading(false)
    if (error) {
      setBlockedMessage(`Could not update: ${error.message}`)
      return
    }
    // Trying to turn a driver on while their required documentation is
    // incomplete gets silently forced back to inactive by a database
    // trigger - without checking the actual result, this would otherwise
    // look like the click did nothing with no explanation.
    if (!isActive && data?.is_active === false) {
      setBlockedMessage('Still inactive — this driver has missing or expired required documentation. Approve everything under Recurring Compliance Documents first.')
      router.refresh()
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={loading}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 ${
          isActive
            ? 'border border-gray-300 text-gray-600 hover:bg-gray-50'
            : 'bg-[#378ADD] text-white hover:bg-[#2d6ead]'
        }`}
      >
        {loading ? '...' : isActive ? 'Turn off' : 'Turn on'}
      </button>
      {blockedMessage && <p className="text-xs text-red-600 max-w-[220px] text-right">{blockedMessage}</p>}
    </div>
  )
}
