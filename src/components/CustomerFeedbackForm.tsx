'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CustomerFeedbackForm({ token, driverName, isRide }: { token: string; driverName?: string | null; isRide?: boolean }) {
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!rating) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('submit_customer_feedback', { p_token: token, p_rating: rating, p_feedback: feedback || null })
    setSaving(false)
    if (rpcError) {
      setError('Could not submit your feedback — please try again.')
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-600">
        Thank you for your feedback!
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <p className="text-sm text-gray-700 mb-2">
        {driverName ? `Rate ${driverName} — how was your ${isRide ? 'drive' : 'delivery'} today?` : `How was your ${isRide ? 'drive' : 'delivery'}?`}
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`w-9 h-9 rounded text-base border ${rating >= n ? 'bg-amber-400 border-amber-400 text-white' : 'border-gray-300 text-gray-400'}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Where can we improve? (optional)"
        rows={2}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
      />
      <button
        onClick={submit}
        disabled={saving || !rating}
        className="text-sm bg-[#378ADD] text-white px-4 py-2 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
      >
        {saving ? 'Submitting...' : 'Submit feedback'}
      </button>
    </div>
  )
}
