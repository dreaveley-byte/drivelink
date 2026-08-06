import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import Logo from '@/components/Logo'
import PreferredDriversList from '@/components/PreferredDriversList'

export const dynamic = 'force-dynamic'

export default async function PreferredDriversPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')
  if (profile.role !== 'org_admin') redirect('/dashboard')

  const { data: drivers } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('role', 'driver')
    .order('full_name')

  const { data: preferredRows } = await supabase
    .from('preferred_drivers')
    .select('driver_id')
    .eq('organization_id', profile.organization_id)

  const { data: pricingSettings } = await supabase
    .from('pricing_settings')
    .select('preferred_driver_window_minutes')
    .eq('id', 1)
    .single()

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/dashboard"><Logo height={22} /></Link>
          <span className="text-sm text-gray-400">— Preferred Drivers</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            Back to dashboard
          </Link>
          <SignOutButton />
          <SettingsGearLink href="/dashboard/settings" />
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-lg font-medium text-gray-900">Preferred Drivers</h1>
          <p className="text-sm text-gray-500 mt-1">
            New jobs go to your preferred drivers first — they get{' '}
            {pricingSettings?.preferred_driver_window_minutes ?? 10} minutes of first access before the job opens
            up to every driver on the platform. Leave nobody marked as preferred and jobs go straight to everyone,
            same as before.
          </p>
        </div>

        <PreferredDriversList
          organizationId={profile.organization_id}
          drivers={drivers ?? []}
          initiallyPreferred={(preferredRows ?? []).map((r) => r.driver_id)}
        />
      </main>
    </div>
  )
}
