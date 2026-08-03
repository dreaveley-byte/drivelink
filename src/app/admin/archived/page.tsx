import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import JobActions from '@/components/JobActions'
import Logo from '@/components/Logo'
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

export default async function AdminArchivedJobsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'platform_admin') redirect('/dashboard')

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, job_types(name), organizations(name), driver:driver_id(full_name, photo_url)')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Logo height={22} />
            <span className="text-sm text-gray-400">— Archived Jobs</span>
          </div>
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
          <Link href="/admin/dealers" className="text-sm text-gray-600 hover:text-gray-900">
            Dealers
          </Link>
          <Link href="/admin/applications" className="text-sm text-gray-600 hover:text-gray-900">
            Applications
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {jobs?.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No archived jobs.</p>
          )}

          {jobs?.map((job) => {
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
                <p className="text-xs text-blue-600 mt-1">View receipt →</p>
              </>
            )
            return (
            <div key={job.id} className="border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between hover:border-gray-300 hover:bg-gray-50">
              <Link href={`/dashboard/jobs/${job.id}/receipt`} target="_blank" className="flex-1">
                {cardBody}
              </Link>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1 whitespace-nowrap">
                  {statusLabels[job.status] ?? job.status}
                </span>
                <JobActions jobId={job.id} status={job.status} archived />
              </div>
            </div>
          )})}
        </div>
      </main>
    </div>
  )
}
