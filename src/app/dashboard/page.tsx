import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import JobActions from '@/components/JobActions'
import AutoRefresh from '@/components/AutoRefresh'
import SortSelect from '@/components/SortSelect'
import Logo from '@/components/Logo'
import SettingsGearLink from '@/components/SettingsGearLink'
import ChatBadgeLink from '@/components/ChatBadgeLink'
import JobMessageWatcher from '@/components/JobMessageWatcher'
import { getUnreadJobChatSet } from '@/lib/unreadChat'
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

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort } = await searchParams
  const ascending = sort !== 'latest'
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

  const isOrgAdmin = profile?.role === 'org_admin'

  if (!profile?.organization_id) {
    const intendedRole = (user.user_metadata?.intended_role as string | undefined) ?? null

    // Already submitted? Show status instead of sending them back to a blank form.
    const { data: driverApp } = await supabase
      .from('driver_applications')
      .select('status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .maybeSingle()

    const { data: dealerApp } = await supabase
      .from('dealer_applications')
      .select('status')
      .eq('submitted_by', user.id)
      .order('created_at', { ascending: false })
      .maybeSingle()

    const existingApp = driverApp ?? dealerApp

    if (existingApp) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white px-6">
          <div className="max-w-sm text-center">
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Application received</h1>
            <p className="text-sm text-gray-500 mb-6">
              Status: <span className="font-medium text-gray-700">{existingApp.status}</span>. We&apos;ll connect your
              account once it&apos;s approved — no need to do anything else for now.
            </p>
            <SignOutButton />
          </div>
        </div>
      )
    }

    if (intendedRole === 'driver') redirect('/driver/apply')
    if (intendedRole === 'dealer') redirect('/dashboard/apply')

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

  const { data: jobsRaw } = await supabase
    .from('jobs')
    .select('id, status, scheduled_for, updated_at, archived_at, pickup_address, dropoff_address, recipient_name, vehicle_year, vehicle_make, vehicle_model, stock_number, vin, mileage, package_description, customer_full_name, customer_phone, customer_address, estimated_distance_km, estimated_dealer_cost_cents, job_types(name), driver:driver_id(full_name, phone, photo_url)')
    .is('archived_at', null)
    .order('scheduled_for', { ascending, nullsFirst: false })

  const jobs = sortJobsActiveFirst(jobsRaw ?? [], ascending)

  const trackableJobIds = (jobs ?? [])
    .filter((j) => ['assigned', 'picked_up', 'in_progress', 'delivered'].includes(j.status))
    .map((j) => j.id)
  const unreadChatJobs = await getUnreadJobChatSet(supabase, user.id, trackableJobIds)

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <Link href="/dashboard"><Logo height={24} /></Link>
          <p className="text-xs text-gray-500 mt-1">{org?.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <SignOutButton />
          <SettingsGearLink href="/dashboard/settings" />
        </div>
      </header>

      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-4 flex-wrap">
          <Link href="/dashboard/archived" className="text-sm text-gray-600 hover:text-gray-900">
            Archived
          </Link>
          {isOrgAdmin && (
            <Link href="/dashboard/org-settings" className="text-sm text-gray-600 hover:text-gray-900">
              Business Info
            </Link>
          )}
          <Link href="/dashboard/team" className="text-sm text-gray-600 hover:text-gray-900">
            Team
          </Link>
          {isOrgAdmin && (
            <Link href="/dashboard/preferred-drivers" className="text-sm text-gray-600 hover:text-gray-900">
              Preferred Drivers
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-4 flex items-center justify-between">
        <Link
          href="/dashboard/post-job"
          className="bg-[#378ADD] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2d6ead]"
        >
          + Post a new job
        </Link>
        <SortSelect />
      </div>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <AutoRefresh />
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-medium text-gray-900">Jobs</h2>
        </div>

        <div className="space-y-3">
          {jobs?.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No jobs yet. Post your first one above.</p>
          )}

          {jobs?.map((job) => {
            const jobTypeName = Array.isArray(job.job_types) ? job.job_types[0]?.name : (job.job_types as { name: string } | null)?.name
            const driverInfo = Array.isArray(job.driver) ? job.driver[0] : (job.driver as { full_name: string; phone: string | null; photo_url: string | null } | null)
            const isFinished = job.status === 'completed' || job.status === 'cancelled'
            const isTrackable = ['assigned', 'picked_up', 'in_progress', 'delivered'].includes(job.status)
            const cardBody = (
              <>
                {job.scheduled_for && (
                  <p className="text-xs font-semibold text-blue-700">
                    {new Date(job.scheduled_for).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}
                <p className="text-sm font-medium text-gray-900">{jobTypeName}</p>
                {['Courier / Package', 'Paperwork Signing'].includes(jobTypeName ?? '') ? (
                  job.package_description && (
                    <p className="text-xs text-gray-700 mt-0.5">📦 {job.package_description}</p>
                  )
                ) : (
                  (job.vehicle_year || job.vehicle_make || job.vehicle_model || job.stock_number) && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')}
                      {job.stock_number && ` · Stock #${job.stock_number}`}
                    </p>
                  )
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
                    {driverInfo.phone && <span className="text-gray-400">· {driverInfo.phone}</span>}
                  </p>
                )}
                {['assigned', 'picked_up', 'in_progress'].includes(job.status) && (job.customer_full_name || job.customer_phone) && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Customer: {job.customer_full_name}
                    {job.customer_full_name && job.customer_phone && ' · '}
                    {job.customer_phone}
                  </p>
                )}
                {job.estimated_dealer_cost_cents != null && (
                  <p className="text-xs text-gray-700 font-medium mt-0.5">
                    Est. cost: {formatCents(job.estimated_dealer_cost_cents)}
                  </p>
                )}
                {isFinished && <p className="text-xs text-blue-600 mt-1">View receipt →</p>}
                {isTrackable && <p className="text-xs text-blue-600 mt-1">Track &amp; message driver →</p>}
              </>
            )
            const linkHref = isFinished
              ? `/dashboard/jobs/${job.id}/receipt`
              : isTrackable
              ? `/dashboard/jobs/${job.id}/track`
              : null
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
                  <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1">
                    {statusLabels[job.status] ?? job.status}
                  </span>
                  <JobActions jobId={job.id} status={job.status} archived={!!job.archived_at} />
                  {isTrackable && <ChatBadgeLink jobId={job.id} unread={unreadChatJobs.has(job.id)} />}
                </div>
              </div>
              {['assigned', 'picked_up', 'in_progress'].includes(job.status) && (driverInfo?.phone || job.customer_phone) && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                  {driverInfo?.phone && (
                    <a href={`tel:${driverInfo.phone}`} className="text-xs text-[#378ADD] hover:underline">
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
            </div>
          )})}
        </div>
        <JobMessageWatcher jobIds={trackableJobIds} currentUserId={user.id} />
      </main>
    </div>
  )
}
