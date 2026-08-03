import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'

export default async function AdminDealersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'platform_admin') {
    redirect('/dashboard')
  }

  const { data: dealers } = await supabase
    .from('organizations')
    .select('*')
    .order('name')

  const { data: jobCounts } = await supabase
    .from('jobs')
    .select('organization_id')

  const countsByOrg = new Map<string, number>()
  jobCounts?.forEach((j) => {
    countsByOrg.set(j.organization_id, (countsByOrg.get(j.organization_id) ?? 0) + 1)
  })

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Logo height={22} />
            <span className="text-sm text-gray-400">— Dealers</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">All dealer accounts</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
          <Link href="/admin/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </Link>
          <Link href="/admin/drivers" className="text-sm text-gray-600 hover:text-gray-900">
            Drivers
          </Link>
          <Link href="/admin/applications" className="text-sm text-gray-600 hover:text-gray-900">
            Applications
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {dealers?.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No dealers yet.</p>
          )}
          {dealers?.map((dealer) => (
            <Link
              key={dealer.id}
              href={`/admin/dealers/${dealer.id}`}
              className="block border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{dealer.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{dealer.address || 'No address on file'}</p>
                  {dealer.phone && <p className="text-xs text-gray-400 mt-0.5">{dealer.phone}</p>}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {countsByOrg.get(dealer.id) ?? 0} job{(countsByOrg.get(dealer.id) ?? 0) === 1 ? '' : 's'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
