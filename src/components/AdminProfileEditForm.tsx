'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PhotoCaptureField from '@/components/PhotoCaptureField'

export default function AdminProfileEditForm({
  userId,
  initialFullName,
  initialPhone,
  initialGender,
  photoTarget,
}: {
  userId: string
  initialFullName: string
  initialPhone: string
  initialGender?: string | null
  photoTarget?: {
    currentUrl: string | null
    bucket: 'driver-photos' | 'dealer-logos'
    folder: string
    label: string
  }
}) {
  const router = useRouter()
  const [fullName, setFullName] = useState(initialFullName)
  const [phone, setPhone] = useState(initialPhone)
  const [gender, setGender] = useState(initialGender ?? '')
  const [photoUrl, setPhotoUrl] = useState(photoTarget?.currentUrl ?? null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handlePhotoCaptured(blob: Blob) {
    if (!photoTarget) return
    const supabase = createClient()
    const path = `${photoTarget.folder}/photo.jpg`
    const { error: uploadError } = await supabase.storage.from(photoTarget.bucket).upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    const { data: signed } = await supabase.storage.from(photoTarget.bucket).createSignedUrl(path, 60 * 60 * 24 * 365)
    if (signed?.signedUrl) setPhotoUrl(signed.signedUrl)
    await supabase.from('profiles').update({ photo_url: signed?.signedUrl }).eq('id', userId)
    router.refresh()
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone, gender: gender || null })
      .eq('id', userId)
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-gray-900">Edit profile</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {photoTarget && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">{photoTarget.label}</label>
          <PhotoCaptureField currentUrl={photoUrl} onCaptured={handlePhotoCaptured} label="Change photo" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Gender</label>
        <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Prefer not to say</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="bg-[#378ADD] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  )
}
