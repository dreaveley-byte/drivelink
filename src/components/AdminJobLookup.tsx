'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { shortJobId } from '@/lib/shortId'

type Match = {
  id: string
  status: string
  organization_name: string | null
  pickup_address: string | null
  dropoff_address: string | null
  vehicle: string | null
}

// Jump straight to a drive's receipt by typing its short ID (e.g. D26B3934,
// shown on every receipt and job card). Also accepts the full ID with or
// without dashes, or a pasted receipt link - anything containing at least the
// first 6 characters of the ID.
export default function AdminJobLookup() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [searching, setSearching] = useState(false)

  async function go(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMatches([])

    // Pull just the ID out of whatever was typed or pasted - a short ID, a
    // full ID (with or without dashes), a receipt link, or even "Drive ID:
    // D26B3934" with the label. Dashes between hex characters are dropped
    // first so a full dashed ID reads as one piece, then the first run of 6+
    // hex characters is taken as the ID.
    const undashed = value.replace(/(?<=[0-9a-f])-(?=[0-9a-f])/gi, '')
    const ref = undashed.match(/[0-9a-f]{6,}/i)?.[0] ?? ''
    if (ref.length < 6) {
      setError('Enter at least the first 6 characters of the drive ID (shown on every receipt and job card).')
      return
    }

    setSearching(true)
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('find_jobs_by_short_id', { p_ref: ref })
    setSearching(false)

    if (rpcError) {
      setError(`Lookup failed: ${rpcError.message}`)
      return
    }
    const found = (data ?? []) as Match[]
    if (found.length === 0) {
      setError('No drive found with that ID.')
      return
    }
    if (found.length === 1) {
      router.push(`/dashboard/jobs/${found[0].id}/receipt`)
      return
    }
    setMatches(found)
  }

  return (
    <form onSubmit={go} className="flex-1 max-w-md">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); setMatches([]) }}
          placeholder="Find a drive by ID (e.g. D26B3934)"
          aria-label="Find a drive by ID"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={searching}
          className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {searching ? '…' : 'Open'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {matches.length > 1 && (
        <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
          <p className="text-xs text-gray-500 px-3 py-1.5">More than one drive matches - pick one:</p>
          {matches.map((m) => (
            <Link key={m.id} href={`/dashboard/jobs/${m.id}/receipt`} className="block px-3 py-1.5 hover:bg-gray-50">
              <p className="text-xs text-gray-900 font-medium">
                {shortJobId(m.id)} · {m.organization_name ?? 'Unknown dealer'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {[m.vehicle, `${m.pickup_address ?? ''} → ${m.dropoff_address ?? ''}`].filter(Boolean).join(' · ')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </form>
  )
}
