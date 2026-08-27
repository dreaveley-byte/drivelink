'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUploadField from './FileUploadField'

type DocKey = 'driver_abstract' | 'drug_alcohol_test' | 'medical_fitness_test' | 'vulnerable_sector_check'

const DOC_LABELS: Record<DocKey, string> = {
  driver_abstract: "Driver's abstract",
  drug_alcohol_test: 'Drug & alcohol test',
  medical_fitness_test: 'Medical fitness test',
  vulnerable_sector_check: 'Vulnerable sector check',
}

const DOC_KEYS: DocKey[] = ['driver_abstract', 'drug_alcohol_test', 'medical_fitness_test', 'vulnerable_sector_check']
const EXPIRY_MONTHS = 12

function statusFor(reviewedAt: string | null, uploadedAt: string | null): { label: string; tone: 'green' | 'amber' | 'red' | 'gray' } {
  if (reviewedAt) {
    const expiresAt = new Date(reviewedAt)
    expiresAt.setMonth(expiresAt.getMonth() + EXPIRY_MONTHS)
    const now = new Date()
    const daysLeft = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft < 0) {
      return { label: `Expired ${expiresAt.toLocaleDateString('en-CA', { dateStyle: 'medium' })}`, tone: 'red' }
    }
    if (daysLeft <= 30) {
      return { label: `Expires ${expiresAt.toLocaleDateString('en-CA', { dateStyle: 'medium' })} — renew soon`, tone: 'amber' }
    }
    return { label: `Valid until ${expiresAt.toLocaleDateString('en-CA', { dateStyle: 'medium' })}`, tone: 'green' }
  }
  if (uploadedAt) {
    return { label: 'Uploaded — awaiting admin review', tone: 'amber' }
  }
  return { label: 'Not yet uploaded', tone: 'gray' }
}

const TONE_CLASSES: Record<string, string> = {
  green: 'border-green-200 bg-green-50 text-green-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  gray: 'border-gray-200 bg-gray-50 text-gray-500',
}

export default function ComplianceDocumentsSection({
  userId,
  documents,
}: {
  userId: string
  documents: Record<DocKey, { path: string | null; uploadedAt: string | null; reviewedAt: string | null }>
}) {
  const router = useRouter()
  const [saving, setSaving] = useState<DocKey | null>(null)

  async function handleUpload(key: DocKey, path: string) {
    setSaving(key)
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ [`${key}_path`]: path, [`${key}_uploaded_at`]: new Date().toISOString(), [`${key}_reviewed_at`]: null })
      .eq('id', userId)
    setSaving(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        These need to be uploaded and reviewed by admin at least once every {EXPIRY_MONTHS} months — you won&apos;t be able to claim
        new jobs once one expires.
      </p>
      {DOC_KEYS.map((key) => {
        const doc = documents[key]
        const status = statusFor(doc.reviewedAt, doc.uploadedAt)
        return (
          <div key={key} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900">{DOC_LABELS[key]}</p>
              <span className={`text-xs border rounded-full px-2.5 py-1 ${TONE_CLASSES[status.tone]}`}>{status.label}</span>
            </div>
            <FileUploadField
              label={doc.path ? 'Replace with a new file' : 'Upload'}
              bucket="driver-documents"
              folder={userId}
              fileName={key}
              onUploaded={(path) => handleUpload(key, path)}
              optional
            />
            {saving === key && <p className="text-xs text-gray-400 mt-1">Saving…</p>}
          </div>
        )
      })}
    </div>
  )
}
