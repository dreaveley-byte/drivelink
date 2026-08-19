import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import Logo from '@/components/Logo'
import { ALL_LEGAL_DOC_SLUGS } from '@/lib/legalDocuments'

export const dynamic = 'force-dynamic'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { dateStyle: 'medium' })
}

export default async function AdminLegalDocumentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'platform_admin') redirect('/dashboard')

  const { data: docs } = await supabase
    .from('legal_documents')
    .select('slug, version, title, audience, effective_date, created_at')
    .eq('is_current', true)
    .order('slug')

  const docsBySlug = new Map((docs ?? []).map((d) => [d.slug, d]))

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/admin"><Logo height={22} /></Link>
          <div className="flex items-center gap-3">
            <SettingsGearLink href="/admin/settings" />
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-3xl mx-auto">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back to admin
          </Link>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Legal documents</h1>
        <p className="text-sm text-gray-500 mb-6">
          Source of truth for every agreement/policy shown to drivers, dealers and customers. Saving an edit creates
          a new version and requires everyone to re-accept it.
        </p>

        <div className="space-y-3">
          {ALL_LEGAL_DOC_SLUGS.map((slug) => {
            const doc = docsBySlug.get(slug)
            return (
              <Link
                key={slug}
                href={`/admin/legal-documents/${slug}`}
                className="block border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc?.title ?? slug}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {slug} · audience: {doc?.audience ?? '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      {doc ? `Version ${doc.version}` : 'Not seeded'}
                    </p>
                    {doc && <p className="text-xs text-gray-400">Effective {fmtDate(doc.effective_date)}</p>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
