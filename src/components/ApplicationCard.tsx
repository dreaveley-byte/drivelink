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
  userId,
  profilePhotoPath,
}: {
  table: 'driver_applications' | 'dealer_applications'
  id: string
  title: string
  subtitle: string
  status: string
  bucket: 'driver-documents' | 'dealer-documents'
  docs: Doc[]
  userId?: string
  profilePhotoPath?: string | null
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

    // On driver approval, copy their profile photo to the public bucket so it can be
    // shown on job cards without needing a signed URL every time.
    if (newStatus === 'approved' && table === 'driver_applications' && userId && profilePhotoPath) {
      const { data: fileBlob } = await supabase.storage.from('driver-documents').download(profilePhotoPath)
      if (fileBlob) {
        const ext = profilePhotoPath.split('.').pop() || 'jpg'
        const publicPath = `${userId}/photo.${ext}`
        await supabase.storage.from('driver-photos').upload(publicPath, fileBlob, { upsert: true })
        const { data: urlData } = supabase.storage.from('driver-photos').getPublicUrl(publicPath)
        await supabase.from('profiles').update({ photo_url: urlData.publicUrl }).eq('id', userId)
      }
    }

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
          {loadingDocs ? 'Loading...' : showDocs ? 'Collapse documents' : 'Expand all documents & uploads'}
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
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {docs.map((doc) => {
            const url = doc.path ? links[doc.label] : undefined
            const isImage = doc.path ? /\.(jpe?g|png|webp|gif)$/i.test(doc.path) : false
            return (
              <div key={doc.label} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${doc.path ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {doc.path ? '✓' : '–'}
                  </span>
                  <span className={`text-xs truncate ${doc.path ? 'text-gray-900' : 'text-gray-400'}`}>{doc.label}</span>
                </div>
                {url ? (
                  <div className="flex items-center gap-2 shrink-0">
                    {isImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={doc.label} className="w-10 h-10 object-cover rounded border border-gray-200" />
                    )}
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                      View
                    </a>
                  </div>
                ) : (
                  <span className="text-xs text-gray-300 shrink-0">Not uploaded</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
