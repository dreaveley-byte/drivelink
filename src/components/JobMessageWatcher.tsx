'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { playChime } from '@/lib/chime'

export default function JobMessageWatcher({ jobIds, currentUserId }: { jobIds: string[]; currentUserId: string }) {
  const router = useRouter()

  useEffect(() => {
    if (jobIds.length === 0) return
    const supabase = createClient()

    const channel = supabase
      .channel(`dashboard-job-messages-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_messages' },
        (payload) => {
          const msg = payload.new as { job_id: string; sender_id: string | null }
          if (jobIds.includes(msg.job_id) && msg.sender_id !== currentUserId) {
            playChime()
            router.refresh()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIds.join(','), currentUserId])

  return null
}
