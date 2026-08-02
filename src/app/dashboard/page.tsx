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

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong loading your profile</h1>
          <p className="text-sm text-red-600 mb-6 font-mono">{profileError.message}</p>
          <SignOutButton />
        </div>
      </div>
    )
  }

  if (profile?.role === 'driver') {
    redirect('/driver')
  }

  if (profile?.role === 'platform_admin') {
    redirect('/admin')
  }

  if (!profile?.organization_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Almost there</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your account isn&apos;t linked to an organization yet. This gets set up once by an admin — let Dan know your email so he can connect it.
          </p>
          <SignOutButton />
        </div>
      </div>
    )
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', profile.organization_id)
    .single()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status, archived_at, pickup_address, dropoff_address, recipient_name, vehicle_year, vehicle_make, vehicle_model, stock_number, vin, mileage, customer_full_name, customer_phone, customer_address, estimated_distance_km, estimated_dealer_cost_cents, job_types(name), driver:driver_id(full_name, photo_url)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">DriveLink</h1>
          <p className="text-xs text-gray-500">{org?.name}</p>
        </div>
        <SignOutButton />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-medium text-gray-900">Jobs</h2>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/archived" className="text-sm text-gray-600 hover:text-gray-900">
              Archived
            </Link>
            <Link
              href="/dashboard/post-job"
              className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800"
            >
              + Post a new job
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {jobs?.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No jobs yet. Post your first one above.</p>
          )}

          {jobs?.map((job) => {
            const jobTypeName = Array.isArray(job.job_types) ? job.job_types[0]?.name : (job.job_types as { name: string } | null)?.name
            const driverInfo = Array.isArray(job.driver) ? job.driver[0] : (job.driver as { full_name: string; photo_url: string | null } | null)
            return (
            <div
              key={job.id}
              className="border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <div>
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
                {driverInfo?.full_name && (
                  <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1.5">
                    {driverInfo.photo_url ? (
                      <img src={driverInfo.photo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-gray-200 inline-block" />
                    )}
                    {driverInfo.full_name}
                  </p>
                )}
                {job.estimated_dealer_cost_cents != null && (
                  <p className="text-xs text-gray-700 font-medium mt-0.5">
                    Est. cost: {formatCents(job.estimated_dealer_cost_cents)}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1">
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
