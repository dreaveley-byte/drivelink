'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type JobType = {
  id: string
  name: string
  description: string | null
  active: boolean
}

// Lets admins turn job types on/off for the post-job dropdown without
// deleting them — useful for hiding a job type that isn't fully built out
// yet. The dropdown itself (post-job/page.tsx) already only shows job
// types where active = true; this is just the missing admin UI to flip
// that flag, which the underlying data already supported.
export default function JobTypesToggle() {
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('job_types')
      .select('id, name, description, active')
      .order('name')
      .then(({ data }) => {
        setJobTypes(data ?? [])
        setLoading(false)
      })
  }, [])

  async function toggle(jt: JobType) {
    setSavingId(jt.id)
    setError('')
    const supabase = createClient()
    const { error: updateError } = await supabase.from('job_types').update({ active: !jt.active }).eq('id', jt.id)
    setSavingId(null)
    if (updateError) {
      setError(`Could not save: ${updateError.message}`)
      return
    }
    setJobTypes((prev) => prev.map((j) => (j.id === jt.id ? { ...j, active: !j.active } : j)))
  }

  if (loading) return null

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {jobTypes.map((jt) => (
        <label key={jt.id} className="flex items-start gap-3 py-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={jt.active}
            disabled={savingId === jt.id}
            onChange={() => toggle(jt)}
            className="mt-0.5"
          />
          <span>
            <span className={`text-sm ${jt.active ? 'text-gray-900' : 'text-gray-400'}`}>{jt.name}</span>
            {jt.description && <span className="block text-xs text-gray-400">{jt.description}</span>}
          </span>
        </label>
      ))}
    </div>
  )
}
