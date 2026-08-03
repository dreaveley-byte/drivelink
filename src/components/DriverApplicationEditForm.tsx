'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import FileUploadField from '@/components/FileUploadField'

type DriverApp = {
  id: string
  full_name: string | null
  address: string | null
  cell_phone: string | null
  home_phone: string | null
  email: string | null
  payout_method: string | null
  company_name: string | null
  gst_number: string | null
  status: string
  profile_photo_path: string | null
  drivers_license_path: string | null
  drivers_abstract_path: string | null
  criminal_background_check_path: string | null
  vsa_license_path: string | null
  medical_fitness_path: string | null
  drug_alcohol_test_path: string | null
  optical_test_path: string | null
  void_cheque_path: string | null
  vehicle_registration_path: string | null
  vehicle_insurance_path: string | null
}

export default function DriverApplicationEditForm({ userId, userEmail, application }: { userId: string; userEmail: string; application: DriverApp | null }) {
  const [fullName, setFullName] = useState(application?.full_name ?? '')
  const [address, setAddress] = useState(application?.address ?? '')
  const [cellPhone, setCellPhone] = useState(application?.cell_phone ?? '')
  const [homePhone, setHomePhone] = useState(application?.home_phone ?? '')
  const [email, setEmail] = useState(application?.email ?? userEmail)
  const [payoutMethod, setPayoutMethod] = useState<'individual' | 'company'>((application?.payout_method as 'individual' | 'company') ?? 'individual')
  const [companyName, setCompanyName] = useState(application?.company_name ?? '')
  const [gstNumber, setGstNumber] = useState(application?.gst_number ?? '')
  const [docs, setDocs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function setDoc(key: string) {
    return (path: string) => setDocs((prev) => ({ ...prev, [key]: path }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    const supabase = createClient()

    const fields = {
      full_name: fullName,
      address,
      cell_phone: cellPhone,
      home_phone: homePhone,
      email,
      payout_method: payoutMethod,
      company_name: payoutMethod === 'company' ? companyName : null,
      gst_number: payoutMethod === 'company' ? gstNumber : null,
      ...(docs.profile_photo_path && { profile_photo_path: docs.profile_photo_path }),
      ...(docs.drivers_license_path && { drivers_license_path: docs.drivers_license_path }),
      ...(docs.drivers_abstract_path && { drivers_abstract_path: docs.drivers_abstract_path }),
      ...(docs.criminal_background_check_path && { criminal_background_check_path: docs.criminal_background_check_path }),
      ...(docs.vsa_license_path && { vsa_license_path: docs.vsa_license_path }),
      ...(docs.medical_fitness_path && { medical_fitness_path: docs.medical_fitness_path }),
      ...(docs.drug_alcohol_test_path && { drug_alcohol_test_path: docs.drug_alcohol_test_path }),
      ...(docs.optical_test_path && { optical_test_path: docs.optical_test_path }),
      ...(docs.void_cheque_path && { void_cheque_path: docs.void_cheque_path }),
      ...(docs.vehicle_registration_path && { vehicle_registration_path: docs.vehicle_registration_path }),
      ...(docs.vehicle_insurance_path && { vehicle_insurance_path: docs.vehicle_insurance_path }),
    }

    const { error } = application
      ? await supabase.from('driver_applications').update(fields).eq('id', application.id)
      : await supabase.from('driver_applications').insert({ user_id: userId, ...fields })

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
        <div>
          <label className="block text-sm text-gray-700 mb-1">Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm text-gray-700 mb-1">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Cell phone</label>
          <input value={cellPhone} onChange={(e) => setCellPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Home phone</label>
          <input value={homePhone} onChange={(e) => setHomePhone(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-700 mb-1">Payout method</label>
        <select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value as 'individual' | 'company')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="individual">Individual</option>
          <option value="company">Company</option>
        </select>
      </div>
      {payoutMethod === 'company' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Company name</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">GST number</label>
            <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Replace a document</p>
        <p className="text-xs text-gray-400 -mt-2">Only upload here if you need to replace an existing file — otherwise leave blank.</p>
        <FileUploadField label="Driver's license" bucket="driver-documents" folder={userId} fileName="drivers-license" onUploaded={setDoc('drivers_license_path')} optional />
        <FileUploadField label="Driver's abstract" bucket="driver-documents" folder={userId} fileName="drivers-abstract" onUploaded={setDoc('drivers_abstract_path')} optional />
        <FileUploadField label="Background check" bucket="driver-documents" folder={userId} fileName="background-check" onUploaded={setDoc('criminal_background_check_path')} optional />
        <FileUploadField label="VSA license" bucket="driver-documents" folder={userId} fileName="vsa-license" onUploaded={setDoc('vsa_license_path')} optional />
        <FileUploadField label="Medical fitness" bucket="driver-documents" folder={userId} fileName="medical-fitness" onUploaded={setDoc('medical_fitness_path')} optional />
        <FileUploadField label="Drug & alcohol test" bucket="driver-documents" folder={userId} fileName="drug-alcohol-test" onUploaded={setDoc('drug_alcohol_test_path')} optional />
        <FileUploadField label="Optical test" bucket="driver-documents" folder={userId} fileName="optical-test" onUploaded={setDoc('optical_test_path')} optional />
        <FileUploadField label="Void cheque" bucket="driver-documents" folder={userId} fileName="void-cheque" onUploaded={setDoc('void_cheque_path')} optional />
        <FileUploadField label="Vehicle registration" bucket="driver-documents" folder={userId} fileName="vehicle-registration" onUploaded={setDoc('vehicle_registration_path')} optional />
        <FileUploadField label="Vehicle insurance" bucket="driver-documents" folder={userId} fileName="vehicle-insurance" onUploaded={setDoc('vehicle_insurance_path')} optional />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Application updated.</p>}
      <button
        type="submit"
        disabled={saving}
        className="bg-[#378ADD] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
