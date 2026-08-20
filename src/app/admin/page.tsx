import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import JobActions from '@/components/JobActions'
import AutoRefresh from '@/components/AutoRefresh'
import SortSelect from '@/components/SortSelect'
import Logo from '@/components/Logo'
import ReviewHoldBadge from '@/components/ReviewHoldBadge'
import LiveChecklistViewer from '@/components/LiveChecklistViewer'
import { formatCents } from '@/lib/pricing'
import { sortJobsActiveFirst } from '@/lib/sortJobs'

export const dynamic = 'force-dynamic'

const statusLabels: Record<string, string> = {
  awaiting_driver: 'Awaiting Driver',
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  in_progress: 'In Progress',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const statusColors: Record<string, string> = {
  awaiting_driver: 'border-gray-300 text-gray-600 bg-gray-50',
  assigned: 'border-blue-300 text-blue-700 bg-blue-50',
  picked_up: 'border-amber-300 text-amber-700 bg-amber-50',
  in_progress: 'border-purple-300 text-purple-700 bg-purple-50',
  delivered: 'border-teal-300 text-teal-700 bg-teal-50',
  completed: 'border-green-300 text-green-700 bg-green-50',
  cancelled: 'border-red-300 text-red-700 bg-red-50',
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort } = await searchParams
  const ascending = sort !== 'latest'
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

  const { data: jobsRaw } = await supabase
    .from('jobs')
    .select('*, job_types(name), organizations(name), driver:driver_id(full_name, phone, photo_url), reviewer:review_claimed_by(full_name)')
    .is('archived_at', null)
    .order('scheduled_for', { ascending, nullsFirst: false })

  const jobs = sortJobsActiveFirst(jobsRaw ?? [], ascending)

  const { data: reviewSettings } = await supabase
    .from('pricing_settings')
    .select('job_review_hold_minutes, job_review_hold_min_distance_km, job_review_hold_trigger_on_flight')
    .eq('id', 1)
    .single()
  const holdMinutes = reviewSettings?.job_review_hold_minutes ?? 5
  const holdMinDistanceKm = reviewSettings?.job_review_hold_min_distance_km ?? 400
  const holdTriggerOnFlight = reviewSettings?.job_review_hold_trigger_on_flight ?? true

  // Whether this job should show the review-hold badge right now. Only ever
  // applies to a job that's still actually awaiting a driver — a completed
  // or cancelled job has nothing left to review and should never show this.
  // Once claimed, the badge stays up regardless of the timer (claiming stops
  // the auto-release clock and requires an explicit approve from here on);
  // if it was never claimed, the badge disappears once the timer runs out,
  // since the job has already gone live to drivers on its own by then.
  function isOnHold(job: {
    status: string
    estimated_distance_km: number | null
    one_way_flight_back: boolean
    review_approved_at: string | null
    review_claimed_at: string | null
    created_at: string
  }) {
    if (job.review_approved_at) return false
    if (job.status !== 'awaiting_driver') return false
    const qualifiesByDistance = job.estimated_distance_km != null && job.estimated_distance_km >= holdMinDistanceKm
    const qualifiesByFlight = holdTriggerOnFlight && job.one_way_flight_back
    if (!qualifiesByDistance && !qualifiesByFlight) return false
    if (job.review_claimed_at) return true
    const holdEndsAt = new Date(job.created_at).getTime() + holdMinutes * 60000
    return Date.now() < holdEndsAt
  }

  const total = jobs?.length ?? 0
  const awaiting = jobs?.filter((j) => j.status === 'awaiting_driver').length ?? 0
  const active = jobs?.filter((j) => ['assigned', 'picked_up', 'in_progress'].includes(j.status)).length ?? 0
  const completed = jobs?.filter((j) => j.status === 'completed').length ?? 0
  const awaitingReview = jobs?.filter((j) => isOnHold(j) && !j.review_approved_at).length ?? 0

  const { count: driverCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'driver')

  const { count: activeDriverCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'driver')
    .eq('is_active', true)

  const { count: dealerCount } = await supabase
    .from('organizations')
    .select('id', { count: 'exact', head: true })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: mtdJobs } = await supabase
    .from('jobs')
    .select('estimated_dealer_cost_cents, estimated_driver_pay_cents, final_driver_pay_cents')
    .eq('status', 'completed')
    .gte('updated_at', monthStart)

  let dealerSpendMtd = 0
  let driverEarningsMtd = 0
  for (const job of mtdJobs ?? []) {
    dealerSpendMtd += job.estimated_dealer_cost_cents ?? 0
    driverEarningsMtd += job.final_driver_pay_cents ?? job.estimated_driver_pay_cents ?? 0
  }
  const drivfloProfitMtd = dealerSpendMtd - driverEarningsMtd

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin"><Logo height={22} /></Link>
            <span className="text-sm text-gray-400">— Admin</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">All dealers, all jobs</p>
        </div>
        <div className="flex items-center gap-4">
          <SignOutButton />
          <SettingsGearLink href="/admin/account" />
        </div>
      </header>

      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4 flex-wrap">
          <Link href="/admin/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </Link>
          <Link href="/admin/drivers" className="text-sm text-gray-600 hover:text-gray-900">
            Drivers
          </Link>
          <Link href="/admin/dealers" className="text-sm text-gray-600 hover:text-gray-900">
            Dealers
          </Link>
          <Link href="/admin/applications" className="text-sm text-gray-600 hover:text-gray-900">
            Applications
          </Link>
          <Link href="/admin/archived" className="text-sm text-gray-600 hover:text-gray-900">
            Archived
          </Link>
          <Link href="/admin/discount-codes" className="text-sm text-gray-600 hover:text-gray-900">
            Discount codes
          </Link>
          <Link href="/admin/legal-documents" className="text-sm text-gray-600 hover:text-gray-900">
            Legal documents
          </Link>
          <Link href="/admin/payroll" className="text-sm text-gray-600 hover:text-gray-900 ml-auto">
            Payroll
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-4 flex justify-end">
        <SortSelect />
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <AutoRefresh />
        <div className="grid grid-cols-5 gap-4 mb-4">
          {[
            { label: 'Total Jobs', value: total },
            { label: 'Awaiting Review', value: awaitingReview },
            { label: 'Awaiting a Driver', value: awaiting },
            { label: 'In Progress', value: active },
            { label: 'Completed', value: completed },
          ].map((stat) => (
            <div key={stat.label} className="border border-gray-200 rounded-xl px-4 py-3 flex flex-col items-center justify-between text-center min-h-[84px]">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="border border-gray-200 rounded-xl px-4 py-3 flex flex-col items-center justify-between text-center min-h-[84px]">
            <p className="text-xs text-gray-500">Dealer Spend (MTD)</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{formatCents(dealerSpendMtd)}</p>
          </div>
          <div className="border border-gray-200 rounded-xl px-4 py-3 flex flex-col items-center justify-between text-center min-h-[84px]">
            <p className="text-xs text-gray-500">Driver Earnings (MTD)</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{formatCents(driverEarningsMtd)}</p>
          </div>
          <div className="border border-gray-200 rounded-xl px-4 py-3 bg-[#378ADD] flex flex-col items-center justify-between text-center min-h-[84px]">
            <p className="text-xs text-gray-300">Drivflo Profit (MTD)</p>
            <p className="text-xl font-semibold text-white mt-1">{formatCents(drivfloProfitMtd)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <Link href="/admin/drivers" className="border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:bg-gray-50">
            <p className="text-xs text-gray-500">Driver Accounts</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{driverCount ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">{activeDriverCount ?? 0} active</p>
          </Link>
          <Link href="/admin/dealers" className="border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:bg-gray-50">
            <p className="text-xs text-gray-500">Dealer Accounts</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{dealerCount ?? 0}</p>
          </Link>
          <Link href="/admin/coverage" className="border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:bg-gray-50 flex flex-col justify-center">
            <p className="text-sm text-gray-700 font-medium">View coverage map →</p>
            <p className="text-xs text-gray-400 mt-0.5">Drivers vs. dealers by location</p>
          </Link>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-gray-900">All Jobs</h2>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/post-job"
              className="bg-[#378ADD] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2d6ead]"
            >
              + Post a new job
            </Link>
          </div>
        </div>
        <div className="space-y-3">
          {jobs?.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No jobs in the system yet.</p>
          )}

          {jobs?.map((job) => {
            const isFinished = job.status === 'completed' || job.status === 'cancelled'
            const isTrackable = ['assigned', 'picked_up', 'in_progress', 'delivered'].includes(job.status)
            const linkHref = isFinished
              ? `/dashboard/jobs/${job.id}/receipt`
              : isTrackable
              ? `/dashboard/jobs/${job.id}/track`
              : null
            const cardBody = (
              <>
                {job.scheduled_for && (
                  <p className="text-xs font-semibold text-blue-700">
                    {new Date(job.scheduled_for).toLocaleString('en-CA', { timeZone: 'America/Vancouver', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}
                <p className="text-sm font-medium text-gray-900">
                  {job.job_types?.name}
                  <span className="text-gray-400 font-normal"> · {job.organizations?.name}</span>
                </p>
                {['Courier / Package', 'Parts Delivery', 'Parts Pickup', 'Paperwork Signing'].includes(job.job_types?.name ?? '') ? (
                  <>
                    {job.package_description && (
                      <p className="text-xs text-gray-700 mt-0.5">
                        📦 {job.package_direction === 'pickup' ? 'Pick up: ' : job.package_direction === 'dropoff' ? 'Drop off: ' : ''}
                        {job.package_size === 'small' ? 'Small: ' : job.package_size === 'medium' ? 'Medium: ' : job.package_size === 'large' ? 'Large: ' : ''}
                        {job.package_description}
                      </p>
                    )}
                    {job.special_instructions && (
                      <p className="text-xs text-amber-700 mt-0.5">📝 {job.special_instructions}</p>
                    )}
                  </>
                ) : (
                  (job.vehicle_year || job.vehicle_make || job.stock_number) && (
                    <p className="text-xs text-gray-700 mt-0.5">
                      {[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')}
                      {job.stock_number && ` · #${job.stock_number}`}
                    </p>
                  )
                )}
                <p className="text-xs text-gray-500 mt-0.5">
                  {job.pickup_address} → {job.dropoff_address}
                </p>
                {!job.driver?.full_name && (
                  <p className="text-xs text-gray-400 mt-0.5">Driver: Unassigned</p>
                )}
                {['assigned', 'picked_up', 'in_progress'].includes(job.status) && (job.customer_full_name || job.customer_phone) && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Customer: {job.customer_full_name}
                    {job.customer_full_name && job.customer_phone && ' · '}
                    {job.customer_phone}
                  </p>
                )}
                {(job.estimated_dealer_cost_cents != null || job.estimated_driver_pay_cents != null) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {job.estimated_dealer_cost_cents != null && `Cost: ${formatCents(job.estimated_dealer_cost_cents)}`}
                    {job.estimated_dealer_cost_cents != null && job.estimated_driver_pay_cents != null && ' · '}
                    {job.estimated_driver_pay_cents != null && `Pay: ${formatCents(job.estimated_driver_pay_cents)}`}
                  </p>
                )}
                {['picked_up', 'in_progress'].includes(job.status) && (() => {
                  const updatedAt = job.driver_location_updated_at ? new Date(job.driver_location_updated_at) : null
                  const minutesAgo = updatedAt ? (Date.now() - updatedAt.getTime()) / 60000 : null
                  if (minutesAgo == null) {
                    return <p className="text-xs text-red-600 mt-0.5">⚠️ Not sharing location</p>
                  }
                  if (minutesAgo > 2) {
                    return <p className="text-xs text-amber-600 mt-0.5">⚠️ Location stale ({Math.round(minutesAgo)}m ago)</p>
                  }
                  return <p className="text-xs text-green-600 mt-0.5">● Live location</p>
                })()}
                {isFinished && <p className="text-xs text-blue-600 mt-1">View receipt →</p>}
                {isTrackable && <p className="text-xs text-blue-600 mt-1">Track drive →</p>}
              </>
            )
            return (
            <div
              key={job.id}
              className="border border-gray-200 rounded-xl px-4 py-3"
            >
              <div className={`flex items-center justify-between ${linkHref ? 'hover:bg-gray-50 -mx-1 px-1 rounded-lg' : ''}`}>
                {linkHref ? (
                  <Link href={linkHref} target="_blank" className="flex-1">
                    {cardBody}
                  </Link>
                ) : (
                  <div className="flex-1">{cardBody}</div>
                )}
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs border rounded-full px-2.5 py-1 whitespace-nowrap font-medium ${statusColors[job.status] ?? 'border-gray-300 text-gray-700'}`}>
                    {statusLabels[job.status] ?? job.status}
                  </span>
                  {job.status === 'in_progress' && job.pickup_gps_at && job.estimated_duration_minutes != null && (
                    <span className="text-[10px] text-purple-600 font-medium whitespace-nowrap">
                      ETA {new Date(new Date(job.pickup_gps_at).getTime() + job.estimated_duration_minutes * 60000).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                  <JobActions jobId={job.id} status={job.status} archived={!!job.archived_at} isAdmin />
                </div>
              </div>
              {job.driver?.full_name && job.driver_id && (
                <Link
                  href={`/admin/drivers/${job.driver_id}`}
                  className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-600 hover:text-gray-900 w-fit"
                >
                  {job.driver.photo_url ? (
                    <img src={job.driver.photo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-gray-200 inline-block" />
                  )}
                  Driver: <span className="text-[#378ADD] hover:underline">{job.driver.full_name}</span>
                  {job.driver.phone && <span className="text-gray-400">· {job.driver.phone}</span>}
                </Link>
              )}
              {isOnHold(job) && (
                <ReviewHoldBadge
                  jobId={job.id}
                  createdAt={job.created_at}
                  holdMinutes={holdMinutes}
                  reviewClaimedByName={job.reviewer?.full_name ?? null}
                  reviewClaimedAt={job.review_claimed_at}
                  reviewApproved={!!job.review_approved_at}
                  isClaimedByMe={job.review_claimed_by === user.id}
                />
              )}
              {['assigned', 'picked_up', 'in_progress'].includes(job.status) && (job.driver?.phone || job.customer_phone) && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                  {job.driver?.phone && (
                    <a href={`tel:${job.driver.phone}`} className="text-xs text-[#378ADD] hover:underline">
                      📞 Call driver
                    </a>
                  )}
                  {job.customer_phone && (
                    <a href={`tel:${job.customer_phone}`} className="text-xs text-[#378ADD] hover:underline">
                      📞 Call customer
                    </a>
                  )}
                </div>
              )}
              {['assigned', 'picked_up', 'in_progress', 'delivered'].includes(job.status) && (
                <LiveChecklistViewer jobId={job.id} />
              )}
            </div>
          )})}
        </div>
      </main>
    </div>
  )
}
