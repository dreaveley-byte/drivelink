import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PrintButton from '@/components/PrintButton'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function DealerAgreementPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: dealerId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'platform_admin') redirect('/dashboard')

  const { data: application } = await supabase
    .from('dealer_applications')
    .select('*')
    .eq('organization_id', dealerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!application) notFound()

  let signatureUrl: string | null = null
  if (application.contract_signature_path) {
    const { data } = await supabase.storage
      .from('dealer-documents')
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

        <h1 className="text-xl font-semibold text-gray-900 mb-1">Dealer Agreement — Review Copy</h1>
        <p className="text-sm text-gray-500 mb-8">
          {application.contract_signed_at ? `Signed ${fmtDateTime(application.contract_signed_at)}` : 'Not yet signed'}
        </p>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-8">
          <div className="col-span-2">
            <p className="text-xs text-gray-400">Business name</p>
            <p className="text-gray-900">{application.business_name || '—'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-400">Business address</p>
            <p className="text-gray-900">{application.business_address || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">PST number</p>
            <p className="text-gray-900">{application.pst_number || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">GST number</p>
            <p className="text-gray-900">{application.gst_number || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Dealer number</p>
            <p className="text-gray-900">{application.dealer_number || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Store phone</p>
            <p className="text-gray-900">{application.store_phone || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Contact name</p>
            <p className="text-gray-900">{application.contact_full_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Contact position</p>
            <p className="text-gray-900">{application.contact_position || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Contact cell phone</p>
            <p className="text-gray-900">{application.contact_cell_phone || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Payment method</p>
            <p className="text-gray-900 capitalize">{application.payment_method?.replace(/_/g, ' ') || '—'}</p>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4 mb-8">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Agreement terms acknowledged</p>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>{application.liability_release_signed ? '✓' : '✗'} Release of liability</li>
          </ul>
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
