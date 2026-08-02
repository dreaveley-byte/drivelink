import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import DriverJobActions from './DriverJobActions'
import LocationSharer from '@/components/LocationSharer'
import { formatCents } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export default async function DriverPage() {
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
            Your driver account is currently turned off. Contact DriveLink if you think this is a mistake.
          </p>
          <SignOutButton />
        </div>
      </div>
    )
  }

  const jobSelect = 'id, status, pickup_address, dropoff_address, recipient_name, customer_full_name, vehicle_year, vehicle_make, vehicle_model, stock_number, vin, is_trade_in_pickup, is_first_nations_delivery, key_count, has_wheel_lock, has_charging_cables, other_included_items, estimated_distance_km, estimated_driver_pay_cents, job_types(name), organizations(name)'

  const { data: myJob } = await supabase
    .from('jobs')
    .select(jobSelect)
    .eq('driver_id', user.id)
    .not('status', 'in', '("completed","cancelled")')
    .maybeSingle()

  const { data: openJobs } = await supabase
    .from('jobs')
    .select(jobSelect)
    .eq('status', 'awaiting_driver')
    .order('created_at', { ascending: true })

  const { data: completedJobs } = await supabase
    .from('jobs')
    .select('id, final_driver_pay_cents, estimated_driver_pay_cents, updated_at')
    .eq('driver_id', user.id)
    .eq('status', 'completed')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  let jobsThisMonth = 0
  let earnedThisMonth = 0
  let jobsAllTime = 0
  let earnedAllTime = 0

  for (const job of completedJobs ?? []) {
    const payCents = job.final_driver_pay_cents ?? job.estimated_driver_pay_cents ?? 0
    jobsAllTime += 1
    earnedAllTime += payCents
    if (job.updated_at && new Date(job.updated_at) >= monthStart) {
      jobsThisMonth += 1
      earnedThisMonth += payCents
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">DriveLink — Driver</h1>
        <SignOutButton />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">This month</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatCents(earnedThisMonth)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{jobsThisMonth} job{jobsThisMonth === 1 ? '' : 's'} completed</p>
          </div>
          <div className="border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">All time</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatCents(earnedAllTime)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{jobsAllTime} job{jobsAllTime === 1 ? '' : 's'} completed</p>
          </div>
        </div>

        {myJob && (
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">Your active job</h2>
            <DriverJobActions job={myJob} isActive />
            <div className="mt-2">
              <LocationSharer jobId={myJob.id} />
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
              <DriverJobActions key={job.id} job={job} isActive={false} disabled={!!myJob} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
