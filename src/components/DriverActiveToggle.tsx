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
  const [blocked, setBlocked] = useState(false)
  const [daysInput, setDaysInput] = useState('7')
  const [error, setError] = useState('')

  async function toggle() {
    setLoading(true)
    setError('')
    setBlocked(false)
    const supabase = createClient()
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ is_active: !isActive })
      .eq('id', driverId)
      .select('is_active')
      .single()
    setLoading(false)
    if (updateError) {
      setError(`Could not update: ${updateError.message}`)
      return
    }
    // Trying to turn a driver on while their required documentation is
    // incomplete gets silently forced back to inactive by a database
    // trigger - without checking the actual result and offering a way
    // forward, this would otherwise look like the click did nothing.
    if (!isActive && data?.is_active === false) {
      setBlocked(true)
      return
    }
    router.refresh()
  }

  async function grantGracePeriod() {
    const numDays = parseInt(daysInput, 10)
    if (!numDays || numDays < 1) {
      setError('Enter a valid number of days.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const d = new Date()
    d.setDate(d.getDate() + numDays)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_active: true,
        compliance_override: true,
        compliance_override_expires_at: d.toISOString(),
        compliance_override_note: `${numDays}-day grace period granted from the driver list to get documents in order.`,
        compliance_override_set_by: user?.id,
        compliance_override_set_at: new Date().toISOString(),
      })
      .eq('id', driverId)
    setLoading(false)
    if (updateError) {
      setError(`Could not grant grace period: ${updateError.message}`)
      return
    }
    setBlocked(false)
    router.refresh()
  }

  if (blocked) {
    return (
      <div className="border border-amber-300 bg-amber-50 rounded-lg p-2.5 max-w-[240px]">
        <p className="text-xs text-amber-800 font-medium mb-1.5">
          Still inactive — this driver has missing or expired required documentation.
        </p>
        <p className="text-xs text-amber-700 mb-1.5">Grant a grace period (days) to stay active while they get compliant:</p>
        <div className="flex items-center gap-1.5 mb-1.5">
          <input
            type="number"
            min={1}
            value={daysInput}
            onChange={(e) => setDaysInput(e.target.value)}
            className="w-16 border border-amber-300 rounded px-1.5 py-1 text-xs"
          />
          <button
            onClick={grantGracePeriod}
            disabled={loading}
            className="text-xs bg-amber-600 text-white px-2 py-1 rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? 'Granting…' : 'Grant'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
        <button onClick={() => setBlocked(false)} className="text-xs text-gray-500 underline">
          Never mind
        </button>
      </div>
    )
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
      {error && <p className="text-xs text-red-600 max-w-[220px] text-right">{error}</p>}
    </div>
  )
}
