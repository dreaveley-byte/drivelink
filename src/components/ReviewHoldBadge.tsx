'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Shown on a job that's still within its post-review hold window (see
// migration 072_job_review_hold.sql) — lets admin claim it, jump into the
// edit page to adjust pricing, and approve it to release it to drivers
// before the hold timer would otherwise let it go live on its own.
export default function ReviewHoldBadge({
  jobId,
  createdAt,
  holdMinutes,
  reviewClaimedByName,
  reviewApproved,
  isClaimedByMe,
}: {
  jobId: string
  createdAt: string
  holdMinutes: number
  reviewClaimedByName: string | null
  reviewApproved: boolean
  isClaimedByMe: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [minutesLeft, setMinutesLeft] = useState(() => {
    const endsAt = new Date(createdAt).getTime() + holdMinutes * 60000
    return Math.max(0, Math.ceil((endsAt - Date.now()) / 60000))
  })

  useEffect(() => {
    const endsAt = new Date(createdAt).getTime() + holdMinutes * 60000
    const tick = () => setMinutesLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 60000)))
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [createdAt, holdMinutes])

  if (reviewApproved) return null

  async function claim() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('jobs').update({ review_claimed_by: user.id, review_claimed_at: new Date().toISOString() }).eq('id', jobId)
    }
    setLoading(false)
    window.location.reload()
  }

  async function approve() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('jobs').update({ review_approved_at: new Date().toISOString(), review_approved_by: user?.id ?? null }).eq('id', jobId)
    setLoading(false)
    window.location.reload()
  }

  return (
    <div className="mt-1.5 flex items-center gap-2 flex-wrap bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
      <span className="text-xs text-amber-800">
        ⏳ On hold{minutesLeft > 0 ? ` — ${minutesLeft}m left` : ' — hold expired'}, not yet visible to drivers
        {reviewClaimedByName && !isClaimedByMe && <> · claimed by {reviewClaimedByName}</>}
      </span>
      {!reviewClaimedByName && (
        <button onClick={claim} disabled={loading} className="text-xs text-amber-900 font-medium underline hover:no-underline disabled:opacity-50">
          {loading ? '...' : 'Claim for review'}
        </button>
      )}
      {(isClaimedByMe || !reviewClaimedByName) && (
        <Link href={`/dashboard/jobs/${jobId}/edit`} className="text-xs text-amber-900 font-medium underline hover:no-underline">
          Review & edit
        </Link>
      )}
      {isClaimedByMe && (
        <button onClick={approve} disabled={loading} className="text-xs text-white bg-amber-700 rounded px-2 py-0.5 hover:bg-amber-800 disabled:opacity-50">
          {loading ? '...' : 'Approve & go live'}
        </button>
      )}
    </div>
  )
}
