import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
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
    .select('*, job_types(name)')
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
          <Link
            href="/dashboard/post-job"
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            + Post a new job
          </Link>
        </div>

        <div className="space-y-3">
          {jobs?.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No jobs yet. Post your first one above.</p>
          )}

          {jobs?.map((job) => (
            <div
              key={job.id}
              className="border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{job.job_types?.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {job.pickup_address} → {job.dropoff_address}
                </p>
                {job.estimated_dealer_cost_cents != null && (
                  <p className="text-xs text-gray-700 font-medium mt-0.5">
                    Est. cost: {formatCents(job.estimated_dealer_cost_cents)}
                  </p>
                )}
              </div>
              <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1">
                {statusLabels[job.status] ?? job.status}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
