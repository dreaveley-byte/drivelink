'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUploadField from '@/components/FileUploadField'
import SignaturePad from '@/components/SignaturePad'
import Logo from '@/components/Logo'
import LegalDocumentChecklist from '@/components/LegalDocumentChecklist'
import { DRIVER_REQUIRED_DOCS } from '@/lib/legalDocuments'

const DRIVER_DOC_LABELS: Record<string, string> = {
  driver_contractor_agreement: 'Driver Independent Contractor Services Agreement',
  drug_alcohol_policy: 'Drug and Alcohol Policy',
  driver_standards_code_of_conduct: 'Driver Standards and Code of Conduct',
  vehicle_inspection_damage_policy: 'Vehicle Inspection and Damage Policy',
  driver_expense_reimbursement_policy: 'Driver Expense and Reimbursement Policy',
  driver_hours_fatigue_safety_policy: 'Driver Hours & Fatigue Safety Policy',
  privacy_policy: 'Privacy Policy',
  platform_terms_of_service: 'Platform Terms of Service',
}
const DRIVER_DOC_LIST = DRIVER_REQUIRED_DOCS.map((slug) => ({ slug, label: DRIVER_DOC_LABELS[slug] }))

export default function DriverApplyPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)

  // Personal info
  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [cellPhone, setCellPhone] = useState('')
  const [homePhone, setHomePhone] = useState('')
  const [email, setEmail] = useState('')

  // Payment / tax
  const [payoutMethod, setPayoutMethod] = useState<'individual' | 'company'>('individual')
  const [companyName, setCompanyName] = useState('')
  const [gstNumber, setGstNumber] = useState('')
  const [sinNumber, setSinNumber] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleMileage, setVehicleMileage] = useState('')
  const [licenseClass, setLicenseClass] = useState('')
  const [extractedLicenseClass, setExtractedLicenseClass] = useState('')
  const [extractingLicenseClass, setExtractingLicenseClass] = useState(false)
  const [canTowTrailer, setCanTowTrailer] = useState<boolean | null>(null)
  const [availableJobTypes, setAvailableJobTypes] = useState<{ id: string; name: string }[]>([])
  const [preferredJobTypes, setPreferredJobTypes] = useState<string[]>([])

  // Uploaded document paths
  const [docs, setDocs] = useState<Record<string, string>>({})

  // Contract — accepted legal documents (slug -> version accepted)
  const [acceptedDocs, setAcceptedDocs] = useState<Record<string, number>>({})
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id)
        setEmail(user.email ?? '')
      }
    })
    supabase.from('job_types').select('id, name').eq('active', true).order('name').then(({ data }) => {
      if (data) setAvailableJobTypes(data)
    })
  }, [])

  function toggleJobTypePreference(name: string) {
    setPreferredJobTypes((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  function setDoc(key: string) {
    return (path: string) => setDocs((prev) => ({ ...prev, [key]: path }))
  }

  // Automatically reads the license class off the photo once uploaded,
  // rather than relying only on the driver's own self-reported dropdown -
  // shown to admin alongside the self-reported value so they can be
  // cross-checked, since some jobs require a specific class (e.g. Class 4)
  // or towing capability.
  async function handleLicenseUpload(path: string) {
    setDoc('drivers_license')(path)
    setExtractingLicenseClass(true)
    try {
      const supabase = createClient()
      const { data: signedUrlData } = await supabase.storage.from('driver-documents').createSignedUrl(path, 300)
      if (!signedUrlData?.signedUrl) return
      const imageRes = await fetch(signedUrlData.signedUrl)
      const blob = await imageRes.blob()
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
      const data = await res.json()
      if (data.licenseClass) {
        setExtractedLicenseClass(data.licenseClass)
        // Only auto-fill the self-reported dropdown if it's still blank -
        // never silently overwrite something the driver already picked
        // themselves.
        if (!licenseClass) setLicenseClass(data.licenseClass)
      }
    } catch {
      // Extraction is a nice-to-have on top of the self-reported dropdown
      // — don't block the application over it.
    } finally {
      setExtractingLicenseClass(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!userId) {
      setError('You need to be signed in to apply.')
      return
    }
    const missingDocs = DRIVER_REQUIRED_DOCS.filter((slug) => acceptedDocs[slug] == null)
    if (missingDocs.length > 0) {
      setError('Please review and agree to all agreements/policies before submitting.')
      return
    }
    if (!signatureDataUrl) {
      setError('Please sign the contract at the bottom before submitting.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    // Upload the signature image
    const signatureBlob = await (await fetch(signatureDataUrl)).blob()
    const signaturePath = `${userId}/contract-signature.png`
    const { error: sigError } = await supabase.storage
      .from('driver-documents')
      .upload(signaturePath, signatureBlob, { upsert: true, contentType: 'image/png' })

    if (sigError) {
      setError(sigError.message)
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('driver_applications').insert({
      user_id: userId,
      full_name: fullName,
      address,
      cell_phone: cellPhone,
      home_phone: homePhone || null,
      email,
      payout_method: payoutMethod,
      company_name: payoutMethod === 'company' ? companyName : null,
      gst_number: payoutMethod === 'company' ? gstNumber || null : null,
      sin_number: payoutMethod === 'individual' ? sinNumber || null : null,
      void_cheque_path: docs.void_cheque ?? null,
      vehicle_registration_path: docs.vehicle_registration ?? null,
      vehicle_insurance_path: docs.vehicle_insurance ?? null,
      vehicle_year: vehicleYear ? parseInt(vehicleYear) : null,
      vehicle_make: vehicleMake || null,
      vehicle_model: vehicleModel || null,
      vehicle_mileage: vehicleMileage ? parseInt(vehicleMileage) : null,
      license_class: licenseClass || null,
      extracted_license_class: extractedLicenseClass || null,
      can_tow_trailer: canTowTrailer,
      preferred_job_types: preferredJobTypes.length > 0 ? preferredJobTypes : null,
      vehicle_walkaround_video_path: docs.vehicle_walkaround_video ?? null,
      vehicle_photo_path: docs.vehicle_photo ?? null,
      dash_odometer_photo_path: docs.dash_odometer_photo ?? null,
      profile_photo_path: docs.profile_photo ?? null,
      drivers_license_path: docs.drivers_license ?? null,
      drivers_abstract_path: docs.drivers_abstract ?? null,
      criminal_background_check_path: docs.criminal_background_check ?? null,
      vsa_license_path: docs.vsa_license ?? null,
      medical_fitness_path: docs.medical_fitness ?? null,
      drug_alcohol_test_path: docs.drug_alcohol_test ?? null,
      optical_test_path: docs.optical_test ?? null,
      contract_signed_at: new Date().toISOString(),
      contract_signature_path: signaturePath,
      // Legacy lightweight flags — kept in sync for backwards compatibility, but the
      // real source of truth for agreement is the legal_acceptances rows recorded
      // above via LegalDocumentChecklist.
      agreed_to_drug_alcohol_policy: true,
      agreed_to_probation_terms: true,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Application submitted</h1>
          <p className="text-sm text-gray-500">
            Thanks — your application is being reviewed. We&apos;ll be in touch once it&apos;s approved.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="mb-2">
          <Logo height={18} />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Driver Application</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Personal Info */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Personal Information</h2>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Full legal name</label>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Home address</label>
              <input required value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Cell number</label>
                <input required value={cellPhone} onChange={(e) => setCellPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Home number</label>
                <input value={homePhone} onChange={(e) => setHomePhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Email address</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </section>

          {/* Payment / Tax */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Payment & Tax Information</h2>
            <div>
              <label className="block text-sm text-gray-700 mb-1">How should we pay you?</label>
              <select
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value as 'individual' | 'company')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="individual">As an individual (SIN)</option>
                <option value="company">Through a company (GST number)</option>
              </select>
            </div>
            {payoutMethod === 'company' ? (
              <>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Company name</label>
                  <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">GST number</label>
                  <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm text-gray-700 mb-1">SIN</label>
                <input value={sinNumber} onChange={(e) => setSinNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <p className="text-xs text-gray-400 mt-1">Kept private — only visible to Drivflo admin, used for tax reporting.</p>
              </div>
            )}
            {userId && (
              <FileUploadField
                label="Void cheque or direct deposit form"
                bucket="driver-documents"
                folder={userId}
                fileName="void-cheque"
                onUploaded={setDoc('void_cheque')}
              />
            )}
          </section>

          {/* License & availability */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">License & availability</h2>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Driver's license class</label>
              <select
                value={licenseClass}
                onChange={(e) => setLicenseClass(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select a class</option>
                <option value="Class 5">Class 5 (standard passenger vehicle)</option>
                <option value="Class 7">Class 7 (novice/learner)</option>
                <option value="Class 4">Class 4 (passenger vehicles for hire, e.g. taxi/shuttle)</option>
                <option value="Class 3">Class 3 (larger trucks)</option>
                <option value="Class 2">Class 2 (buses)</option>
                <option value="Class 1">Class 1 (tractor-trailers)</option>
                <option value="Other/Out of province">Other / out of province</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Are you able to tow a large trailer?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCanTowTrailer(true)}
                  className={`flex-1 border rounded-lg px-3 py-2 text-sm ${canTowTrailer === true ? 'border-[#378ADD] bg-blue-50 text-[#378ADD]' : 'border-gray-300 text-gray-600'}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setCanTowTrailer(false)}
                  className={`flex-1 border rounded-lg px-3 py-2 text-sm ${canTowTrailer === false ? 'border-[#378ADD] bg-blue-50 text-[#378ADD]' : 'border-gray-300 text-gray-600'}`}
                >
                  No
                </button>
              </div>
            </div>
            {availableJobTypes.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-2">
                  Which kinds of drives are you interested in? (Select all that apply)
                </label>
                <div className="space-y-1.5">
                  {availableJobTypes.map((jt) => (
                    <label key={jt.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={preferredJobTypes.includes(jt.name)}
                        onChange={() => toggleJobTypePreference(jt.name)}
                      />
                      {jt.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Vehicle */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Your vehicle</h2>
            <p className="text-xs text-gray-500">Tell us about the vehicle you&apos;ll actually be using for deliveries.</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Year</label>
                <input value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Make</label>
                <input value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Current mileage</label>
              <input value={vehicleMileage} onChange={(e) => setVehicleMileage(e.target.value)} inputMode="numeric"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </section>

          {/* Documents */}
          {userId && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Documents</h2>
              <p className="text-xs text-gray-500">Take a photo with your phone or upload a saved file for each.</p>

              <FileUploadField label="Clear profile face photo" bucket="driver-documents" folder={userId} fileName="profile-photo" onUploaded={setDoc('profile_photo')} />
              <div>
                <FileUploadField label="Driver's license" bucket="driver-documents" folder={userId} fileName="drivers-license" onUploaded={handleLicenseUpload} />
                {extractingLicenseClass && <p className="text-xs text-gray-400 mt-1">Reading license class from photo…</p>}
                {!extractingLicenseClass && extractedLicenseClass && (
                  <p className="text-xs text-green-600 mt-1">Detected: {extractedLicenseClass} — confirm this matches the class you selected above.</p>
                )}
              </div>
              <FileUploadField label="Driver's abstract" bucket="driver-documents" folder={userId} fileName="drivers-abstract" onUploaded={setDoc('drivers_abstract')} />
              <FileUploadField label="Criminal background check" bucket="driver-documents" folder={userId} fileName="background-check" onUploaded={setDoc('criminal_background_check')} />
              <FileUploadField label="VSA license" bucket="driver-documents" folder={userId} fileName="vsa-license" onUploaded={setDoc('vsa_license')} optional />
              <FileUploadField label="Medical fitness to drive assessment" bucket="driver-documents" folder={userId} fileName="medical-fitness" onUploaded={setDoc('medical_fitness')} />
              <FileUploadField label="Drug & alcohol test results" bucket="driver-documents" folder={userId} fileName="drug-alcohol-test" onUploaded={setDoc('drug_alcohol_test')} />
              <FileUploadField label="Optical test assessment" bucket="driver-documents" folder={userId} fileName="optical-test" onUploaded={setDoc('optical_test')} />
              <FileUploadField label="Vehicle registration" bucket="driver-documents" folder={userId} fileName="vehicle-registration" onUploaded={setDoc('vehicle_registration')} />
              <FileUploadField label="Vehicle insurance" bucket="driver-documents" folder={userId} fileName="vehicle-insurance" onUploaded={setDoc('vehicle_insurance')} />
              <FileUploadField
                label="Clear photo of your vehicle (exterior) - shown to customers so they recognize your car"
                bucket="driver-documents"
                folder={userId}
                fileName="vehicle-photo"
                onUploaded={setDoc('vehicle_photo')}
              />
              <FileUploadField
                label="Walkaround video of your vehicle"
                bucket="driver-documents"
                folder={userId}
                fileName="vehicle-walkaround"
                onUploaded={setDoc('vehicle_walkaround_video')}
                accept="video/*"
              />
              <FileUploadField
                label="Photo of the dash while running, showing the odometer"
                bucket="driver-documents"
                folder={userId}
                fileName="dash-odometer"
                onUploaded={setDoc('dash_odometer_photo')}
              />
            </section>
          )}

          {/* Contract */}
          <section className="space-y-4 border-t border-gray-200 pt-6">
            <h2 className="text-sm font-semibold text-gray-900">Agreements & Policies</h2>
            <p className="text-xs text-gray-500">
              Review and agree to each document below. You must scroll to the bottom of each one before you can agree.
            </p>
            <LegalDocumentChecklist
              applicationType="driver"
              docs={DRIVER_DOC_LIST}
              accepted={acceptedDocs}
              onChange={(slug, version) => setAcceptedDocs((prev) => ({ ...prev, [slug]: version }))}
            />

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Sign below to confirm your agreement to the Driver Independent Contractor Services Agreement
              </label>
              <SignaturePad onChange={setSignatureDataUrl} />
            </div>
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || DRIVER_REQUIRED_DOCS.some((slug) => acceptedDocs[slug] == null) || !signatureDataUrl}
            className="w-full bg-[#378ADD] text-white text-sm font-medium px-5 py-3 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </main>
    </div>
  )
}
