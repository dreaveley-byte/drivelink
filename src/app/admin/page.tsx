import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import JobActions from '@/components/JobActions'
import AutoRefresh from '@/components/AutoRefresh'
import { formatCents } from '@/lib/pricing'

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

export default async function AdminPage() {
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

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, job_types(name), organizations(name), driver:driver_id(full_name, photo_url)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  const total = jobs?.length ?? 0
  const awaiting = jobs?.filter((j) => j.status === 'awaiting_driver').length ?? 0
  const active = jobs?.filter((j) => ['assigned', 'picked_up', 'in_progress'].includes(j.status)).length ?? 0
  const completed = jobs?.filter((j) => j.status === 'completed').length ?? 0

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">DriveLink — Admin</h1>
          <p className="text-xs text-gray-500">All dealers, all jobs</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </Link>
          <Link href="/admin/drivers" className="text-sm text-gray-600 hover:text-gray-900">
            Drivers
          </Link>
          <Link href="/admin/applications" className="text-sm text-gray-600 hover:text-gray-900">
            Applications
          </Link>
          <Link href="/admin/archived" className="text-sm text-gray-600 hover:text-gray-900">
            Archived
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <AutoRefresh />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Jobs', value: total },
            { label: 'Awaiting Driver', value: awaiting },
            { label: 'Active', value: active },
            { label: 'Completed', value: completed },
          ].map((stat) => (
            <div key={stat.label} className="border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-gray-900">All Jobs</h2>
          <Link
            href="/dashboard/post-job"
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            + Post a new job
          </Link>
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
