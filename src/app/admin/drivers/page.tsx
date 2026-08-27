import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import DriverActiveToggle from '@/components/DriverActiveToggle'
import DriverRatingStars from '@/components/DriverRatingStars'
import Logo from '@/components/Logo'

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

  const { data: stats } = await supabase.rpc('driver_performance_stats')
  type DriverStat = {
    driver_id: string
    driver_name: string | null
    total_completed: number
    total_releases: number
    releases_after_pickup: number
    avg_checklist_completion: number | null
    on_time_pickups: number
    total_scheduled_pickups: number
    avg_customer_rating: number | null
    avg_dealer_rating: number | null
  }
  const statsByDriver = new Map<string, DriverStat>((stats ?? []).map((s: DriverStat) => [s.driver_id, s]))

  // A driver is "incomplete" if any of the four recurring compliance
  // documents is missing, unreviewed, or older than the 12-month renewal
  // window - lets admin spot at a glance who needs follow-up without
  // opening every driver's page individually.
  const COMPLIANCE_KEYS = ['driver_abstract', 'drug_alcohol_test', 'medical_fitness_test', 'vulnerable_sector_check'] as const
  function isComplianceIncomplete(driver: Record<string, unknown>): boolean {
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    return COMPLIANCE_KEYS.some((key) => {
      const reviewedAt = driver[`${key}_reviewed_at`] as string | null
      return !reviewedAt || new Date(reviewedAt) < twelveMonthsAgo
    })
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin"><Logo height={22} /></Link>
            <span className="text-sm text-gray-400">— Drivers</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Turn drivers on or off</p>
        </div>
        <div className="flex items-center gap-4">
          <SignOutButton />
          <SettingsGearLink href="/admin/account" />
        </div>
      </header>

      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-4 flex-wrap">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
          <Link href="/admin/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </Link>
          <Link href="/admin/dealers" className="text-sm text-gray-600 hover:text-gray-900">
            Dealers
          </Link>
          <Link href="/admin/applications" className="text-sm text-gray-600 hover:text-gray-900">
            Applications
          </Link>
          <Link href="/admin/payroll" className="text-sm text-gray-600 hover:text-gray-900 ml-auto">
            Payroll
          </Link>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {drivers?.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No drivers yet.</p>
          )}
          {drivers?.map((driver) => {
            const s = statsByDriver.get(driver.id)
            return (
            <div
              key={driver.id}
              className="border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <Link href={`/admin/drivers/${driver.id}`} className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{driver.full_name || 'Unnamed driver'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{driver.phone || 'No phone on file'}</p>
                </Link>
                <div className="flex items-center gap-3">
                  {isComplianceIncomplete(driver) && (
                    <span className="text-xs border border-red-300 text-red-700 rounded-full px-2.5 py-1 font-medium">
                      Incomplete
                    </span>
                  )}
                  {s?.avg_customer_rating != null && (
                    <DriverRatingStars driverId={driver.id} avgRating={s.avg_customer_rating} />
                  )}
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

              {s && (s.total_completed > 0 || s.total_releases > 0) && (() => {
                const onTimeRate = s.total_scheduled_pickups > 0 ? s.on_time_pickups / s.total_scheduled_pickups : null
                const releaseRate = s.total_completed + s.total_releases > 0 ? s.total_releases / (s.total_completed + s.total_releases) : 0
                const scores = [s.avg_checklist_completion, onTimeRate, 1 - releaseRate].filter((v): v is number => v != null)
                const effectiveness = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
                return (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div>
                    <p className="text-gray-400">Completed</p>
                    <p className="text-gray-900 font-medium">{s.total_completed}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Document completion</p>
                    <p className="text-gray-900 font-medium">
                      {s.avg_checklist_completion != null ? `${Math.round(s.avg_checklist_completion * 100)}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">On-time pickups</p>
                    <p className="text-gray-900 font-medium">
                      {s.total_scheduled_pickups > 0 ? `${s.on_time_pickups}/${s.total_scheduled_pickups}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Ratings (customer / dealer)</p>
                    <p className="text-gray-900 font-medium">
                      {s.avg_customer_rating != null ? s.avg_customer_rating.toFixed(1) : '—'} / {s.avg_dealer_rating != null ? s.avg_dealer_rating.toFixed(1) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400" title="Average of document completion, on-time rate, and (1 - release rate)">Effectiveness</p>
                    <p className="text-gray-900 font-medium">
                      {effectiveness != null ? `${Math.round(effectiveness * 100)}%` : '—'}
                    </p>
                  </div>
                  {s.total_releases > 0 && (
                    <div className="col-span-2 sm:col-span-5">
                      <p className={s.releases_after_pickup > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {s.total_releases} release{s.total_releases === 1 ? '' : 's'} total
                        {s.releases_after_pickup > 0 && ` — ${s.releases_after_pickup} after pickup ⚠️`}
                      </p>
                    </div>
                  )}
                </div>
                )
              })()}
            </div>
          )
          })}
        </div>
      </main>
    </div>
  )
}
