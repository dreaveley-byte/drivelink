'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import DiscountCodeRedeemer from '@/components/DiscountCodeRedeemer'

export default function OrgSettingsPage() {
  const router = useRouter()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [googleReviewLink, setGoogleReviewLink] = useState('')
  const [sendGoogleReviewDefault, setSendGoogleReviewDefault] = useState(true)
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('organization_id, role').eq('id', user.id).single()
      if (!profile?.organization_id) {
        router.push('/dashboard')
        return
      }
      if (profile.role !== 'org_admin') {
        router.push('/dashboard')
        return
      }
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name, address, phone, google_review_link, send_google_review_default')
        .eq('id', profile.organization_id)
        .single()
      if (org) {
        setOrgId(org.id)
        setName(org.name ?? '')
        setAddress(org.address ?? '')
        setPhone(org.phone ?? '')
        setGoogleReviewLink(org.google_review_link ?? '')
        setSendGoogleReviewDefault(org.send_google_review_default ?? true)
      }
      setLoading(false)
    })
  }, [router])

  async function handleSave() {
    if (!orgId) return
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('organizations')
      .update({ address, phone, google_review_link: googleReviewLink || null, send_google_review_default: sendGoogleReviewDefault })
      .eq('id', orgId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLookup() {
    if (!orgId) return
    setLookingUp(true)
    setLookupError('')
    try {
      const res = await fetch('/api/organizations/lookup-google-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      })
      const data = await res.json()
      if (data.ok) {
        setGoogleReviewLink(data.reviewLink)
      } else if (data.error === 'not_found') {
        setLookupError("Couldn't find a matching Google Business listing — check the address above, or paste your review link in directly below.")
      } else {
        setLookupError('Lookup failed — you can paste your review link in directly below instead.')
      }
    } catch {
      setLookupError('Lookup failed — you can paste your review link in directly below instead.')
    }
    setLookingUp(false)
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2">
          <Logo height={22} />
          <span className="text-sm text-gray-400">— Business Info</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">Used on the delivery disclosure document customers sign</p>
      </header>

      <main className="max-w-md mx-auto px-6 py-8 space-y-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Dealership name</label>
          <input value={name} disabled className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="pt-2 border-t border-gray-100">
          <label className="block text-sm text-gray-700 mb-1">Google review link</label>
          <p className="text-xs text-gray-500 mb-1.5">Used to ask customers for a Google review after their delivery.</p>
          <div className="flex gap-2 mb-1.5">
            <input
              value={googleReviewLink}
              onChange={(e) => setGoogleReviewLink(e.target.value)}
              placeholder="https://search.google.com/local/writereview?placeid=..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={handleLookup}
              disabled={lookingUp}
              className="text-sm bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap"
            >
              {lookingUp ? 'Looking up…' : 'Look up automatically'}
            </button>
          </div>
          {lookupError && <p className="text-xs text-red-600 mb-1.5">{lookupError}</p>}
          <label className="flex items-center gap-2 text-sm text-gray-700 mt-2">
            <input type="checkbox" checked={sendGoogleReviewDefault} onChange={(e) => setSendGoogleReviewDefault(e.target.checked)} />
            Request a Google review by default when scheduling a delivery
          </label>
          <p className="text-xs text-gray-400 mt-1">Can still be turned off for an individual delivery when it's booked.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#378ADD] text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
        </button>

        {orgId && <DiscountCodeRedeemer orgId={orgId} />}

        <div>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 hover:text-gray-900">
            ← Back to dashboard
          </button>
        </div>
      </main>
    </div>
  )
}
