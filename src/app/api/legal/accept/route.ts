import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Records that the signed-in user (or, for a per-job vehicle delivery
// acknowledgement, the driver recording it on the customer's behalf) accepted
// a specific version of a legal document.
//
// Note: the driver/dealer apply forms capture the applicant's signature for the main
// contract separately (uploaded to driver-documents / dealer-documents and stored on
// the application row) rather than via `signaturePath` here, so acceptance of a
// signature-required document is not hard-blocked on `signaturePath` being present at
// this layer — the re-sign flow (the only caller that reaches this without that other
// signature step) enforces it client-side via LegalDocumentModal's `captureSignature`
// gate before this endpoint is ever called.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { documentSlug, documentVersion, applicationType, jobId, mediaConsent, signaturePath } = body

  if (!documentSlug || !documentVersion || !applicationType) {
    return NextResponse.json({ error: 'Missing documentSlug, documentVersion or applicationType.' }, { status: 400 })
  }
  if (!['driver', 'dealer', 'customer'].includes(applicationType)) {
    return NextResponse.json({ error: 'Invalid applicationType.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const insertRow: Record<string, unknown> = {
    application_type: applicationType,
    document_slug: documentSlug,
    document_version: documentVersion,
  }

  if (applicationType === 'customer') {
    // The customer signs on the driver's device — the acceptance is tied to the
    // job, not to the (customer's non-existent) Drivflo account.
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId for a customer acceptance.' }, { status: 400 })
    }
    insertRow.job_id = jobId
    if (typeof mediaConsent === 'boolean') insertRow.media_consent = mediaConsent
  } else {
    insertRow.user_id = user.id
    if (jobId) insertRow.job_id = jobId
    if (signaturePath) insertRow.signature_path = signaturePath
  }

  const { data, error } = await supabase.from('legal_acceptances').insert(insertRow).select('id').single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ acceptanceId: data.id })
}
