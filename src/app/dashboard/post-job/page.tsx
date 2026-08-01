'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type JobType = { id: string; name: string }
type Organization = { id: string; name: string }

export default function PostJobPage() {
  const router = useRouter()
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [jobTypeId, setJobTypeId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [newDealerName, setNewDealerName] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [secondDriver, setSecondDriver] = useState(false)
  const [chaseVehicle, setChaseVehicle] = useState(false)
  const [isTradeIn, setIsTradeIn] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('job_types')
      .select('id, name')
      .eq('active', true)
      .then(({ data }) => {
        setJobTypes(data ?? [])
        if (data?.[0]) setJobTypeId(data[0].id)
      })

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'platform_admin') {
        setIsAdmin(true)
        const { data: orgs } = await supabase.from('organizations').select('id, name').order('name')
        setOrganizations(orgs ?? [])
        if (orgs?.[0]) setSelectedOrgId(orgs[0].id)
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('You need to be signed in.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    let orgIdToUse = profile?.role === 'platform_admin' ? selectedOrgId : profile?.organization_id

    if (profile?.role === 'platform_admin' && selectedOrgId === '__new__') {
      if (!newDealerName.trim()) {
        setError('Please enter a name for the new dealer.')
        setLoading(false)
        return
      }
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: newDealerName.trim(), org_type: 'dealer_customer' })
        .select('id')
        .single()

      if (orgError) {
        setError(orgError.message)
        setLoading(false)
        return
      }
      orgIdToUse = newOrg.id
    }

    if (!orgIdToUse) {
      setError(
        profile?.role === 'platform_admin'
          ? 'Please select a dealer to post this job for.'
          : 'Your account is not linked to an organization yet.'
      )
      setLoading(false)
      return
    }

    const { error } = await supabase.from('jobs').insert({
      organization_id: orgIdToUse,
      job_type_id: jobTypeId,
      created_by: user.id,
      pickup_address: pickupAddress,
      dropoff_address: dropoffAddress,
      recipient_name: recipientName || null,
      recipient_phone: recipientPhone || null,
      scheduled_for: scheduledFor || null,
      second_driver_required: secondDriver,
      chase_vehicle_required: chaseVehicle,
      is_trade_in_pickup: isTradeIn,
      notes: notes || null,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Post a new job</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {isAdmin && (
            <div>
              <label className="block text-sm text-gray-700 mb-1">Posting for dealer</label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
                <option value="__new__">+ Add a new dealer...</option>
              </select>

              {selectedOrgId === '__new__' && (
                <input
                  autoFocus
                  placeholder="New dealer name"
                  value={newDealerName}
                  onChange={(e) => setNewDealerName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2"
                />
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-700 mb-1">Job type</label>
            <select
              value={jobTypeId}
              onChange={(e) => setJobTypeId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {jobTypes.map((jt) => (
                <option key={jt.id} value={jt.id}>{jt.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Pickup address</label>
            <input
              required
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Dropoff address</label>
            <input
              required
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Recipient name</label>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Recipient phone</label>
              <input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Scheduled for</label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2 border border-gray-200 rounded-lg p-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isTradeIn} onChange={(e) => setIsTradeIn(e.target.checked)} />
              This includes a trade-in pickup (same driver, same trip — no extra charge)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={secondDriver} onChange={(e) => setSecondDriver(e.target.checked)} />
              Second driver required <span className="text-gray-400">(extra charge)</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={chaseVehicle} onChange={(e) => setChaseVehicle(e.target.checked)} />
              Chase vehicle required <span className="text-gray-400">(extra charge)</span>
            </label>
            <p className="text-xs text-gray-400 pt-1">
              Additional charges may apply for ferries, flights, out-of-province inspections, registry visits, or insurance arrangements.
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Posting...' : 'Post job'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-500 px-3 py-2.5"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
