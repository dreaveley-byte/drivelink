'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DealerFeedbackForm({
  jobId,
  initialRating,
  initialFeedback,
}: {
  jobId: string
  initialRating: number | null
  initialFeedback: string | null
}) {
  const [rating, setRating] = useState(initialRating ?? 0)
  const [feedback, setFeedback] = useState(initialFeedback ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('jobs').update({ dealer_rating: rating || null, dealer_feedback: feedback || null }).eq('id', jobId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 print:hidden">
      <p className="text-xs text-gray-500 mb-2">How was this delivery?</p>
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`w-7 h-7 rounded text-sm border ${rating >= n ? 'bg-amber-400 border-amber-400 text-white' : 'border-gray-300 text-gray-400'}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Any comments about this delivery..."
        rows={2}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
      />
      <button
        onClick={submit}
        disabled={saving}
        className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save feedback'}
      </button>
    </div>
  )
}
