'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PhotoCaptureField from '@/components/PhotoCaptureField'

export default function ProfileSettingsForm({
  userId,
  initialFullName,
  initialPhone,
  initialEmail,
  initialSmsOptIn,
  showSmsToggle,
  photoTarget,
  initialGender,
  showGender = true,
}: {
  userId: string
  initialFullName: string
  initialPhone: string
  initialEmail: string
  initialSmsOptIn: boolean
  showSmsToggle: boolean
  initialGender?: string | null
  showGender?: boolean
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
  const [gender, setGender] = useState(initialGender ?? '')
  const [smsOptIn, setSmsOptIn] = useState(initialSmsOptIn)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [photoUrl, setPhotoUrl] = useState(photoTarget?.currentUrl ?? null)
  const [photoSaved, setPhotoSaved] = useState(false)

  const [email, setEmail] = useState(initialEmail)
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailSaved, setEmailSaved] = useState(false)
  const [emailError, setEmailError] = useState('')


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

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    setSavingEmail(true)
    setEmailError('')
    setEmailSaved(false)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email })
    setSavingEmail(false)
    if (error) {
      setEmailError(error.message)
      return
    }
    setEmailSaved(true)
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
      .update({ full_name: fullName, phone, sms_notifications_opt_in: smsOptIn, gender: gender || null })
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
        {showGender && (
          <div>
            <label className="block text-sm text-gray-700 mb-1">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        )}
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
          className="bg-[#378ADD] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
        >
          {savingProfile ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <form onSubmit={saveEmail} className="space-y-4 border-t border-gray-100 pt-6">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Login email</p>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        {emailError && <p className="text-sm text-red-600">{emailError}</p>}
        {emailSaved && <p className="text-sm text-green-700">Check both your old and new inbox to confirm the change.</p>}
        <button
          type="submit"
          disabled={savingEmail}
          className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {savingEmail ? 'Saving…' : 'Update email'}
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
