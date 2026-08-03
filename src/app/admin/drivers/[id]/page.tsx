import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import DriverActiveToggle from '@/components/DriverActiveToggle'
import ResetPasswordButton from '@/components/ResetPasswordButton'
import ApplicationCard from '@/components/ApplicationCard'
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { dateStyle: 'medium' })
}

export default async function AdminDriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: driverId } = await params
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

  const { data: driver } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', driverId)
    .eq('role', 'driver')
    .single()

  if (!driver) notFound()

  const { data: application } = await supabase
    .from('driver_applications')
    .select('*')
    .eq('user_id', driverId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: stats } = await supabase.rpc('driver_performance_stats')
  type DriverStat = {
    driver_id: string
    total_completed: number
    total_releases: number
    releases_after_pickup: number
    avg_checklist_completion: number | null
    on_time_pickups: number
    total_scheduled_pickups: number
    avg_customer_rating: number | null
    avg_dealer_rating: number | null
  }
  const s = (stats ?? []).find((row: DriverStat) => row.driver_id === driverId) as DriverStat | undefined

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status, scheduled_for, pickup_address, dropoff_address, estimated_driver_pay_cents, organizations(name)')
    .eq('driver_id', driverId)
    .order('scheduled_for', { ascending: false, nullsFirst: false })
    .limit(25)

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin"><Logo height={22} /></Link>
            <span className="text-sm text-gray-400">— Driver</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Driver profile</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/drivers" className="text-sm text-gray-600 hover:text-gray-900">
            Drivers
          </Link>
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
          <SignOutButton />
          <SettingsGearLink href="/admin/account" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div>
          <Link href="/admin/drivers" className="text-xs text-gray-400 hover:text-gray-600">
            ← Back to drivers
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {driver.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={driver.photo_url} alt="" className="w-14 h-14 rounded-full object-cover border border-gray-200" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-200" />
            )}
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{driver.full_name || 'Unnamed driver'}</h1>
              <p className="text-sm text-gray-500">{driver.phone || 'No phone on file'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <span
              className={`text-xs border rounded-full px-2.5 py-1 ${
                driver.is_active ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-500'
              }`}
            >
              {driver.is_active ? 'Active' : 'Inactive'}
            </span>
            <DriverActiveToggle driverId={driver.id} isActive={driver.is_active} />
            <ResetPasswordButton email={driver.email} />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-gray-400">Completed jobs</p>
            <p className="text-gray-900 font-medium text-sm mt-0.5">{s?.total_completed ?? 0}</p>
          </div>
          <div>
            <p className="text-gray-400">Checklist completion</p>
            <p className="text-gray-900 font-medium text-sm mt-0.5">
              {s?.avg_checklist_completion != null ? `${Math.round(s.avg_checklist_completion * 100)}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-400">On-time pickups</p>
            <p className="text-gray-900 font-medium text-sm mt-0.5">
              {s && s.total_scheduled_pickups > 0 ? `${s.on_time_pickups}/${s.total_scheduled_pickups}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Ratings (cust / dealer)</p>
            <p className="text-gray-900 font-medium text-sm mt-0.5">
              {s?.avg_customer_rating != null ? s.avg_customer_rating.toFixed(1) : '—'} / {s?.avg_dealer_rating != null ? s.avg_dealer_rating.toFixed(1) : '—'}
            </p>
          </div>
          {s && s.total_releases > 0 && (
            <div className="col-span-2 sm:col-span-4">
              <p className={s.releases_after_pickup > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                {s.total_releases} release{s.total_releases === 1 ? '' : 's'} total
                {s.releases_after_pickup > 0 && ` — ${s.releases_after_pickup} after pickup ⚠️`}
              </p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Driver Info</p>
          <div className="border border-gray-200 rounded-xl px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Full name</p>
              <p className="text-gray-900">{application?.full_name || driver.full_name || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Address</p>
              <p className="text-gray-900">{application?.address || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Cell phone</p>
              <p className="text-gray-900">{application?.cell_phone || driver.phone || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Home phone</p>
              <p className="text-gray-900">{application?.home_phone || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Email</p>
              <p className="text-gray-900">{application?.email || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Payout method</p>
              <p className="text-gray-900 capitalize">{application?.payout_method || '—'}</p>
            </div>
            {application?.payout_method === 'company' && (
              <>
                <div>
                  <p className="text-gray-400 text-xs">Company name</p>
                  <p className="text-gray-900">{application?.company_name || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">GST number</p>
                  <p className="text-gray-900">{application?.gst_number || '—'}</p>
                </div>
              </>
            )}
            {application?.sin_number && (
              <div>
                <p className="text-gray-400 text-xs">SIN on file</p>
                <p className="text-gray-900">•••-•••-{application.sin_number.slice(-3)}</p>
              </div>
            )}
          </div>
        </div>

        {application && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Application &amp; Documents</p>
            <ApplicationCard
              table="driver_applications"
              id={application.id}
              title={application.full_name || driver.full_name || 'Unnamed applicant'}
              subtitle={`${application.email ?? ''} · ${application.cell_phone ?? ''}`}
              status={application.status}
              bucket="driver-documents"
              userId={application.user_id}
              profilePhotoPath={application.profile_photo_path}
              docs={[
                { label: 'Profile photo', path: application.profile_photo_path },
                { label: "Driver's license", path: application.drivers_license_path },
                { label: "Driver's abstract", path: application.drivers_abstract_path },
                { label: 'Background check', path: application.criminal_background_check_path },
                { label: 'VSA license', path: application.vsa_license_path },
                { label: 'Medical fitness', path: application.medical_fitness_path },
                { label: 'Drug & alcohol test', path: application.drug_alcohol_test_path },
                { label: 'Optical test', path: application.optical_test_path },
                { label: 'Void cheque', path: application.void_cheque_path },
                { label: 'Signed contract', path: application.contract_signature_path },
              ]}
            />
          </div>
        )}

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Recent Jobs</p>
          <div className="space-y-2">
            {(!jobs || jobs.length === 0) && (
              <p className="text-sm text-gray-400 py-4 text-center">No jobs yet.</p>
            )}
            {jobs?.map((job) => (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}/receipt`}
                target="_blank"
                className="block border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {(job.organizations as unknown as { name: string } | null)?.name ?? 'Unknown dealer'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {job.pickup_address} → {job.dropoff_address}
                    </p>
                    {job.scheduled_for && (
                      <p className="text-xs text-gray-400 mt-0.5">{fmtDate(job.scheduled_for)}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1 whitespace-nowrap">
                      {statusLabels[job.status] ?? job.status}
                    </span>
                    {job.estimated_driver_pay_cents != null && (
                      <span className="text-xs text-gray-500">{formatCents(job.estimated_driver_pay_cents)}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
