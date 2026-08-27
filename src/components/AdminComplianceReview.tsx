'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type DocKey = 'driver_abstract' | 'drug_alcohol_test' | 'medical_fitness_test' | 'vulnerable_sector_check'

const DOC_LABELS: Record<DocKey, string> = {
  driver_abstract: "Driver's abstract",
  drug_alcohol_test: 'Drug & alcohol test',
  medical_fitness_test: 'Medical fitness test',
  vulnerable_sector_check: 'Vulnerable sector check',
}

const DOC_KEYS: DocKey[] = ['driver_abstract', 'drug_alcohol_test', 'medical_fitness_test', 'vulnerable_sector_check']
const EXPIRY_MONTHS = 12

export default function AdminComplianceReview({
  driverId,
  documents,
}: {
  driverId: string
  documents: Record<DocKey, { path: string | null; uploadedAt: string | null; reviewedAt: string | null }>
}) {
  const router = useRouter()
  const [approving, setApproving] = useState<DocKey | null>(null)
  const [signedUrls, setSignedUrls] = useState<Partial<Record<DocKey, string>>>({})

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        DOC_KEYS.map(async (key) => {
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
  }, [driverId])

  async function approve(key: DocKey) {
    setApproving(key)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('profiles')
      .update({ [`${key}_reviewed_at`]: new Date().toISOString(), [`${key}_reviewed_by`]: user?.id })
      .eq('id', driverId)
    setApproving(null)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {DOC_KEYS.map((key) => {
        const doc = documents[key]
        const url = signedUrls[key]
        const needsReview = !!doc.uploadedAt && (!doc.reviewedAt || (doc.uploadedAt && new Date(doc.uploadedAt) > new Date(doc.reviewedAt)))
        let expiryLabel: string | null = null
        if (doc.reviewedAt) {
          const expiresAt = new Date(doc.reviewedAt)
          expiresAt.setMonth(expiresAt.getMonth() + EXPIRY_MONTHS)
          expiryLabel = `Approved — valid until ${expiresAt.toLocaleDateString('en-CA', { dateStyle: 'medium' })}`
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
                <p className="text-xs text-gray-400">Not uploaded</p>
              )}
              {expiryLabel && !needsReview && <p className="text-xs text-green-600 mt-0.5">{expiryLabel}</p>}
            </div>
            {needsReview && (
              <button
                onClick={() => approve(key)}
                disabled={approving === key}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
              >
                {approving === key ? 'Approving…' : 'Approve (starts 12-month clock)'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
