import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import Logo from '@/components/Logo'
import { ALL_LEGAL_DOC_SLUGS } from '@/lib/legalDocuments'
import LegalDocumentEditForm from '@/components/LegalDocumentEditForm'

export const dynamic = 'force-dynamic'

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function AdminEditLegalDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!ALL_LEGAL_DOC_SLUGS.includes(slug as (typeof ALL_LEGAL_DOC_SLUGS)[number])) notFound()

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'platform_admin') redirect('/dashboard')

  const { data: current } = await supabase
    .from('legal_documents')
    .select('*')
    .eq('slug', slug)
    .eq('is_current', true)
    .maybeSingle()

  const { data: history } = await supabase
    .from('legal_documents')
    .select('version, created_at, effective_date')
    .eq('slug', slug)
    .order('version', { ascending: false })

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/admin"><Logo height={22} /></Link>
          <SignOutButton />
        </div>
      </header>
      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-3xl mx-auto">
          <Link href="/admin/legal-documents" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back to legal documents
          </Link>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">{current?.title ?? slug}</h1>
        <p className="text-xs text-gray-400 mb-6">{slug}</p>

        <LegalDocumentEditForm
          slug={slug}
          initialTitle={current?.title ?? ''}
          initialBody={current?.body ?? ''}
          initialAudience={current?.audience ?? 'driver'}
          initialEffectiveDate={current?.effective_date ?? ''}
          currentVersion={current?.version ?? 0}
        />

        {history && history.length > 0 && (
          <div className="mt-10 border-t border-gray-200 pt-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Version history</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {history.map((h) => (
                <li key={h.version}>
                  v{h.version} — effective {h.effective_date} — saved {fmtDateTime(h.created_at)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
