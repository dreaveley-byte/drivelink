'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Review = { rating: number | null; feedback: string | null; updated_at: string; dealer_name: string | null }

export default function DriverRatingStars({ driverId, avgRating }: { driverId: string; avgRating: number | null }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reviews, setReviews] = useState<Review[] | null>(null)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && reviews === null) {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('jobs')
        .select('customer_rating, customer_feedback, updated_at, organizations(name)')
        .eq('driver_id', driverId)
        .eq('status', 'completed')
        .not('customer_rating', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(50)
      setReviews(
        (data ?? []).map((d) => ({
          rating: d.customer_rating,
          feedback: d.customer_feedback,
          updated_at: d.updated_at,
          dealer_name: Array.isArray(d.organizations) ? d.organizations[0]?.name : (d.organizations as { name: string } | null)?.name ?? null,
        }))
      )
      setLoading(false)
    }
  }

  const rounded = avgRating != null ? Math.round(avgRating) : 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle() }}
        className="flex items-center gap-0.5 hover:opacity-70"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= rounded ? 'text-amber-500' : 'text-gray-300'}>★</span>
        ))}
        {avgRating != null && <span className="text-xs text-gray-500 ml-1">{avgRating.toFixed(1)}</span>}
      </button>

      {open && (
        <div
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-3"
        >
          <p className="text-xs font-semibold text-gray-900 mb-2">Customer reviews</p>
          {loading && <p className="text-xs text-gray-400">Loading…</p>}
          {!loading && reviews && reviews.length === 0 && (
            <p className="text-xs text-gray-400">No reviews yet.</p>
          )}
          <div className="max-h-64 overflow-y-auto space-y-2.5">
            {reviews?.map((r, i) => (
              <div key={i} className="border-t border-gray-100 pt-2 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={`text-xs ${r.rating && n <= r.rating ? 'text-amber-500' : 'text-gray-300'}`}>★</span>
                  ))}
                  <span className="text-[10px] text-gray-400 ml-1">
                    {new Date(r.updated_at).toLocaleDateString('en-CA', { dateStyle: 'medium' })}
                    {r.dealer_name && ` · ${r.dealer_name}`}
                  </span>
                </div>
                {r.feedback && <p className="text-xs text-gray-600 mt-0.5">{r.feedback}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
