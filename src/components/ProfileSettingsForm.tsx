'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PhotoCaptureField from '@/components/PhotoCaptureField'

export default function ProfileSettingsForm({
  userId,
  initialFullName,
  initialPhone,
  initialSmsOptIn,
  showSmsToggle,
  photoTarget,
}: {
  userId: string
  initialFullName: string
  initialPhone: string
  initialSmsOptIn: boolean
  showSmsToggle: boolean
  photoTarget?: {
    kind: 'driver' | 'dealer'
    currentUrl: string | null
    bucket: 'driver-photos' | 'dealer-logos'
    folder: string
    label: string
  }
}) {
  const router = useRouter()
  const [fullName, setFullName] = useState(initialFullName)
  const [phone, setPhone] = useState(initialPhone)
  const [smsOptIn, setSmsOptIn] = useState(initialSmsOptIn)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [photoUrl, setPhotoUrl] = useState(photoTarget?.currentUrl ?? null)
  const [photoSaved, setPhotoSaved] = useState(false)

  async function handlePhotoCaptured(blob: Blob) {
    if (!photoTarget) return
    const supabase = createClient()
    const path = `${photoTarget.folder}/photo.jpg`
    const { error } = await supabase.storage.from(photoTarget.bucket).upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) {
      setProfileError(error.message)
      return
    }
    const { data: urlData } = supabase.storage.from(photoTarget.bucket).getPublicUrl(path)
    // Cache-bust so the new photo shows immediately instead of a stale cached image
    const freshUrl = `${urlData.publicUrl}?t=${Date.now()}`

    if (photoTarget.kind === 'driver') {
      await supabase.from('profiles').update({ photo_url: freshUrl }).eq('id', userId)
    } else {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', userId).single()
      if (profile?.organization_id) {
        await supabase.from('organizations').update({ logo_url: freshUrl }).eq('id', profile.organization_id)
      }
    }

    setPhotoUrl(freshUrl)
    setPhotoSaved(true)
    router.refresh()
  }

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    setProfileError('')
    setProfileSaved(false)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone, sms_notifications_opt_in: smsOptIn })
      .eq('id', userId)
    setSavingProfile(false)
    if (error) {
      setProfileError(error.message)
      return
    }
    setProfileSaved(true)
    router.refresh()
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSaved(false)
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords don\u2019t match.')
      return
    }
    setSavingPassword(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) {
      setPasswordError(error.message)
      return
    }
    setPasswordSaved(true)
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="space-y-8">
      {photoTarget && (
        <div className="pb-6 border-b border-gray-100">
          <PhotoCaptureField
            label={photoTarget.label}
            currentUrl={photoUrl}
            shape={photoTarget.kind === 'driver' ? 'circle' : 'square'}
            onCaptured={handlePhotoCaptured}
          />
          {photoSaved && <p className="text-sm text-green-700 mt-2">Photo updated.</p>}
        </div>
      )}

      <form onSubmit={saveProfile} className="space-y-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Profile</p>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        {showSmsToggle && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={smsOptIn} onChange={(e) => setSmsOptIn(e.target.checked)} />
            Text me when new jobs are posted
          </label>
        )}
        {profileError && <p className="text-sm text-red-600">{profileError}</p>}
        {profileSaved && <p className="text-sm text-green-700">Saved.</p>}
        <button
          type="submit"
          disabled={savingProfile}
          className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {savingProfile ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <form onSubmit={savePassword} className="space-y-4 border-t border-gray-100 pt-6">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Change password</p>
        <div>
          <label className="block text-sm text-gray-700 mb-1">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
        {passwordSaved && <p className="text-sm text-green-700">Password updated.</p>}
        <button
          type="submit"
          disabled={savingPassword}
          className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {savingPassword ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
