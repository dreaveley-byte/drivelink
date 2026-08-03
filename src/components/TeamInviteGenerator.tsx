'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TeamInviteGenerator({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [smsSent, setSmsSent] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function generate(e?: React.FormEvent) {
    e?.preventDefault()
    setGenerating(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('org_invites')
      .insert({
        organization_id: organizationId,
        invited_by: userId,
        invitee_name: fullName || null,
        invitee_phone: phone || null,
      })
      .select('token')
      .single()

    if (error || !data) {
      setGenerating(false)
      setError(error?.message ?? 'Could not create invite link.')
      return
    }

    const inviteLink = `${window.location.origin}/join/${data.token}`
    setLink(inviteLink)

    // Auto-text isn't wired up yet — needs a Twilio account connected first.
    // For now the link always shows below so it can be sent manually.
    if (phone) {
      const res = await fetch('/api/team-invites/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, link: inviteLink, fullName }),
      }).catch(() => null)
      if (res?.ok) setSmsSent(true)
    }

    setGenerating(false)
  }

  function reset() {
    setLink(null)
    setSmsSent(false)
    setFullName('')
    setPhone('')
    setShowForm(false)
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard can fail in some contexts, not worth extra handling here
    }
  }

  if (link) {
    return (
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
        {smsSent ? (
          <p className="text-xs text-green-700 mb-1.5">Texted to {phone}.</p>
        ) : (
          <p className="text-xs text-gray-500 mb-1.5">
            {phone
              ? "Texting isn't turned on yet — copy this link and send it to them yourself for now."
              : "Send this link to your new team member — they'll sign up and be added to your dealership automatically."}
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-600"
          />
          <button
            type="button"
            onClick={copy}
            className="text-xs bg-[#378ADD] text-white px-3 py-1.5 rounded-lg hover:bg-[#2d6ead] whitespace-nowrap"
          >
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
        </div>
        <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 mt-2 underline">
          Invite someone else
        </button>
      </div>
    )
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
      >
        + Invite team member
      </button>
    )
  }

  return (
    <form onSubmit={generate} className="border border-gray-200 rounded-lg p-3 space-y-2">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Full name (optional)</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Smith"
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Phone (optional — texts them the link)</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(604) 555-0123"
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={generating}
          className="text-xs bg-[#378ADD] text-white px-3 py-1.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
        >
          {generating ? 'Creating…' : 'Create invite link'}
        </button>
        <button type="button" onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </form>
  )
}
