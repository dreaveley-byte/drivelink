'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TeamInviteGenerator({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [link, setLink] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setGenerating(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('org_invites')
      .insert({ organization_id: organizationId, invited_by: userId })
      .select('token')
      .single()
    setGenerating(false)
    if (error || !data) {
      setError(error?.message ?? 'Could not create invite link.')
      return
    }
    setLink(`${window.location.origin}/join/${data.token}`)
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

  if (!link) {
    return (
      <div>
        <button
          onClick={generate}
          disabled={generating}
          className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {generating ? 'Creating link…' : '+ Invite team member'}
        </button>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <p className="text-xs text-gray-500 mb-1.5">
        Send this link to your new team member — they'll sign up and be added to your dealership automatically.
      </p>
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
      <button onClick={() => setLink(null)} className="text-xs text-gray-400 hover:text-gray-600 mt-2 underline">
        Generate another
      </button>
    </div>
  )
}
