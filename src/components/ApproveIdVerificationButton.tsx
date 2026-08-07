'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ApproveIdVerificationButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function approve() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('jobs')
      .update({ id_verification_approved_at: new Date().toISOString(), id_verification_approved_by: user?.id ?? null })
      .eq('id', jobId)
    setLoading(false)
    if (error) {
      alert(`Could not approve: ${error.message}`)
      return
    }
    router.refresh()
  }

  return (
    <button
      onClick={approve}
      disabled={loading}
      className="mt-3 text-xs bg-gray-900 text-white rounded-lg px-3 py-1.5 hover:bg-gray-800 disabled:opacity-50"
    >
      {loading ? 'Approving…' : 'Approve delivery'}
    </button>
  )
}
