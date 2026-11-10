'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminLicenceReview({
  driverId,
  licensePath,
  expiryDate,
  approvedAt,
  pendingExpiryDate,
  pendingUploadedAt,
  applicationExtractedExpiry,
  transitionUntil,
}: {
  driverId: string
  licensePath: string | null
  expiryDate: string | null
  approvedAt: string | null
  pendingExpiryDate: string | null
  pendingUploadedAt: string | null
  applicationExtractedExpiry: string | null
  transitionUntil: string | null
}) {
  const router = useRouter()
  const [url, setUrl] = useState<string | null>(null)
  const [date, setDate] = useState(pendingExpiryDate ?? applicationExtractedExpiry ?? expiryDate ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' })
  const expired = !!expiryDate && expiryDate < today

  useEffect(() => {
    if (!licensePath) return
    createClient().storage.from('driver-documents').createSignedUrl(licensePath, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null))
  }, [licensePath])

  async function approve() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Enter the expiry date printed on the licence.')
      return
    }
    setSaving(true)
    setError(null)
    const fromPhoto = date === (pendingExpiryDate ?? applicationExtractedExpiry)
    const { error: e } = await createClient()
      .from('profiles')
      .update({
        license_expiry_date: date,
        license_approved_at: new Date().toISOString(),
        license_pending_expiry_date: null,
        license_pending_uploaded_at: null,
        license_expiry_source: fromPhoto ? 'photo' : 'manual',
      })
      .eq('id', driverId)
    setSaving(false)
    if (e) setError(e.message)
    else router.refresh()
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 mb-3">
      <p className="text-sm font-medium text-gray-900">Driver&apos;s licence (no grace period, no override)</p>
      <p className="text-xs mt-0.5 text-gray-500">
        {expiryDate
          ? expired
            ? <span className="text-red-600 font-medium">Expired {expiryDate} - driver cannot view or claim jobs.</span>
            : `Approved - valid until ${expiryDate}`
          : transitionUntil && new Date(transitionUntil) > new Date()
            ? `No expiry on file - transition window ends ${new Date(transitionUntil).toLocaleDateString('en-CA', { dateStyle: 'medium' })}`
            : <span className="text-red-600 font-medium">No approved expiry on file - driver is blocked.</span>}
        {approvedAt && ` (approved ${new Date(approvedAt).toLocaleDateString('en-CA', { dateStyle: 'medium' })})`}
      </p>
      {pendingUploadedAt && <p className="text-xs text-amber-700 mt-1">New licence uploaded - needs your approval.</p>}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#378ADD] underline block mt-1">View licence photo</a>
      ) : (
        <p className="text-xs text-gray-400 mt-1">No licence photo on file.</p>
      )}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <label className="text-xs text-gray-500">Expiry date on licence</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-2 py-1" />
        <button onClick={approve} disabled={saving} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Approve licence'}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mt-1">Check the date against the photo before approving - the date is read automatically and can be wrong.</p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
