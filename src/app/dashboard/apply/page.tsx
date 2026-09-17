'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FileUploadField from '@/components/FileUploadField'
import SignaturePad from '@/components/SignaturePad'
import Logo from '@/components/Logo'
import SignOutButton from '@/components/SignOutButton'
import LegalDocumentChecklist from '@/components/LegalDocumentChecklist'
import { DEALER_REQUIRED_DOCS } from '@/lib/legalDocuments'

const DEALER_DOC_LABELS: Record<string, string> = {
  dealer_master_services_agreement: 'Dealer Master Services Agreement',
  fee_waiting_cancellation_policy: 'Fee, Waiting and Cancellation Policy',
  privacy_policy: 'Privacy Policy',
  platform_terms_of_service: 'Platform Terms of Service',
}
const DEALER_DOC_LIST = DEALER_REQUIRED_DOCS.map((slug) => ({ slug, label: DEALER_DOC_LABELS[slug] }))

export default function DealerApplyPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  // Two-step signup: 'basic_info' (business + contact info, no account yet)
  // -> 'verify_code' (the texted code) -> 'check_email' (account created,
  // waiting on the confirmation-email click) -> 'full_form' (back here
  // already logged in, via the emailed link, to set a real password and
  // finish the rest of the application).
  const [step, setStep] = useState<'basic_info' | 'verify_code' | 'check_email' | 'set_password' | 'full_form' | 'under_review' | 'rejected' | 'loading'>('loading')
  const [leadId, setLeadId] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [startingSignup, setStartingSignup] = useState(false)
  const [verifyingCode, setVerifyingCode] = useState(false)
  const [stepError, setStepError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  const [businessName, setBusinessName] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [pstNumber, setPstNumber] = useState('')
  const [gstNumber, setGstNumber] = useState('')
  const [dealerNumber, setDealerNumber] = useState('')

  const [contactFullName, setContactFullName] = useState('')
  const [contactPosition, setContactPosition] = useState('')
  const [storePhone, setStorePhone] = useState('')
  const [contactCellPhone, setContactCellPhone] = useState('')

  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pre_authorized_debit'>('credit_card')
  const [padPath, setPadPath] = useState<string | null>(null)

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

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setStep('basic_info')
        return
      }
      setUserId(user.id)
      setContactEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()
      if (profile?.organization_id) setOrganizationId(profile.organization_id)

      // A returning, already-logged-in contact: check for an existing
      // application before showing anything else, so someone who already
      // submitted doesn't land back on a blank form.
      const { data: existingApp } = await supabase
        .from('dealer_applications')
        .select('status')
        .eq('submitted_by', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingApp?.status === 'approved') {
        router.replace('/dashboard')
        return
      }
      if (existingApp?.status === 'rejected') {
        setStep('rejected')
        return
      }
      if (existingApp) {
        setStep('under_review')
        return
      }

      if (leadFromUrl) {
        const { data: leadData } = await supabase.rpc('get_verified_dealer_lead', { p_lead_id: leadFromUrl })
        const lead = leadData?.[0]
        if (lead) {
          setBusinessName(lead.business_name ?? '')
          setBusinessAddress(lead.business_address ?? '')
          setContactFullName(lead.contact_full_name ?? '')
          setContactPosition(lead.contact_position ?? '')
          setStorePhone(lead.store_phone ?? '')
          setContactCellPhone(lead.contact_cell_phone ?? '')
        }
        setStep('set_password')
      } else {
        setStep('full_form')
      }
    })
  }, [router])

  async function handleStartSignup(e: React.FormEvent) {
    e.preventDefault()
    setStepError('')
    if (!businessName || !businessAddress || !contactFullName || !contactEmail || !contactCellPhone) {
      setStepError('Please fill in the business name, address, contact name, email, and cell phone.')
      return
    }
    setStartingSignup(true)
    try {
      const res = await fetch('/api/signup-leads/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'dealer', businessName, businessAddress, contactFullName, contactPosition,
          storePhone, contactEmail, contactCellPhone,
        }),
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
      const { data: verified } = await supabase.rpc('verify_dealer_signup_code', { p_lead_id: leadId, p_code: verificationCode.trim() })
      if (!verified) {
        setStepError("That code doesn't match or has expired. Double-check it, or go back to re-send.")
        return
      }
      const { error: signUpError } = await supabase.auth.signUp({
        email: contactEmail,
        password: crypto.randomUUID(),
        options: { emailRedirectTo: `${window.location.origin}/dashboard/apply?lead=${leadId}` },
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
      setStep('full_form')
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
    if (paymentMethod === 'pre_authorized_debit' && !padPath) {
      setError('Please upload your completed pre-authorized debit form.')
      return
    }
    const missingDocs = DEALER_REQUIRED_DOCS.filter((slug) => acceptedDocs[slug] == null)
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

    const signatureBlob = await (await fetch(signatureDataUrl)).blob()
    const signaturePath = `${userId}/contract-signature.png`
    const { error: sigError } = await supabase.storage
      .from('dealer-documents')
      .upload(signaturePath, signatureBlob, { upsert: true, contentType: 'image/png' })

    if (sigError) {
      setError(sigError.message)
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('dealer_applications').insert({
      organization_id: organizationId,
      submitted_by: userId,
      business_name: businessName,
      business_address: businessAddress,
      pst_number: pstNumber || null,
      gst_number: gstNumber || null,
      dealer_number: dealerNumber || null,
      contact_full_name: contactFullName,
      contact_position: contactPosition,
      store_phone: storePhone,
      contact_cell_phone: contactCellPhone,
      payment_method: paymentMethod,
      pre_authorized_debit_form_path: padPath,
      contract_signed_at: new Date().toISOString(),
      contract_signature_path: signaturePath,
      // Legacy lightweight flag — kept in sync for backwards compatibility, but the
      // real source of truth for agreement is the legal_acceptances rows recorded
      // above via LegalDocumentChecklist.
      liability_release_signed: true,
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
      body: JSON.stringify({ applicationType: 'dealer', name: businessName }),
    }).catch(() => {})

    if (leadId) {
      await supabase.rpc('mark_dealer_lead_converted', { p_lead_id: leadId, p_user_id: userId })
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
            Thanks — your dealer application is being reviewed. We&apos;ll be in touch shortly.
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
          <h1 className="text-lg font-semibold text-gray-900 mt-2">Register your dealership</h1>
        </header>
        <main className="max-w-lg mx-auto px-6 py-8">
          <p className="text-sm text-gray-500 mb-6">
            Start with the basics — we&apos;ll text a code to confirm the number, then email a link to finish the rest.
          </p>
          <form onSubmit={handleStartSignup} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Business name</label>
              <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Business address</label>
              <input required value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Full name</label>
              <input required value={contactFullName} onChange={(e) => setContactFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Position in company</label>
              <input value={contactPosition} onChange={(e) => setContactPosition(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Store phone</label>
                <input value={storePhone} onChange={(e) => setStorePhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Cell phone</label>
                <input required value={contactCellPhone} onChange={(e) => setContactCellPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Email</label>
              <input required type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
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
          <p className="text-sm text-gray-500 mb-6">We texted a 6-digit code to {contactCellPhone}. Enter it below.</p>
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
            We sent a link to {contactEmail} — open it to set your password and get started.
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

  if (step === 'under_review') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Application submitted</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your dealer application is currently under review. We&apos;ll email you as soon as it&apos;s ready.
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
        <div className="mb-2">
          <Logo height={18} />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Dealer Application</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Business Information</h2>
            {leadId && <p className="text-xs text-gray-400">Confirmed via text — set below, not editable here.</p>}
            <div>
              <label className="block text-sm text-gray-700 mb-1">Business name</label>
              <input required disabled={!!leadId} value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Business address</label>
              <input required disabled={!!leadId} value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">PST number</label>
                <input value={pstNumber} onChange={(e) => setPstNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">GST number</label>
                <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Dealer number</label>
              <input value={dealerNumber} onChange={(e) => setDealerNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Contact Information</h2>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Full name</label>
              <input required disabled={!!leadId} value={contactFullName} onChange={(e) => setContactFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Position in company</label>
              <input required disabled={!!leadId} value={contactPosition} onChange={(e) => setContactPosition(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Store phone</label>
                <input required disabled={!!leadId} value={storePhone} onChange={(e) => setStorePhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Cell phone</label>
                <input required disabled={!!leadId} value={contactCellPhone} onChange={(e) => setContactCellPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Payment Method</h2>
            <div>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'credit_card' | 'pre_authorized_debit')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="credit_card">Credit card on file</option>
                <option value="pre_authorized_debit">Pre-authorized debit</option>
              </select>
            </div>
            {paymentMethod === 'credit_card' ? (
              <p className="text-xs text-gray-500">
                You&apos;ll be prompted to securely add a card on the next step after approval.
              </p>
            ) : (
              userId && (
                <FileUploadField
                  label="Completed pre-authorized debit form"
                  bucket="dealer-documents"
                  folder={userId}
                  fileName="pad-form"
                  onUploaded={setPadPath}
                />
              )
            )}
          </section>

          <section className="space-y-4 border-t border-gray-200 pt-6">
            <h2 className="text-sm font-semibold text-gray-900">Agreements & Policies</h2>
            <p className="text-xs text-gray-500">
              Review and agree to each document below. You must scroll to the bottom of each one before you can agree.
            </p>
            <LegalDocumentChecklist
              applicationType="dealer"
              docs={DEALER_DOC_LIST}
              accepted={acceptedDocs}
              onChange={(slug, version) => setAcceptedDocs((prev) => ({ ...prev, [slug]: version }))}
            />

            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Sign below to confirm your agreement to the Dealer Master Services Agreement
              </label>
              <SignaturePad onChange={setSignatureDataUrl} />
            </div>
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || DEALER_REQUIRED_DOCS.some((slug) => acceptedDocs[slug] == null) || !signatureDataUrl}
            className="w-full bg-[#378ADD] text-white text-sm font-medium px-5 py-3 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </main>
    </div>
  )
}
