import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import DriverJobActions from './DriverJobActions'
import LocationSharer from '@/components/LocationSharer'
import AutoRefresh from '@/components/AutoRefresh'
import SortSelect from '@/components/SortSelect'
import { formatCents } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export default async function DriverPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort } = await searchParams
  const ascending = sort !== 'latest'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'driver') {
    redirect('/dashboard')
  }

  if (!profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Account inactive</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your driver account is currently turned off. Contact Drivflo if you think this is a mistake.
          </p>
          <SignOutButton />
        </div>
      </div>
    )
  }

  const jobSelect = 'id, status, scheduled_for, pickup_address, dropoff_address, recipient_name, customer_full_name, customer_address, customer_phone, vehicle_year, vehicle_make, vehicle_model, stock_number, vin, is_trade_in_pickup, is_first_nations_delivery, out_of_province_inspection, key_count, has_wheel_lock, has_charging_cables, other_included_items, delivery_gps_lat, delivery_gps_lng, delivery_gps_at, estimated_distance_km, estimated_duration_minutes, estimated_driver_pay_cents, job_types(name), organizations(name, address, phone)'

  const { data: myJobs } = await supabase
    .from('jobs')
    .select(jobSelect)
    .eq('driver_id', user.id)
    .not('status', 'in', '("completed","cancelled")')
    .order('scheduled_for', { ascending, nullsFirst: false })

  const { data: openJobs } = await supabase
    .from('jobs')
    .select(jobSelect)
    .eq('status', 'awaiting_driver')
    .order('scheduled_for', { ascending, nullsFirst: false })

  // A job's rough time window: scheduled start through an estimated round-trip duration
  // (falls back to 2 hours if we don't have a duration estimate yet).
  function getJobWindow(job: { scheduled_for: string | null; estimated_duration_minutes: number | null }) {
    if (!job.scheduled_for) return null
    const start = new Date(job.scheduled_for).getTime()
    const durationMin = job.estimated_duration_minutes ? job.estimated_duration_minutes * 2 : 120
    return { start, end: start + durationMin * 60000 }
  }

  function overlapsAnyMyJob(job: { scheduled_for: string | null; estimated_duration_minutes: number | null }) {
    const myActiveJobs = myJobs ?? []
    if (myActiveJobs.length === 0) return false
    const window = getJobWindow(job)
    // If either this job or an already-claimed job has no schedule, we can't safely
    // confirm they don't overlap — be conservative and treat it as a conflict.
    if (!window) return true
    return myActiveJobs.some((mine) => {
      const mineWindow = getJobWindow(mine)
      if (!mineWindow) return true
      return window.start < mineWindow.end && mineWindow.start < window.end
    })
  }

  const { data: completedJobs } = await supabase
    .from('jobs')
    .select('id, final_driver_pay_cents, estimated_driver_pay_cents, updated_at')
    .eq('driver_id', user.id)
    .eq('status', 'completed')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  let jobsThisMonth = 0
  let earnedThisMonth = 0

  for (const job of completedJobs ?? []) {
    const payCents = job.final_driver_pay_cents ?? job.estimated_driver_pay_cents ?? 0
    if (job.updated_at && new Date(job.updated_at) >= monthStart) {
      jobsThisMonth += 1
      earnedThisMonth += payCents
    }
  }

  const pendingCount = myJobs?.length ?? 0
  const pendingPay = (myJobs ?? []).reduce((sum, j) => sum + (j.estimated_driver_pay_cents ?? 0), 0)

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Drivflo — Driver</h1>
        <div className="flex items-center gap-4">
          <SortSelect />
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <AutoRefresh />
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatCents(pendingPay)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{pendingCount} job{pendingCount === 1 ? '' : 's'} in progress</p>
          </div>
          <div className="border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">This month</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatCents(earnedThisMonth)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{jobsThisMonth} job{jobsThisMonth === 1 ? '' : 's'} completed</p>
          </div>
        </div>

        {myJobs && myJobs.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Your active job{myJobs.length > 1 ? 's' : ''}
            </h2>
            <div className="space-y-3">
              {myJobs.map((job) => (
                <div key={job.id}>
                  <DriverJobActions job={job} isActive />
                  <div className="mt-2">
                    <LocationSharer jobId={job.id} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-2">Available jobs</h2>
          <div className="space-y-3">
            {openJobs?.length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">No open jobs right now.</p>
            )}
            {openJobs?.map((job) => (
              <DriverJobActions key={job.id} job={job} isActive={false} disabled={overlapsAnyMyJob(job)} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
