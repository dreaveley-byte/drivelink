'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

export default function OrgSettingsPage() {
  const router = useRouter()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
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
      const { data: org } = await supabase.from('organizations').select('id, name, address, phone').eq('id', profile.organization_id).single()
      if (org) {
        setOrgId(org.id)
        setName(org.name ?? '')
        setAddress(org.address ?? '')
        setPhone(org.phone ?? '')
      }
      setLoading(false)
    })
  }, [router])

  async function handleSave() {
    if (!orgId) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('organizations').update({ address, phone }).eq('id', orgId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
        </button>
        <div>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 hover:text-gray-900">
            ← Back to dashboard
          </button>
        </div>
      </main>
    </div>
  )
}
