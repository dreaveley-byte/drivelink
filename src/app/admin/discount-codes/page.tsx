import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import Logo from '@/components/Logo'
import CreateDiscountCodeForm from '@/components/CreateDiscountCodeForm'
import DeactivateDiscountCodeButton from '@/components/DeactivateDiscountCodeButton'

export const dynamic = 'force-dynamic'

export default async function AdminDiscountCodesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'platform_admin') redirect('/dashboard')

  const { data: codes } = await supabase
    .from('discount_codes')
    .select('*, organizations(name, discount_jobs_used)')
    .order('created_at', { ascending: false })

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
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Dealer discount codes</h1>
        <p className="text-sm text-gray-500 mb-6">
          Reduce your markup temporarily for new dealers as a sign-up incentive. Give a dealer the code to enter on
          their account settings page.
        </p>

        <CreateDiscountCodeForm />

        <div className="mt-8 space-y-3">
          {codes?.map((c) => {
            const usedByOrgs = Array.isArray(c.organizations) ? c.organizations : c.organizations ? [c.organizations] : []
            return (
              <div key={c.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-mono font-semibold text-gray-900">{c.code}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.discount_percent}% off markup
                      {c.expires_days != null && ` · expires ${c.expires_days} days after redeeming`}
                      {c.max_jobs != null && ` · first ${c.max_jobs} jobs`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs border rounded-full px-2.5 py-1 ${c.active ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-500'}`}>
                      {c.active ? 'Active' : 'Deactivated'}
                    </span>
                    {c.active && <DeactivateDiscountCodeButton codeId={c.id} />}
                  </div>
                </div>
                {usedByOrgs.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                    Used by: {usedByOrgs.map((o: { name: string; discount_jobs_used: number }, i: number) => (
                      <span key={i}>{i > 0 && ', '}{o.name} ({o.discount_jobs_used} job{o.discount_jobs_used === 1 ? '' : 's'})</span>
                    ))}
                  </p>
                )}
              </div>
            )
          })}
          {(!codes || codes.length === 0) && (
            <p className="text-sm text-gray-400">No discount codes created yet.</p>
          )}
        </div>
      </main>
    </div>
  )
}
