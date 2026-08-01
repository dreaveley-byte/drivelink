'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import FileUploadField from '@/components/FileUploadField'
import SignaturePad from '@/components/SignaturePad'

export default function DealerApplyPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

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

  const [liabilityRelease, setLiabilityRelease] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()
      if (profile?.organization_id) setOrganizationId(profile.organization_id)
    })
  }, [])

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
    if (!liabilityRelease) {
      setError('Please agree to the release of liability before submitting.')
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
      liability_release_signed: liabilityRelease,
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
            Thanks — your dealer application is being reviewed. We&apos;ll be in touch shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Dealer Application</h1>
        <p className="text-xs text-gray-500">DriveLink</p>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Business Information</h2>
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
              <input required value={contactFullName} onChange={(e) => setContactFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Position in company</label>
              <input required value={contactPosition} onChange={(e) => setContactPosition(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Store phone</label>
                <input required value={storePhone} onChange={(e) => setStorePhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Cell phone</label>
                <input required value={contactCellPhone} onChange={(e) => setContactCellPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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
            <h2 className="text-sm font-semibold text-gray-900">Dealer Agreement</h2>
            <div className="border border-gray-200 rounded-lg p-4 text-xs text-gray-600 max-h-40 overflow-y-auto">
              <p className="mb-2">
                This agreement is between the dealer, DriveLink, and any drivers assigned to jobs posted by the
                dealer. By signing, the dealer releases DriveLink and its drivers from liability for matters
                outside DriveLink&apos;s reasonable control, and agrees to DriveLink&apos;s standard job posting,
                payment, and cancellation terms.
              </p>
              <p>
                Full legal text will be finalized and attached here before this goes live for real applicants.
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5" checked={liabilityRelease} onChange={(e) => setLiabilityRelease(e.target.checked)} />
              I have read and agree to the release of liability and dealer terms above.
            </label>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Sign below to confirm your agreement</label>
              <SignaturePad onChange={setSignatureDataUrl} />
            </div>
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </main>
    </div>
  )
}
