'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type DocKey = 'driver_abstract' | 'drug_alcohol_test' | 'medical_fitness_test' | 'vulnerable_sector_check' | 'vehicle_safety_inspection'

const DOC_LABELS: Record<DocKey, string> = {
  driver_abstract: "Driver's abstract",
  drug_alcohol_test: 'Drug & alcohol test',
  medical_fitness_test: 'Medical fitness test',
  vulnerable_sector_check: 'Vulnerable sector check',
  vehicle_safety_inspection: 'Vehicle safety inspection (passenger driving)',
}

const EXPIRY_MONTHS: Record<DocKey, number> = {
  driver_abstract: 12,
  drug_alcohol_test: 12,
  medical_fitness_test: 12,
  vulnerable_sector_check: 12,
  vehicle_safety_inspection: 6,
}

const DOC_KEYS: DocKey[] = ['driver_abstract', 'drug_alcohol_test', 'medical_fitness_test', 'vulnerable_sector_check']

export default function AdminComplianceReview({
  driverId,
  documents,
  wantsPassengerJobs,
}: {
  driverId: string
  documents: Record<DocKey, { path: string | null; uploadedAt: string | null; reviewedAt: string | null }>
  wantsPassengerJobs: boolean
}) {
  const router = useRouter()
  const [approving, setApproving] = useState<DocKey | null>(null)
  const [signedUrls, setSignedUrls] = useState<Partial<Record<DocKey, string>>>({})

  const keysToShow = wantsPassengerJobs ? [...DOC_KEYS, 'vehicle_safety_inspection' as DocKey] : DOC_KEYS

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        keysToShow.map(async (key) => {
          const path = documents[key]?.path
          if (!path) return [key, null] as const
          const { data } = await supabase.storage.from('driver-documents').createSignedUrl(path, 3600)
          return [key, data?.signedUrl ?? null] as const
        })
      )
      if (!cancelled) {
        setSignedUrls(Object.fromEntries(entries.filter(([, url]) => url)) as Partial<Record<DocKey, string>>)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, wantsPassengerJobs])

  const [error, setError] = useState<string | null>(null)
  const [justApproved, setJustApproved] = useState<DocKey | null>(null)

  async function approve(key: DocKey) {
    setApproving(key)
    setError(null)
    setJustApproved(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ [`${key}_reviewed_at`]: new Date().toISOString(), [`${key}_reviewed_by`]: user?.id })
      .eq('id', driverId)
    setApproving(null)
    if (updateError) {
      setError(`Could not approve ${DOC_LABELS[key]}: ${updateError.message}`)
      return
    }
    setJustApproved(key)
    router.refresh()
  }

  async function unapprove(key: DocKey) {
    setApproving(key)
    setError(null)
    setJustApproved(null)
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ [`${key}_reviewed_at`]: null, [`${key}_reviewed_by`]: null })
      .eq('id', driverId)
    setApproving(null)
    if (updateError) {
      setError(`Could not un-approve ${DOC_LABELS[key]}: ${updateError.message}`)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      {keysToShow.map((key) => {
        const doc = documents[key]
        const url = signedUrls[key]
        const needsReview = !!doc.uploadedAt && (!doc.reviewedAt || (doc.uploadedAt && new Date(doc.uploadedAt) > new Date(doc.reviewedAt)))
        const isApproved = !!doc.reviewedAt && !needsReview
        const manuallyApproved = isApproved && !doc.path
        const expiryMonths = EXPIRY_MONTHS[key]
        let expiryLabel: string | null = null
        if (doc.reviewedAt) {
          const expiresAt = new Date(doc.reviewedAt)
          expiresAt.setMonth(expiresAt.getMonth() + expiryMonths)
          expiryLabel = manuallyApproved
            ? `Manually approved — valid until ${expiresAt.toLocaleDateString('en-CA', { dateStyle: 'medium' })}`
            : `Approved — valid until ${expiresAt.toLocaleDateString('en-CA', { dateStyle: 'medium' })}`
        }
        return (
          <div key={key} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{DOC_LABELS[key]}</p>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#378ADD] underline">
                  View uploaded file
                </a>
              ) : (
                <p className="text-xs text-gray-400">No file uploaded through the app</p>
              )}
              {expiryLabel && <p className={`text-xs mt-0.5 ${manuallyApproved ? 'text-amber-600' : 'text-green-600'}`}>{expiryLabel}</p>}
              {justApproved === key && <p className="text-xs text-green-600 mt-0.5 font-medium">✓ Approved just now</p>}
            </div>
            <div className="flex items-center gap-2">
              {!isApproved && (
                <button
                  onClick={() => approve(key)}
                  disabled={approving === key}
                  className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {approving === key ? 'Approving…' : doc.path ? `Approve (starts ${expiryMonths}-month clock)` : 'Approve without file on record'}
                </button>
              )}
              {isApproved && (
                <button
                  onClick={() => unapprove(key)}
                  disabled={approving === key}
                  className="text-xs text-red-600 underline whitespace-nowrap disabled:opacity-50"
                >
                  {approving === key ? 'Undoing…' : 'Un-approve (mark required)'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
