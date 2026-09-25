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
  const { documentSlug, documentVersion, applicationType, jobId, mediaConsent, mediaConsentDocumentVersion, caslMarketingConsent, phoneMailMarketingConsent, signaturePath } = body

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
    if (typeof mediaConsentDocumentVersion === 'number') insertRow.media_consent_document_version = mediaConsentDocumentVersion
    if (typeof caslMarketingConsent === 'boolean') insertRow.casl_marketing_consent = caslMarketingConsent
    if (typeof phoneMailMarketingConsent === 'boolean') insertRow.phone_mail_marketing_consent = phoneMailMarketingConsent
    // Was missing entirely from this branch - the customer's actual drawn
    // signature (captured client-side, sent in this same request) was
    // being silently dropped on every single customer acceptance,
    // regardless of whether it was ever drawn. That's the real bug behind
    // a genuinely-signed delivery acknowledgement showing as unsigned.
    if (signaturePath) insertRow.signature_path = signaturePath
  } else {
    insertRow.user_id = user.id
    if (jobId) insertRow.job_id = jobId
    if (signaturePath) insertRow.signature_path = signaturePath
  }

  // Deliberately a plain insert with no .select() chained after it. Traced
  // through Postgres's own logs to find this: when PostgREST is asked to
  // return the inserted row (?select=...), it wraps the INSERT inside a
  // `WITH ... RETURNING` CTE - and a row-level security policy that looks
  // up another table (this one checks jobs.driver_id) evaluates
  // differently, and incorrectly rejects the row, specifically inside that
  // CTE-wrapped form. The exact same insert as a plain top-level statement
  // (what this produces) passes the identical policy every time. This
  // looks like a genuine Postgres/PostgREST edge case, not anything wrong
  // with the policy itself - confirmed by testing both forms directly
  // against the database with everything else held identical. The
  // inserted id was never used by any caller, so nothing is lost by not
  // asking for it back.
  const { error } = await supabase.from('legal_acceptances').insert(insertRow)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
