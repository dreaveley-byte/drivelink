'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RemoveTeamMemberButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')

  async function handleRemove() {
    setRemoving(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.rpc('remove_org_member', { p_member_id: memberId })
    setRemoving(false)
    if (error) {
      setError(error.message)
      return
    }
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Remove {memberName}?</span>
        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {removing ? 'Removing…' : 'Yes, remove'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:text-gray-700">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => setConfirming(true)} className="text-xs text-red-600 hover:underline">
        Remove
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
