'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

// Jump straight to a drive's receipt by pasting its ID. The ID is shown at the
// top of every receipt ("Job ID: ..."), and pasting a whole receipt link works
// too - the ID is picked out of whatever was pasted.
export default function AdminJobLookup() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function go(e: React.FormEvent) {
    e.preventDefault()
    const match = value.match(UUID_PATTERN)
    if (!match) {
      setError('Paste the full drive ID (shown at the top of every receipt) or a receipt link.')
      return
    }
    setError('')
    router.push(`/dashboard/jobs/${match[0].toLowerCase()}/receipt`)
  }

  return (
    <form onSubmit={go} className="flex-1 max-w-md">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setError('') }}
          placeholder="Find a drive by ID…"
          aria-label="Find a drive by ID"
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800"
        >
          Open
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </form>
  )
}
