'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CreateDiscountCodeForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [percent, setPercent] = useState('50')
  const [useDays, setUseDays] = useState(true)
  const [days, setDays] = useState('30')
  const [useJobs, setUseJobs] = useState(false)
  const [maxJobs, setMaxJobs] = useState('10')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!code.trim()) {
      setError('Enter a code.')
      return
    }
    if (!useDays && !useJobs) {
      setError('Pick at least one limit - days, jobs, or both.')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('discount_codes').insert({
      code: code.trim().toUpperCase(),
      discount_percent: parseFloat(percent),
      expires_days: useDays ? parseInt(days) : null,
      max_jobs: useJobs ? parseInt(maxJobs) : null,
      created_by: user?.id,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setCode('')
    router.refresh()
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-medium text-gray-900 mb-3">Create a new code</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="WELCOME50"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Discount off markup (%)</label>
          <input
            type="number"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 mb-1">
        <input type="checkbox" checked={useDays} onChange={(e) => setUseDays(e.target.checked)} />
        Time-limited
      </label>
      {useDays && (
        <div className="ml-6 mb-2">
          <label className="block text-xs text-gray-500 mb-1">Days from when the dealer redeems it</label>
          <input
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-700 mb-1">
        <input type="checkbox" checked={useJobs} onChange={(e) => setUseJobs(e.target.checked)} />
        Job-count-limited
      </label>
      {useJobs && (
        <div className="ml-6 mb-3">
          <label className="block text-xs text-gray-500 mb-1">Number of jobs</label>
          <input
            type="number"
            value={maxJobs}
            onChange={(e) => setMaxJobs(e.target.value)}
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      <button
        onClick={submit}
        disabled={saving}
        className="mt-2 bg-[#378ADD] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
      >
        {saving ? 'Creating…' : 'Create code'}
      </button>
    </div>
  )
}
