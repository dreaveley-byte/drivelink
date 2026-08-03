'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Invite = {
  id: string
  invitee_name: string | null
  invitee_phone: string | null
  created_at: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { dateStyle: 'medium' })
}

export default function PendingInvitesList({ invites }: { invites: Invite[] }) {
  const router = useRouter()
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function cancelInvite(id: string) {
    setCancellingId(id)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.from('org_invites').delete().eq('id', id)
    setCancellingId(null)
    if (error) {
      setError(error.message)
      return
    }
    router.refresh()
  }

  if (invites.length === 0) return null

  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Pending Invites</p>
      <div className="space-y-2">
        {invites.map((invite) => (
          <div key={invite.id} className="border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{invite.invitee_name || 'Unnamed invite'}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {invite.invitee_phone ? `${invite.invitee_phone} · ` : ''}Sent {fmtDate(invite.created_at)}
              </p>
            </div>
            <button
              onClick={() => cancelInvite(invite.id)}
              disabled={cancellingId === invite.id}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              {cancellingId === invite.id ? 'Cancelling…' : 'Cancel'}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
