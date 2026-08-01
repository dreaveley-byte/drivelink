'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Doc = { label: string; path: string | null }

export default function ApplicationCard({
  table,
  id,
  title,
  subtitle,
  status,
  bucket,
  docs,
}: {
  table: 'driver_applications' | 'dealer_applications'
  id: string
  title: string
  subtitle: string
  status: string
  bucket: 'driver-documents' | 'dealer-documents'
  docs: Doc[]
}) {
  const router = useRouter()
  const [showDocs, setShowDocs] = useState(false)
  const [links, setLinks] = useState<Record<string, string>>({})
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [updating, setUpdating] = useState(false)

  const statusStyles: Record<string, string> = {
    pending: 'border-gray-300 text-gray-700',
    in_review: 'border-blue-300 text-blue-700',
    approved: 'border-green-300 text-green-700',
    rejected: 'border-red-300 text-red-700',
  }

  async function toggleDocs() {
    if (showDocs) {
      setShowDocs(false)
      return
    }
    setLoadingDocs(true)
    const supabase = createClient()
    const entries: Record<string, string> = {}
    for (const doc of docs) {
      if (!doc.path) continue
      const { data } = await supabase.storage.from(bucket).createSignedUrl(doc.path, 60 * 10)
      if (data?.signedUrl) entries[doc.label] = data.signedUrl
    }
    setLinks(entries)
    setLoadingDocs(false)
    setShowDocs(true)
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    const supabase = createClient()
    await supabase.from(table).update({ status: newStatus }).eq('id', id)
    setUpdating(false)
    router.refresh()
  }

  return (
    <div className="border border-gray-200 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <span className={`text-xs border rounded-full px-2.5 py-1 whitespace-nowrap ${statusStyles[status] ?? 'border-gray-300 text-gray-700'}`}>
          {status.replace('_', ' ')}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button onClick={toggleDocs} className="text-xs text-gray-600 hover:text-gray-900 underline">
          {loadingDocs ? 'Loading...' : showDocs ? 'Hide documents' : 'View documents'}
        </button>

        {status !== 'approved' && (
          <button
            onClick={() => updateStatus('approved')}
            disabled={updating}
            className="text-xs bg-gray-900 text-white px-3 py-1 rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            Approve
          </button>
        )}
        {status !== 'rejected' && (
          <button
            onClick={() => updateStatus('rejected')}
            disabled={updating}
            className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Reject
          </button>
        )}
      </div>

      {showDocs && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
          {docs.filter((d) => d.path).length === 0 && (
            <p className="text-xs text-gray-400 col-span-2">No documents uploaded.</p>
          )}
          {docs.map((doc) =>
            doc.path && links[doc.label] ? (
              <a
                key={doc.label}
                href={links[doc.label]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                {doc.label}
              </a>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}
