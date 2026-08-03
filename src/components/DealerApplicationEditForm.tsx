'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import FileUploadField from '@/components/FileUploadField'

type DealerApp = {
  id: string
  organization_id: string
  business_name: string | null
  business_address: string | null
  pst_number: string | null
  gst_number: string | null
  dealer_number: string | null
  contact_full_name: string | null
  contact_position: string | null
  store_phone: string | null
  contact_cell_phone: string | null
  payment_method: string | null
  status: string
  pre_authorized_debit_form_path: string | null
}

export default function DealerApplicationEditForm({ userId, organizationId, application }: { userId: string; organizationId: string | null; application: DealerApp | null }) {
  const [businessName, setBusinessName] = useState(application?.business_name ?? '')
  const [businessAddress, setBusinessAddress] = useState(application?.business_address ?? '')
  const [pstNumber, setPstNumber] = useState(application?.pst_number ?? '')
  const [gstNumber, setGstNumber] = useState(application?.gst_number ?? '')
  const [dealerNumber, setDealerNumber] = useState(application?.dealer_number ?? '')
  const [contactFullName, setContactFullName] = useState(application?.contact_full_name ?? '')
  const [contactPosition, setContactPosition] = useState(application?.contact_position ?? '')
  const [storePhone, setStorePhone] = useState(application?.store_phone ?? '')
  const [contactCellPhone, setContactCellPhone] = useState(application?.contact_cell_phone ?? '')
  const [padPath, setPadPath] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    const supabase = createClient()

    const fields = {
      business_name: businessName,
      business_address: businessAddress,
      pst_number: pstNumber || null,
      gst_number: gstNumber || null,
      dealer_number: dealerNumber || null,
      contact_full_name: contactFullName,
      contact_position: contactPosition,
      store_phone: storePhone,
      contact_cell_phone: contactCellPhone,
      ...(padPath && { pre_authorized_debit_form_path: padPath }),
    }

    const { error } = application
      ? await supabase.from('dealer_applications').update(fields).eq('id', application.id)
      : await supabase.from('dealer_applications').insert({ submitted_by: userId, organization_id: organizationId, ...fields })

    // Keep the organization's display name in sync since that's what shows
    // everywhere else in the app (admin dealer list, job cards, etc).
    const orgId = application?.organization_id ?? organizationId
    if (!error && orgId) {
      await supabase.from('organizations').update({ name: businessName }).eq('id', orgId)
    }

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setSaved(true)
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 uppercase tracking-wide">
          {application ? 'Your submitted application' : 'Complete your application'}
        </p>
        {application && (
          <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1 capitalize">
            {application.status.replace('_', ' ')}
          </span>
        )}
      </div>
      {!application && (
        <p className="text-xs text-gray-400 -mt-3">
          No application on file yet — fill in what you can below and save. An admin will review it once submitted.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm text-gray-700 mb-1">Business name</label>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm text-gray-700 mb-1">Business address</label>
          <input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">PST number</label>
          <input value={pstNumber} onChange={(e) => setPstNumber(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">GST number</label>
          <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Dealer number</label>
          <input value={dealerNumber} onChange={(e) => setDealerNumber(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Store phone</label>
          <input value={storePhone} onChange={(e) => setStorePhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Contact name</label>
          <input value={contactFullName} onChange={(e) => setContactFullName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Contact position</label>
          <input value={contactPosition} onChange={(e) => setContactPosition(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Contact cell phone</label>
          <input value={contactCellPhone} onChange={(e) => setContactCellPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Replace a document</p>
        <FileUploadField label="Pre-authorized debit form" bucket="dealer-documents" folder={userId} fileName="pad-form" onUploaded={setPadPath} optional />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Application updated.</p>}
      <button
        type="submit"
        disabled={saving}
        className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
