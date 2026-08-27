import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import DriverActiveToggle from '@/components/DriverActiveToggle'
import ResetPasswordButton from '@/components/ResetPasswordButton'
import ApplicationCard from '@/components/ApplicationCard'
import DriverApplicationEditForm from '@/components/DriverApplicationEditForm'
import CollapsibleSection from '@/components/CollapsibleSection'
import DriverQRCode from '@/components/DriverQRCode'
import AdminProfileEditForm from '@/components/AdminProfileEditForm'
import AdminComplianceReview from '@/components/AdminComplianceReview'
import ComplianceOverrideToggle from '@/components/ComplianceOverrideToggle'
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

  const { data: publicFeedback } = await supabase
    .from('driver_public_feedback')
    .select('type, message, submitter_name, submitter_contact, created_at')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })

  const { data: application } = await supabase
    .from('driver_applications')
    .select('*')
    .eq('user_id', driverId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: stats } = await supabase.rpc('driver_performance_stats')

  // Last 6 months earnings breakdown, excluding reimbursements - matching
  // the same "not including reimbursements" view used on the payroll page.
  const { data: earningsJobs } = await supabase
    .from('jobs')
    .select('updated_at, final_driver_pay_cents, estimated_driver_pay_cents')
    .eq('driver_id', driverId)
    .eq('status', 'completed')

  const nowForDriver = new Date()
  const monthlyEarnings: { label: string; earningsCents: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(nowForDriver.getFullYear(), nowForDriver.getMonth() - i, 1)
    const mEnd = new Date(nowForDriver.getFullYear(), nowForDriver.getMonth() - i + 1, 1)
    let earnings = 0
    for (const job of earningsJobs ?? []) {
      if (job.updated_at) {
        const d = new Date(job.updated_at)
        if (d >= mStart && d < mEnd) earnings += job.final_driver_pay_cents ?? job.estimated_driver_pay_cents ?? 0
      }
    }
    monthlyEarnings.push({ label: mStart.toLocaleDateString('en-CA', { month: 'short', year: '2-digit' }), earningsCents: earnings })
  }

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

  const { data: monthJobs } = await supabase
    .from('jobs')
    .select('status, updated_at, final_driver_pay_cents, estimated_driver_pay_cents')
    .eq('driver_id', driverId)
    .eq('status', 'completed')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  let jobsThisMonth = 0
  let earnedThisMonth = 0
  for (const job of monthJobs ?? []) {
    if (job.updated_at && new Date(job.updated_at) >= monthStart) {
      jobsThisMonth += 1
      earnedThisMonth += job.final_driver_pay_cents ?? job.estimated_driver_pay_cents ?? 0
    }
  }

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
          <SignOutButton />
          <SettingsGearLink href="/admin/account" />
        </div>
      </header>

      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-4 flex-wrap">
          <Link href="/admin/drivers" className="text-sm text-gray-600 hover:text-gray-900">
            Drivers
          </Link>
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
        </div>
      </div>

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
              {driver.driver_code && (
                <p className="text-xs text-gray-400 font-mono mt-0.5">{driver.driver_code}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {driver.license_class && (
                  <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2 py-0.5">
                    Self-reported: {driver.license_class}
                  </span>
                )}
                {driver.extracted_license_class && (
                  <span
                    className={`text-xs border rounded-full px-2 py-0.5 ${
                      driver.license_class && driver.license_class !== driver.extracted_license_class
                        ? 'border-red-300 text-red-700'
                        : 'border-green-300 text-green-700'
                    }`}
                  >
                    From license photo: {driver.extracted_license_class}
                    {driver.license_class && driver.license_class !== driver.extracted_license_class && ' — mismatch, please verify'}
                  </span>
                )}
                {driver.can_tow_trailer === true && (
                  <span className="text-xs border border-blue-300 text-blue-700 rounded-full px-2 py-0.5">
                    Can tow a large trailer
                  </span>
                )}
                {driver.can_tow_trailer === false && (
                  <span className="text-xs border border-gray-300 text-gray-500 rounded-full px-2 py-0.5">
                    Cannot tow a large trailer
                  </span>
                )}
              </div>
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
            <p className="text-gray-400">Earned this month</p>
            <p className="text-gray-900 font-medium text-sm mt-0.5">{formatCents(earnedThisMonth)}</p>
            <p className="text-gray-400 text-[10px] mt-0.5">{jobsThisMonth} job{jobsThisMonth === 1 ? '' : 's'} this month</p>
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

        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Earnings, last 6 months (excl. reimbursements)</p>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Month</th>
                  <th className="text-right px-3 py-1.5 font-medium">Earnings</th>
                </tr>
              </thead>
              <tbody>
                {monthlyEarnings.map((m) => (
                  <tr key={m.label} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 text-gray-700">{m.label}</td>
                    <td className="px-3 py-1.5 text-right text-gray-900 font-medium">{formatCents(m.earningsCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a href={`/admin/payroll`} className="text-xs text-blue-600 hover:underline mt-1.5 inline-block">
            View in Payroll →
          </a>
        </div>

        <AdminProfileEditForm
          userId={driver.id}
          initialFullName={driver.full_name ?? ''}
          initialPhone={driver.phone ?? ''}
          initialGender={driver.gender}
          photoTarget={{
            currentUrl: driver.photo_url ?? null,
            bucket: 'driver-photos',
            folder: driver.id,
            label: 'Driver photo',
          }}
        />

        <DriverQRCode driverId={driver.id} />

        {publicFeedback && publicFeedback.length > 0 && (
          <div className="border border-gray-200 rounded-xl p-4 mt-4">
            <p className="text-sm font-medium text-gray-900 mb-3">
              Public feedback ({publicFeedback.length})
            </p>
            <div className="space-y-3">
              {publicFeedback.map((f, i) => (
                <div key={i} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${f.type === 'praise' ? 'text-green-700' : 'text-red-600'}`}>
                      {f.type === 'praise' ? '👍 Praise' : '⚠️ Complaint'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(f.created_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{f.message}</p>
                  {(f.submitter_name || f.submitter_contact) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[f.submitter_name, f.submitter_contact].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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

        <div>
          <CollapsibleSection
            title="Application & Documents"
            subtitle={
              application?.contract_signed_at ? (
                <Link
                  href={`/admin/drivers/${driver.id}/agreement`}
                  className="text-xs text-blue-600 hover:underline"
                  target="_blank"
                >
                  Print signed agreement →
                </Link>
              ) : null
            }
          >
            {application ? (
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
                  { label: 'Vehicle registration', path: application.vehicle_registration_path },
                  { label: 'Vehicle insurance', path: application.vehicle_insurance_path },
                  { label: 'Vehicle photo', path: application.vehicle_photo_path },
                  { label: 'Vehicle walkaround video', path: application.vehicle_walkaround_video_path },
                  { label: 'Dash/odometer photo', path: application.dash_odometer_photo_path },
                  { label: 'Signed contract', path: application.contract_signature_path },
                ]}
              />
            ) : (
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-4">
                  No application on file for this driver yet — you can fill it in here on their behalf.
                </p>
                <DriverApplicationEditForm userId={driver.id} userEmail={driver.email ?? ''} application={null} />
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Recurring Compliance Documents" subtitle={<span className="text-xs text-gray-400">Renewal required every 12 months</span>}>
            <ComplianceOverrideToggle
              driverId={driver.id}
              isOverridden={!!driver.compliance_override}
              note={driver.compliance_override_note}
              expiresAt={driver.compliance_override_expires_at}
            />
            <div className="mt-3">
              <AdminComplianceReview
              driverId={driver.id}
              wantsPassengerJobs={!!driver.preferred_job_types?.some((t: string) => t === 'Customer Pick Up' || t === 'Customer Drop Off')}
              documents={{
                driver_abstract: {
                  path: driver.driver_abstract_path,
                  uploadedAt: driver.driver_abstract_uploaded_at,
                  reviewedAt: driver.driver_abstract_reviewed_at,
                },
                drug_alcohol_test: {
                  path: driver.drug_alcohol_test_path,
                  uploadedAt: driver.drug_alcohol_test_uploaded_at,
                  reviewedAt: driver.drug_alcohol_test_reviewed_at,
                },
                medical_fitness_test: {
                  path: driver.medical_fitness_test_path,
                  uploadedAt: driver.medical_fitness_test_uploaded_at,
                  reviewedAt: driver.medical_fitness_test_reviewed_at,
                },
                vulnerable_sector_check: {
                  path: driver.vulnerable_sector_check_path,
                  uploadedAt: driver.vulnerable_sector_check_uploaded_at,
                  reviewedAt: driver.vulnerable_sector_check_reviewed_at,
                },
                vehicle_safety_inspection: {
                  path: driver.vehicle_safety_inspection_path,
                  uploadedAt: driver.vehicle_safety_inspection_uploaded_at,
                  reviewedAt: driver.vehicle_safety_inspection_reviewed_at,
                },
              }}
              />
            </div>
          </CollapsibleSection>
        </div>

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
