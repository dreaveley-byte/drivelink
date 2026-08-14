'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DriverFeedbackForm({ driverId }: { driverId: string }) {
  const [type, setType] = useState<'praise' | 'complaint'>('praise')
  const [message, setMessage] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [submitterContact, setSubmitterContact] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!message.trim()) {
      setError('Enter a message before submitting.')
      return
    }
    setError('')
    setSaving(true)
    const supabase = createClient()
    const { error: insertError } = await supabase.from('driver_public_feedback').insert({
      driver_id: driverId,
      type,
      message: message.trim(),
      submitter_name: submitterName.trim() || null,
      submitter_contact: submitterContact.trim() || null,
    })
    setSaving(false)
    if (insertError) {
      setError(`Could not submit this: ${insertError.message}`)
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-4 text-center text-sm text-green-700">
        Thank you — your feedback has been submitted.
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <p className="text-sm font-medium text-gray-900 mb-3">Leave feedback about this driver</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setType('praise')}
          className={`flex-1 text-sm font-medium py-2 rounded-lg border ${type === 'praise' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600'}`}
        >
          👍 Praise
        </button>
        <button
          type="button"
          onClick={() => setType('complaint')}
          className={`flex-1 text-sm font-medium py-2 rounded-lg border ${type === 'complaint' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-600'}`}
        >
          ⚠️ Complaint
        </button>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What would you like to share?"
        rows={4}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
      />
      <input
        value={submitterName}
        onChange={(e) => setSubmitterName(e.target.value)}
        placeholder="Your name (optional)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
      />
      <input
        value={submitterContact}
        onChange={(e) => setSubmitterContact(e.target.value)}
        placeholder="Phone or email (optional, in case we follow up)"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
      />
      <button
        onClick={submit}
        disabled={saving}
        className="w-full bg-[#378ADD] text-white text-sm font-medium py-2.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
      >
        {saving ? 'Submitting…' : 'Submit'}
      </button>
    </div>
  )
}
