import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import JobActions from '@/components/JobActions'
import AutoRefresh from '@/components/AutoRefresh'
import SortSelect from '@/components/SortSelect'
import Logo from '@/components/Logo'
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
    .select('*, job_types(name), organizations(name), driver:driver_id(full_name, photo_url)')
    .is('archived_at', null)
    .order('scheduled_for', { ascending, nullsFirst: false })

  const jobs = sortJobsActiveFirst(jobsRaw ?? [], ascending)

  const total = jobs?.length ?? 0
  const awaiting = jobs?.filter((j) => j.status === 'awaiting_driver').length ?? 0
  const active = jobs?.filter((j) => ['assigned', 'picked_up', 'in_progress'].includes(j.status)).length ?? 0
  const completed = jobs?.filter((j) => j.status === 'completed').length ?? 0

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
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-4 flex justify-end">
        <SortSelect />
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <AutoRefresh />
        <div className="grid grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Total Jobs', value: total },
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
                    {new Date(job.scheduled_for).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}
                <p className="text-sm font-medium text-gray-900">
                  {job.job_types?.name}
                  <span className="text-gray-400 font-normal"> · {job.organizations?.name}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {job.pickup_address} → {job.dropoff_address}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                  Driver:
                  {job.driver?.full_name ? (
                    <span className="inline-flex items-center gap-1.5">
                      {job.driver.photo_url ? (
                        <img src={job.driver.photo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-gray-200 inline-block" />
                      )}
                      {job.driver.full_name}
                    </span>
                  ) : (
                    'Unassigned'
                  )}
                </p>
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
              className={`border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between ${linkHref ? 'hover:border-gray-300 hover:bg-gray-50' : ''}`}
            >
              {linkHref ? (
                <Link href={linkHref} target="_blank" className="flex-1">
                  {cardBody}
                </Link>
              ) : (
                <div>{cardBody}</div>
              )}
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1 whitespace-nowrap">
                  {statusLabels[job.status] ?? job.status}
                </span>
                <JobActions jobId={job.id} status={job.status} archived={!!job.archived_at} />
              </div>
            </div>
          )})}
        </div>
      </main>
    </div>
  )
}
