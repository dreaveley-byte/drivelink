'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage, DOCUMENT_COMPRESSION } from '@/lib/compressImage'

export default function FileUploadField({
  label,
  bucket,
  folder,
  fileName,
  onUploaded,
  optional = false,
  accept = 'image/*,.pdf',
}: {
  label: string
  bucket: 'driver-documents' | 'dealer-documents'
  folder: string
  fileName: string
  onUploaded: (path: string) => void
  optional?: boolean
  accept?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadedName, setUploadedName] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return
    setError('')
    setUploading(true)
    // Photos of licences, abstracts etc. - kept readable, but not at full
    // phone-camera size. PDFs and videos pass through untouched.
    const file = await compressImage(rawFile, DOCUMENT_COMPRESSION)

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${folder}/${fileName}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    setUploadedName(file.name)
    setUploading(false)
    onUploaded(path)
  }

  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">
        {label} {optional && <span className="text-gray-400">(optional)</span>}
      </label>
      <div className="border border-dashed border-gray-300 rounded-lg px-3 py-3 text-sm">
        <input
          type="file"
          accept={accept}
          capture="environment"
          onChange={handleFile}
          className="text-xs text-gray-600 w-full"
        />
        {uploading && <p className="text-xs text-gray-400 mt-1">Uploading...</p>}
        {uploadedName && !uploading && (
          <p className="text-xs text-green-600 mt-1">✓ {uploadedName} uploaded</p>
        )}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    </div>
  )
}
