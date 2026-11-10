'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUploadField from './FileUploadField'

// Driver's licence: no grace period. The expiry date is read off the uploaded
// photo, then an admin approves it. Until approved, the previously approved
// expiry stays in force (a renewal can't lock out a driver whose licence is
// still valid, but an expired licence stays blocked until the new one is approved).
export default function DriverLicenceSection({
  userId,
  expiryDate,
  pendingExpiryDate,
  pendingUploadedAt,
  transitionUntil,
}: {
  userId: string
  expiryDate: string | null
  pendingExpiryDate: string | null
  pendingUploadedAt: string | null
  transitionUntil: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' })
  const expired = !!expiryDate && expiryDate < today
  const transitionDaysLeft = transitionUntil ? Math.ceil((new Date(transitionUntil).getTime() - Date.now()) / 86400000) : null

  async function handleUpload(path: string) {
    setBusy(true)
    setNote(null)
    const supabase = createClient()
    let extracted: string | null = null
    try {
      const { data: signed } = await supabase.storage.from('driver-documents').createSignedUrl(path, 300)
      if (signed?.signedUrl) {
        const blob = await (await fetch(signed.signedUrl)).blob()
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        const res = await fetch('/api/license-class-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: base64 }),
        })
        extracted = (await res.json())?.expiryDate ?? null
      }
    } catch {
      // reading the date is best-effort; admin can enter it when approving
    }
    await supabase.from('driver_applications').update({ drivers_license_path: path }).eq('user_id', userId)
    await supabase
      .from('profiles')
      .update({ license_pending_expiry_date: extracted, license_pending_uploaded_at: new Date().toISOString() })
      .eq('id', userId)
    setNote(extracted ? `Read expiry date ${extracted} from your photo. Waiting for admin approval.` : 'Uploaded. We could not read an expiry date from the photo - admin will enter it when approving.')
    setBusy(false)
    router.refresh()
  }

  let label = 'No approved licence on file'
  let tone = 'border-gray-200 bg-gray-50 text-gray-500'
  if (expiryDate) {
    label = expired ? `Expired ${expiryDate}` : `Valid until ${expiryDate}`
    tone = expired ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
  } else if (transitionDaysLeft != null && transitionDaysLeft > 0) {
    label = `Upload needed within ${transitionDaysLeft} day${transitionDaysLeft === 1 ? '' : 's'}`
    tone = 'border-amber-200 bg-amber-50 text-amber-700'
  } else {
    label = 'Upload needed - job access is blocked'
    tone = 'border-red-200 bg-red-50 text-red-700'
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-sm font-medium text-gray-900">Driver&apos;s licence</p>
        <span className={`text-xs border rounded-full px-2.5 py-1 ${tone}`}>{label}</span>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        Your licence must be valid at all times - there is no grace period. If it expires you cannot see or claim jobs until a new one is uploaded and approved.
      </p>
      {pendingUploadedAt && (
        <p className="text-xs text-amber-700 mb-2">
          New licence uploaded{pendingExpiryDate ? ` (expiry ${pendingExpiryDate})` : ''} - awaiting admin approval.
        </p>
      )}
      <FileUploadField label="Upload a new licence photo" bucket="driver-documents" folder={userId} fileName="drivers_license" onUploaded={handleUpload} optional />
      {busy && <p className="text-xs text-gray-400 mt-1">Reading your licence…</p>}
      {note && <p className="text-xs text-gray-600 mt-1">{note}</p>}
    </div>
  )
}
