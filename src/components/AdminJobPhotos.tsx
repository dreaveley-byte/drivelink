'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Photo = {
  id: string
  storage_path: string
  caption: string | null
  url: string | null
}

// Shown on the receipt page for both admin (upload/delete) and dealers
// (view only, since job_admin_photos' RLS already scopes what a dealer
// can see to their own org's jobs) - the same component just renders a
// smaller, read-only version when isAdmin is false.
export default function AdminJobPhotos({ jobId, photos, isAdmin }: { jobId: string; photos: Photo[]; isAdmin: boolean }) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError('')
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      for (const file of Array.from(files)) {
        const path = `${jobId}/admin-photos/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('job-media').upload(path, file)
        if (uploadError) {
          setError(`Could not upload ${file.name}: ${uploadError.message}`)
          continue
        }
        const { error: insertError } = await supabase.from('job_admin_photos').insert({
          job_id: jobId,
          storage_path: path,
          uploaded_by: user?.id ?? null,
        })
        if (insertError) setError(`Could not save ${file.name}: ${insertError.message}`)
      }
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(photo: Photo) {
    setDeletingId(photo.id)
    const supabase = createClient()
    await supabase.storage.from('job-media').remove([photo.storage_path])
    await supabase.from('job_admin_photos').delete().eq('id', photo.id)
    setDeletingId(null)
    router.refresh()
  }

  if (!isAdmin && photos.length === 0) return null

  return (
    <div className={isAdmin ? 'border border-gray-200 rounded-xl p-4' : ''}>
      {isAdmin && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-900">Additional photos (registration, etc.)</p>
          <label className="text-sm text-[#378ADD] cursor-pointer hover:underline">
            {uploading ? 'Uploading…' : '+ Add photos'}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </label>
        </div>
      )}
      {!isAdmin && <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Additional documents</p>}
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {photos.length === 0 ? (
        isAdmin && <p className="text-xs text-gray-400">No additional photos yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative">
              {photo.url ? (
                <a href={photo.url} target="_blank" rel="noopener noreferrer">
                  <img src={photo.url} alt={photo.caption ?? ''} className="w-full aspect-square object-cover rounded-lg border border-gray-200" />
                </a>
              ) : (
                <div className="w-full aspect-square rounded-lg border border-gray-200 bg-gray-50" />
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleDelete(photo)}
                  disabled={deletingId === photo.id}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white text-xs rounded-full flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
