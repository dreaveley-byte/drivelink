import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import DriverActiveToggle from '@/components/DriverActiveToggle'

export const dynamic = 'force-dynamic'

export default async function AdminDriversPage() {
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

  const { data: drivers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'driver')
    .order('full_name')

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">DriveLink — Drivers</h1>
          <p className="text-xs text-gray-500">Turn drivers on or off</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
          <Link href="/admin/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </Link>
          <Link href="/admin/applications" className="text-sm text-gray-600 hover:text-gray-900">
            Applications
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {drivers?.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No drivers yet.</p>
          )}
          {drivers?.map((driver) => (
            <div
              key={driver.id}
              className="border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{driver.full_name || 'Unnamed driver'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{driver.phone || 'No phone on file'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs border rounded-full px-2.5 py-1 ${
                    driver.is_active ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-500'
                  }`}
                >
                  {driver.is_active ? 'Active' : 'Inactive'}
                </span>
                <DriverActiveToggle driverId={driver.id} isActive={driver.is_active} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
