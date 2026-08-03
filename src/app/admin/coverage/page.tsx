import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import CoverageMapView from '@/components/CoverageMapView'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'

export default async function AdminCoveragePage() {
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
    .select('id, name, address, lat, lng')

  const { data: driverProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, is_active, home_lat, home_lng')
    .eq('role', 'driver')

  const { data: driverApps } = await supabase
    .from('driver_applications')
    .select('user_id, address')
    .order('created_at', { ascending: false })

  const addressByDriver = new Map<string, string>()
  driverApps?.forEach((a) => {
    if (a.address && !addressByDriver.has(a.user_id)) addressByDriver.set(a.user_id, a.address)
  })

  const drivers = (driverProfiles ?? []).map((d) => ({
    id: d.id,
    name: d.full_name || 'Unnamed driver',
    address: addressByDriver.get(d.id) ?? null,
    lat: d.home_lat,
    lng: d.home_lng,
    is_active: d.is_active,
  }))

  const dealerList = (dealers ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    address: d.address,
    lat: d.lat,
    lng: d.lng,
  }))

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin"><Logo height={22} /></Link>
            <span className="text-sm text-gray-400">— Coverage</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Drivers vs. dealers by location</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
          <SignOutButton />
          <SettingsGearLink href="/admin/account" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-500 mb-4">
          Blue dots are dealers with a 20km coverage circle. Green dots are active drivers, gray are inactive.
          Any dealer circle without nearby driver dots is a coverage gap worth recruiting for.
        </p>
        {dealerList.length === 0 && drivers.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">No dealers or drivers to show yet.</p>
        ) : (
          <CoverageMapView dealers={dealerList} drivers={drivers} />
        )}
      </main>
    </div>
  )
}
