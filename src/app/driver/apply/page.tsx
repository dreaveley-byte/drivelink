'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUploadField from '@/components/FileUploadField'
import SignaturePad from '@/components/SignaturePad'
import Logo from '@/components/Logo'
import SignOutButton from '@/components/SignOutButton'
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

  // Two-step signup: 'basic_info' (name/address/phone/email, no account
  // yet) -> 'verify_code' (the texted code) -> 'check_email' (account
  // created, waiting on the confirmation-email click) -> 'full_form' (back
  // here already logged in, via the emailed link, to set a real password
  // and finish the rest of the application).
  const [step, setStep] = useState<'basic_info' | 'verify_code' | 'check_email' | 'set_password' | 'password_set' | 'full_form' | 'under_review' | 'rejected' | 'loading'>('loading')
  const [leadId, setLeadId] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [startingSignup, setStartingSignup] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [stepError, setStepError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')

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
  const [transmissionCapability, setTransmissionCapability] = useState('')
  const [trailerTowingExperience, setTrailerTowingExperience] = useState<boolean | null>(null)
  const [vehicleTowCapacityLbs, setVehicleTowCapacityLbs] = useState('')
  const [maxDriveRangeKm, setMaxDriveRangeKm] = useState('')
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
    const params = new URLSearchParams(window.location.search)
    const leadFromUrl = params.get('lead')
    if (leadFromUrl) setLeadId(leadFromUrl)
    let settled = false

    async function run() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        settled = true
        setStep('basic_info')
        return
      }
      setUserId(user.id)
      setEmail(user.email ?? '')

      // A returning, already-logged-in driver: check for an existing
      // application before showing anything else, so someone who already
      // submitted doesn't land back on a blank form.
      const { data: existingApp } = await supabase
        .from('driver_applications')
        .select('status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingApp?.status === 'approved') {
        settled = true
        router.replace('/driver')
        return
      }
      if (existingApp?.status === 'rejected') {
        settled = true
        setStep('rejected')
        return
      }
      if (existingApp) {
        settled = true
        setStep('under_review')
        return
      }

      // No application yet. Arriving here via the confirmation-email link
      // (a lead id in the URL) means the password still needs to be set
      // before the rest of the form - pre-fill what was already collected
      // in step one rather than asking for it twice.
      if (leadFromUrl) {
        const { data: leadData } = await supabase.rpc('get_verified_driver_lead', { p_lead_id: leadFromUrl })
        const lead = leadData?.[0]
        if (lead) {
          setFullName(lead.full_name ?? '')
          setAddress(lead.home_address ?? '')
          setCellPhone(lead.cell_phone ?? '')
          setHomePhone(lead.home_phone ?? '')
        }
        settled = true
        setStep('set_password')
      } else {
        settled = true
        setStep('full_form')
      }
    }

    run().catch((err) => {
      settled = true
      console.error('Driver apply page failed to load:', err)
      setStepError('Something went wrong loading your application. Please refresh the page.')
      setStep('basic_info')
    })

    // A safety net against ever hanging on a blank page forever, whatever
    // the exact cause - this exact situation (stuck blank after clicking
    // the confirmation email) is what prompted adding it.
    const timeout = setTimeout(() => {
      if (!settled) {
        setStepError('This is taking longer than expected. Please refresh the page, or log in directly if you already set a password.')
        setStep('basic_info')
      }
    }, 8000)

    supabase.from('job_types').select('id, name').eq('active', true).order('name').then(({ data }) => {
      if (data) setAvailableJobTypes(data)
    })

    return () => clearTimeout(timeout)
  }, [router])

  // Auto-save/restore draft progress to localStorage, so navigating away
  // (or the app being backgrounded/killed) doesn't lose everything typed
  // in so far - keyed per-user since userId is known by the time this
  // reads/writes. Deliberately excludes signatureDataUrl (large, and
  // should be re-signed fresh each time rather than silently restored)
  // and file upload paths in `docs` are already durable in Supabase
  // storage/on the profile once uploaded, but still worth restoring here
  // so the UI reflects what's already been uploaded after a reload.
  const draftKey = userId ? `driver-application-draft-${userId}` : null
  const [draftRestored, setDraftRestored] = useState(false)

  useEffect(() => {
    if (!draftKey || draftRestored) return
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) {
        const draft = JSON.parse(saved)
        if (draft.fullName) setFullName(draft.fullName)
        if (draft.address) setAddress(draft.address)
        if (draft.cellPhone) setCellPhone(draft.cellPhone)
        if (draft.homePhone) setHomePhone(draft.homePhone)
        if (draft.payoutMethod) setPayoutMethod(draft.payoutMethod)
        if (draft.companyName) setCompanyName(draft.companyName)
        if (draft.gstNumber) setGstNumber(draft.gstNumber)
        if (draft.sinNumber) setSinNumber(draft.sinNumber)
        if (draft.vehicleYear) setVehicleYear(draft.vehicleYear)
        if (draft.vehicleMake) setVehicleMake(draft.vehicleMake)
        if (draft.vehicleModel) setVehicleModel(draft.vehicleModel)
        if (draft.vehicleMileage) setVehicleMileage(draft.vehicleMileage)
        if (draft.licenseClass) setLicenseClass(draft.licenseClass)
        if (draft.extractedLicenseClass) setExtractedLicenseClass(draft.extractedLicenseClass)
        if (draft.canTowTrailer != null) setCanTowTrailer(draft.canTowTrailer)
        if (draft.transmissionCapability) setTransmissionCapability(draft.transmissionCapability)
        if (draft.trailerTowingExperience != null) setTrailerTowingExperience(draft.trailerTowingExperience)
        if (draft.vehicleTowCapacityLbs) setVehicleTowCapacityLbs(draft.vehicleTowCapacityLbs)
        if (draft.maxDriveRangeKm) setMaxDriveRangeKm(draft.maxDriveRangeKm)
        if (draft.preferredJobTypes) setPreferredJobTypes(draft.preferredJobTypes)
        if (draft.docs) setDocs(draft.docs)
        if (draft.acceptedDocs) setAcceptedDocs(draft.acceptedDocs)
      }
    } catch {
      // A corrupted or unreadable draft shouldn't block starting fresh.
    } finally {
      setDraftRestored(true)
    }
  }, [draftKey, draftRestored])

  useEffect(() => {
    if (!draftKey || !draftRestored) return
    const draft = {
      fullName, address, cellPhone, homePhone, payoutMethod, companyName, gstNumber, sinNumber,
      vehicleYear, vehicleMake, vehicleModel, vehicleMileage, licenseClass, extractedLicenseClass,
      canTowTrailer, transmissionCapability, trailerTowingExperience, vehicleTowCapacityLbs, maxDriveRangeKm,
      preferredJobTypes, docs, acceptedDocs,
    }
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft))
    } catch {
      // Not worth surfacing to the user if localStorage is full/unavailable.
    }
  }, [
    draftKey, draftRestored, fullName, address, cellPhone, homePhone, payoutMethod, companyName,
    gstNumber, sinNumber, vehicleYear, vehicleMake, vehicleModel, vehicleMileage, licenseClass,
    extractedLicenseClass, canTowTrailer, transmissionCapability, trailerTowingExperience,
    vehicleTowCapacityLbs, maxDriveRangeKm, preferredJobTypes, docs, acceptedDocs,
  ])

  function exitWithoutClearingDraft() {
    router.push('/login')
  }

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

  async function handleStartSignup(e: React.FormEvent) {
    e.preventDefault()
    setStepError('')
    if (!fullName || !address || !cellPhone || !email) {
      setStepError('Please fill in your name, home address, cell number, and email.')
      return
    }
    setStartingSignup(true)
    try {
      const res = await fetch('/api/signup-leads/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'driver', fullName, homeAddress: address, cellPhone, homePhone, email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStepError(data.error || 'Something went wrong starting your application.')
        return
      }
      setLeadId(data.leadId)
      setStep('verify_code')
    } catch {
      setStepError('Could not reach the server. Please try again.')
    } finally {
      setStartingSignup(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setStepError('')
    if (!leadId) return
    setVerifyingCode(true)
    try {
      const supabase = createClient()
      const { data: verified } = await supabase.rpc('verify_driver_signup_code', { p_lead_id: leadId, p_code: verificationCode.trim() })
      if (!verified) {
        setStepError("That code doesn't match or has expired. Double-check it, or go back to re-send.")
        return
      }
      // A random, never-shown password - just enough to create the account
      // so Supabase's own confirmation email goes out. The applicant sets
      // their real password once they click that email and land back here.
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: crypto.randomUUID(),
        // Not pre-encoding the ?lead=... part here - Supabase encodes this
        // whole emailRedirectTo value itself when it embeds it as its own
        // redirect_to param, so pre-encoding it here resulted in the lead
        // id ending up double-encoded (%252F instead of %2F) in the
        // actual link sent - unnecessary and fragile even where it
        // happens to still unwind correctly.
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/driver/apply?lead=${leadId}` },
      })
      if (signUpError) {
        setStepError(signUpError.message)
        return
      }
      setStep('check_email')
    } catch {
      setStepError('Could not verify that code. Please try again.')
    } finally {
      setVerifyingCode(false)
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setStepError('')
    if (newPassword.length < 8) {
      setStepError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setStepError('Those passwords don\u2019t match.')
      return
    }
    setVerifyingCode(true)
    try {
      const supabase = createClient()
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword })
      if (pwError) {
        setStepError(pwError.message)
        return
      }
      setStep('password_set')
    } catch {
      setStepError('Could not set your password. Please try again.')
    } finally {
      setVerifyingCode(false)
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
      transmission_capability: transmissionCapability || null,
      trailer_towing_experience: trailerTowingExperience,
      vehicle_tow_capacity_lbs: vehicleTowCapacityLbs ? parseInt(vehicleTowCapacityLbs) : null,
      max_drive_range_km: maxDriveRangeKm ? parseInt(maxDriveRangeKm) : null,
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

    // Best-effort - a missing/failed SMS shouldn't block the applicant's
    // own submission from succeeding.
    fetch('/api/notify-admin-new-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationType: 'driver', name: fullName }),
    }).catch(() => {})

    if (leadId) {
      await supabase.rpc('mark_driver_lead_converted', { p_lead_id: leadId, p_user_id: userId })
    }

    if (draftKey) localStorage.removeItem(draftKey)
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

  if (step === 'basic_info') {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-gray-200 px-6 py-4">
          <Logo height={18} />
          <h1 className="text-lg font-semibold text-gray-900 mt-2">Become a driver</h1>
        </header>
        <main className="max-w-lg mx-auto px-6 py-8">
          <p className="text-sm text-gray-500 mb-6">
            Start with a few basics — we&apos;ll text a code to confirm your number, then email you a link to finish the rest.
          </p>
          <form onSubmit={handleStartSignup} className="space-y-4">
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
            {stepError && <p className="text-sm text-red-600">{stepError}</p>}
            <button type="submit" disabled={startingSignup}
              className="w-full bg-[#378ADD] text-white text-sm font-semibold py-3 rounded-lg disabled:opacity-50">
              {startingSignup ? 'Sending code…' : 'Text me a code'}
            </button>
          </form>
        </main>
      </div>
    )
  }

  if (step === 'verify_code') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm w-full">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Check your phone</h1>
          <p className="text-sm text-gray-500 mb-6">We texted a 6-digit code to {cellPhone}. Enter it below.</p>
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <input
              required
              inputMode="numeric"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-lg tracking-widest"
            />
            {stepError && <p className="text-sm text-red-600">{stepError}</p>}
            <button type="submit" disabled={verifyingCode}
              className="w-full bg-[#378ADD] text-white text-sm font-semibold py-3 rounded-lg disabled:opacity-50">
              {verifyingCode ? 'Verifying…' : 'Verify'}
            </button>
            <button type="button" onClick={() => setStep('basic_info')} className="w-full text-xs text-gray-400 underline">
              Wrong number? Go back
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'check_email') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h1>
          <p className="text-sm text-gray-500">
            We sent a link to {email} — open it to set your password and get started.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'loading') {
    return <div className="min-h-screen bg-white" />
  }

  if (step === 'set_password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm w-full">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Set your password</h1>
          <p className="text-sm text-gray-500 mb-6">
            You&apos;re confirmed — pick a password to finish setting up your login. You can come back anytime to finish the rest of your application.
          </p>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Password</label>
              <input required type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Confirm password</label>
              <input required type="password" minLength={8} value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            {stepError && <p className="text-sm text-red-600">{stepError}</p>}
            <button type="submit" disabled={verifyingCode}
              className="w-full bg-[#378ADD] text-white text-sm font-semibold py-3 rounded-lg disabled:opacity-50">
              {verifyingCode ? 'Saving…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'password_set') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <Logo height={22} className="mx-auto mb-6" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">You&apos;re all set</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your login is ready. Continue now to finish the rest of your application, or come back anytime by logging in with {email} and the password you just set.
          </p>
          <button
            onClick={() => setStep('full_form')}
            className="w-full bg-[#378ADD] text-white text-sm font-semibold py-3 rounded-lg"
          >
            Continue to your application →
          </button>
        </div>
      </div>
    )
  }

  if (step === 'under_review') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Application submitted</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your application is currently under review. We&apos;ll email you as soon as it&apos;s ready.
          </p>
          <SignOutButton />
        </div>
      </div>
    )
  }

  if (step === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Application status</h1>
          <p className="text-sm text-gray-500 mb-6">
            We weren&apos;t able to approve your application at this time. Contact support if you have questions.
          </p>
          <SignOutButton />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <Logo height={18} />
          <button
            type="button"
            onClick={() => {
              if (confirm('Exit the application? Your progress is saved and you can pick up where you left off next time.')) {
                exitWithoutClearingDraft()
              }
            }}
            className="text-xs text-gray-400 underline"
          >
            Cancel & exit
          </button>
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Driver Application</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Personal Info */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Personal Information</h2>
            {leadId && (
              <p className="text-xs text-gray-400">Confirmed via text — editing these here won&apos;t change your account email.</p>
            )}
            <div>
              <label className="block text-sm text-gray-700 mb-1">Full legal name</label>
              <input required disabled={!!leadId} value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Home address</label>
              <input required disabled={!!leadId} value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Cell number</label>
                <input required disabled={!!leadId} value={cellPhone} onChange={(e) => setCellPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Home number</label>
                <input disabled={!!leadId} value={homePhone} onChange={(e) => setHomePhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Email address</label>
              <input required type="email" disabled={!!leadId} value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
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
            <div>
              <label className="block text-xs text-gray-500 mb-2">Do you have prior experience towing a trailer?</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTrailerTowingExperience(true)}
                  className={`flex-1 border rounded-lg px-3 py-2 text-sm ${trailerTowingExperience === true ? 'border-[#378ADD] bg-blue-50 text-[#378ADD]' : 'border-gray-300 text-gray-600'}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setTrailerTowingExperience(false)}
                  className={`flex-1 border rounded-lg px-3 py-2 text-sm ${trailerTowingExperience === false ? 'border-[#378ADD] bg-blue-50 text-[#378ADD]' : 'border-gray-300 text-gray-600'}`}
                >
                  No
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Your vehicle's legal towing capacity (lbs), if any</label>
              <input
                type="number"
                min="0"
                value={vehicleTowCapacityLbs}
                onChange={(e) => setVehicleTowCapacityLbs(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank if your vehicle isn't rated to tow, or you're not sure.</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Which transmission types can you drive?</label>
              <div className="flex gap-2">
                {[
                  { value: 'automatic', label: 'Automatic only' },
                  { value: 'manual', label: 'Manual only' },
                  { value: 'both', label: 'Both' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTransmissionCapability(opt.value)}
                    className={`flex-1 border rounded-lg px-3 py-2 text-sm ${transmissionCapability === opt.value ? 'border-[#378ADD] bg-blue-50 text-[#378ADD]' : 'border-gray-300 text-gray-600'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Maximum one-way drive distance you're willing to take (km)</label>
              <input
                type="number"
                min="0"
                value={maxDriveRangeKm}
                onChange={(e) => setMaxDriveRangeKm(e.target.value)}
                placeholder="Leave blank for no limit"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Jobs beyond this distance won't be shown to you as available. Leave blank if you're open to any distance.</p>
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
