import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import JobActions from '@/components/JobActions'
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

export default async function ArchivedJobsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role === 'driver') redirect('/driver')
  if (profile?.role === 'platform_admin') redirect('/admin/archived')
  if (!profile?.organization_id) redirect('/dashboard')

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status, archived_at, pickup_address, dropoff_address, vehicle_year, vehicle_make, vehicle_model, stock_number, estimated_dealer_cost_cents, job_types(name)')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Archived jobs</h1>
        </div>
        <SignOutButton />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 mb-6 inline-block">
          ← Back to dashboard
        </Link>

        <div className="space-y-3">
          {jobs?.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No archived jobs.</p>
          )}

          {jobs?.map((job) => {
            const jobTypeName = Array.isArray(job.job_types) ? job.job_types[0]?.name : (job.job_types as { name: string } | null)?.name
            const isCompleted = job.status === 'completed'
            const cardBody = (
              <>
                <p className="text-sm font-medium text-gray-900">{jobTypeName}</p>
                {(job.vehicle_year || job.vehicle_make || job.vehicle_model || job.stock_number) && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    {[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')}
                    {job.stock_number && ` · Stock #${job.stock_number}`}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">
                  {job.pickup_address} → {job.dropoff_address}
                </p>
                {job.estimated_dealer_cost_cents != null && (
                  <p className="text-xs text-gray-700 font-medium mt-0.5">
                    Est. cost: {formatCents(job.estimated_dealer_cost_cents)}
                  </p>
                )}
                {isCompleted && <p className="text-xs text-blue-600 mt-1">View receipt →</p>}
              </>
            )
            return (
              <div key={job.id} className={`border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between ${isCompleted ? 'hover:border-gray-300 hover:bg-gray-50' : ''}`}>
                {isCompleted ? (
                  <Link href={`/dashboard/jobs/${job.id}/receipt`} target="_blank" className="flex-1">
                    {cardBody}
                  </Link>
                ) : (
                  <div>{cardBody}</div>
                )}
                <div className="flex flex-col items-end gap-2">
                  <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1">
                    {statusLabels[job.status] ?? job.status}
                  </span>
                  <JobActions jobId={job.id} status={job.status} archived />
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
