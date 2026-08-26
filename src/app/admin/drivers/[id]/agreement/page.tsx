import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PrintButton from '@/components/PrintButton'
import Logo from '@/components/Logo'
import { DRIVER_REQUIRED_DOCS } from '@/lib/legalDocuments'

export const dynamic = 'force-dynamic'

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function DriverAgreementPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: driverId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'platform_admin') redirect('/dashboard')

  const { data: application } = await supabase
    .from('driver_applications')
    .select('*')
    .eq('user_id', driverId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!application) notFound()

  const { data: acceptances } = await supabase
    .from('legal_acceptances')
    .select('document_slug, document_version, accepted_at')
    .eq('user_id', driverId)
    .eq('application_type', 'driver')
    .order('accepted_at', { ascending: false })

  const { data: currentDriverDocs } = await supabase
    .from('legal_documents')
    .select('slug, title')
    .in('slug', DRIVER_REQUIRED_DOCS)
    .eq('is_current', true)

  const docTitles = new Map((currentDriverDocs ?? []).map((d) => [d.slug, d.title]))
  const latestAcceptanceBySlug = new Map<string, { document_version: number; accepted_at: string }>()
  for (const a of acceptances ?? []) {
    if (!latestAcceptanceBySlug.has(a.document_slug)) latestAcceptanceBySlug.set(a.document_slug, a)
  }

  let signatureUrl: string | null = null
  if (application.contract_signature_path) {
    const { data } = await supabase.storage
      .from('driver-documents')
      .createSignedUrl(application.contract_signature_path, 60 * 60)
    signatureUrl = data?.signedUrl ?? null
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <Logo height={26} />
          <PrintButton />
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-1">Driver Agreement — Review Copy</h1>
        <p className="text-sm text-gray-500 mb-8">
          {application.contract_signed_at ? `Signed ${fmtDateTime(application.contract_signed_at)}` : 'Not yet signed'}
        </p>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-8">
          <div>
            <p className="text-xs text-gray-400">Full name</p>
            <p className="text-gray-900">{application.full_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Email</p>
            <p className="text-gray-900">{application.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Address</p>
            <p className="text-gray-900">{application.address || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Cell phone</p>
            <p className="text-gray-900">{application.cell_phone || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Home phone</p>
            <p className="text-gray-900">{application.home_phone || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Payout method</p>
            <p className="text-gray-900 capitalize">{application.payout_method || '—'}</p>
          </div>
          {application.payout_method === 'company' && (
            <>
              <div>
                <p className="text-xs text-gray-400">Company name</p>
                <p className="text-gray-900">{application.company_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">GST number</p>
                <p className="text-gray-900">{application.gst_number || '—'}</p>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 pt-4 mb-8">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Agreement terms acknowledged</p>
          <ul className="text-sm text-gray-700 space-y-1.5">
            {DRIVER_REQUIRED_DOCS.map((slug) => {
              const accepted = latestAcceptanceBySlug.get(slug)
              return (
                <li key={slug}>
                  {accepted ? '✓' : '✗'} {docTitles.get(slug) ?? slug}
                  {accepted && (
                    <span className="text-xs text-gray-400">
                      {' '}
                      — v{accepted.document_version}, accepted {fmtDateTime(accepted.accepted_at)}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-gray-400 mt-3">
            Legacy flags — {application.agreed_to_drug_alcohol_policy ? '✓' : '✗'} Drug &amp; alcohol policy,{' '}
            {application.agreed_to_probation_terms ? '✓' : '✗'} Probation period terms
          </p>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Signature</p>
          {signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signatureUrl} alt="Signature" className="border border-gray-200 rounded-lg max-w-xs bg-white" />
          ) : (
            <p className="text-sm text-gray-400">No signature on file.</p>
          )}
        </div>

        <p className="text-xs text-gray-300 mt-12 text-center">Drivflo — internal record, generated {fmtDateTime(new Date().toISOString())}</p>
      </div>
    </div>
  )
}
