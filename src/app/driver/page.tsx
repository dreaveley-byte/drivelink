import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import DriverJobActions from './DriverJobActions'
import PushNotificationSetup from '@/components/PushNotificationSetup'
import AutoRefresh from '@/components/AutoRefresh'
import SortSelect from '@/components/SortSelect'
import Logo from '@/components/Logo'
import SettingsGearLink from '@/components/SettingsGearLink'
import JobMessageWatcher from '@/components/JobMessageWatcher'
import { getUnreadJobChatSet } from '@/lib/unreadChat'
import { formatCents } from '@/lib/pricing'
import { getOutstandingLegalDocs } from '@/lib/legalGate'
import LegalGateModal from '@/components/LegalGateModal'
import DismissibleBanner from '@/components/DismissibleBanner'
import ClaimedJobsList from '@/components/ClaimedJobsList'
import JobRequirementFlags from '@/components/JobRequirementFlags'
import DriverNotificationsBell from '@/components/DriverNotificationsBell'

export const dynamic = 'force-dynamic'

export default async function DriverPage({ searchParams }: { searchParams: Promise<{ sort?: string; tab?: string; claimed?: string }> }) {
  const { sort, tab: tabParam, claimed: justClaimed } = await searchParams
  const tab = tabParam === 'available' ? 'available' : 'claimed'
  const ascending = sort !== 'latest'
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'driver') {
    // A brand-new driver's profile role doesn't actually become 'driver'
    // until their application is approved (that happens as part of the
    // approval action, not at signup) - without this check, someone who
    // just created their account would get bounced straight to /dashboard
    // instead of being sent to continue the application they were in the
    // middle of. Scoped to intended_role specifically so this can't affect
    // any dealer/admin account, which would never have it set.
    if (user.user_metadata?.intended_role === 'driver') {
      redirect('/driver/apply')
    }
    redirect('/dashboard')
  }

  // A newly-published/updated required document blocks getting jobs until the
  // driver re-signs. Rather than silently redirecting to /driver/resign, stay
  // on this page and show a blocking warning pop-up with a "Click to review"
  // action — and, crucially, don't fetch or render any job data (active or
  // available) behind it, so there's genuinely nothing to accept until it's
  // resolved.
  const outstandingDocs = await getOutstandingLegalDocs(user.id, 'driver')
  if (outstandingDocs.length > 0) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo height={22} />
            <span className="text-sm text-gray-400">— Driver</span>
          </div>
          <SignOutButton />
        </header>
        <main className="max-w-2xl mx-auto px-6 py-16 text-center">
          <p className="text-sm text-gray-400">
            You&apos;ll be able to see and claim jobs again once you&apos;ve reviewed the agreement below.
          </p>
        </main>
        <LegalGateModal applicationType="driver" resignHref="/driver/resign" documentCount={outstandingDocs.length} />
      </div>
    )
  }

  if (!profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <div className="flex justify-center mb-6">
            <Logo height={28} />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Account inactive</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your driver account is currently turned off. Contact Drivflo if you think this is a mistake.
          </p>
          <SignOutButton />
        </div>
      </div>
    )
  }

  const jobSelect = 'id, status, scheduled_for, delivery_deadline, pickup_address, dropoff_address, recipient_name, customer_full_name, customer_address, customer_phone, vehicle_year, vehicle_make, vehicle_model, stock_number, vin, is_trade_in_pickup, is_chase_vehicle_job, is_first_nations_delivery, out_of_province_inspection, key_count, has_wheel_lock, has_charging_cables, other_included_items, package_description, package_direction, package_size, special_instructions, delivery_gps_lat, delivery_gps_lng, delivery_gps_at, pickup_gps_lat, pickup_gps_lng, pickup_gps_at, id_verification_completed_at, id_verification_sent_at, id_verification_approved_at, id_verification_failed_attempts, id_verification_manual_override, wait_time_started_at, total_wait_minutes, idle_fee_cents, estimated_distance_km, estimated_duration_minutes, estimated_driver_pay_cents, admin_pay_override_cents, estimated_driver_reimbursement_cents, additional_charges, vehicle_transmission, second_vehicle_transmission, vehicle_mode, job_types(name), organizations(name, address, phone)'

  const { data: myJobs } = await supabase
    .from('jobs')
    .select(jobSelect)
    .eq('driver_id', user.id)
    .not('status', 'in', '("completed","cancelled")')
    .order('scheduled_for', { ascending, nullsFirst: false })

  const { data: openJobsRaw } = await supabase
    .rpc('get_available_jobs_for_driver', { p_driver_id: user.id })
    .select(jobSelect)
    .order('scheduled_for', { ascending, nullsFirst: false })
  const openJobs = Array.isArray(openJobsRaw) ? openJobsRaw : openJobsRaw ? [openJobsRaw] : []

  // A job's rough time window: scheduled start through an estimated round-trip duration
  // (falls back to 2 hours if we don't have a duration estimate yet).
  function getJobWindow(job: { scheduled_for: string | null; estimated_duration_minutes: number | null }) {
    if (!job.scheduled_for) return null
    const start = new Date(job.scheduled_for).getTime()
    const durationMin = job.estimated_duration_minutes ? job.estimated_duration_minutes * 2 : 120
    return { start, end: start + durationMin * 60000 }
  }

  function overlapsAnyMyJob(job: { scheduled_for: string | null; estimated_duration_minutes: number | null }) {
    const myActiveJobs = myJobs ?? []
    if (myActiveJobs.length === 0) return false
    const window = getJobWindow(job)
    // If either this job or an already-claimed job has no schedule, we can't safely
    // confirm they don't overlap — be conservative and treat it as a conflict.
    if (!window) return true
    return myActiveJobs.some((mine) => {
      const mineWindow = getJobWindow(mine)
      if (!mineWindow) return true
      return window.start < mineWindow.end && mineWindow.start < window.end
    })
  }

  const { data: completedJobs } = await supabase
    .from('jobs')
    .select('id, final_driver_pay_cents, estimated_driver_pay_cents, updated_at')
    .eq('driver_id', user.id)
    .eq('status', 'completed')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  let jobsThisMonth = 0
  let earnedThisMonth = 0

  for (const job of completedJobs ?? []) {
    const payCents = job.final_driver_pay_cents ?? job.estimated_driver_pay_cents ?? 0
    if (job.updated_at && new Date(job.updated_at) >= monthStart) {
      jobsThisMonth += 1
      earnedThisMonth += payCents
    }
  }

  const { data: notificationRows } = await supabase
    .from('driver_notifications')
    .select('id, kind, title, body, job_id, read_at, created_at')
    .eq('driver_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)
  const pendingCount = myJobs?.length ?? 0
  const pendingPay = (myJobs ?? []).reduce((sum, j) => sum + (j.admin_pay_override_cents ?? j.estimated_driver_pay_cents ?? 0), 0)
  const unreadChatJobs = await getUnreadJobChatSet(supabase, user.id, (myJobs ?? []).map((j) => j.id))

  // The reimbursement figure baked into a job at post time (e.g. "Bus back",
  // "Ground transport to airport") is only an estimate — don't show it on the
  // job card as if it's guaranteed money until the driver has actually
  // submitted a 'return_transport' receipt for it and admin has approved it.
  // Build a job_id -> approved-amount map so the real number (not the
  // estimate) is what gets displayed once it's confirmed.
  const allJobIds = [...(myJobs ?? []), ...openJobs].map((j) => j.id)
  const approvedReimbursementByJob: Record<string, number> = {}
  if (allJobIds.length > 0) {
    const { data: approvedReimbursements } = await supabase
      .from('job_expenses')
      .select('job_id, amount_cents')
      .in('job_id', allJobIds)
      .eq('category', 'return_transport')
      .eq('status', 'approved')
    for (const exp of approvedReimbursements ?? []) {
      approvedReimbursementByJob[exp.job_id] = (approvedReimbursementByJob[exp.job_id] ?? 0) + exp.amount_cents
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <PushNotificationSetup />
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo height={22} />
          <span className="text-sm text-gray-400">— Driver</span>
        </div>
        <div className="flex items-center gap-4">
          <DriverNotificationsBell driverId={user.id} initial={notificationRows ?? []} />
          <SignOutButton />
          <SettingsGearLink href="/driver/settings" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 pt-4 flex justify-end">
        <SortSelect />
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <AutoRefresh />
        {(() => {
          const REMINDER_DAYS = 30
          const nowDate = new Date()

          // Driver's licence: no grace period, no override. Checked first.
          const todayBc = nowDate.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' })
          const licenceExpiry: string | null = profile?.license_expiry_date ?? null
          const transitionEnds: string | null = profile?.license_transition_until ?? null
          const licenceBlocked = licenceExpiry ? licenceExpiry < todayBc : !(transitionEnds && new Date(transitionEnds) > nowDate)
          const transitionDays = !licenceExpiry && transitionEnds && new Date(transitionEnds) > nowDate
            ? Math.ceil((new Date(transitionEnds).getTime() - nowDate.getTime()) / 86400000)
            : null

          const wantsPassengerJobs = !!profile?.preferred_job_types?.some((t: string) => t === 'Customer Pick Up' || t === 'Customer Drop Off')
          const docs: { label: string; reviewedAt: string | null; expiryMonths: number }[] = [
            { label: "Driver's abstract", reviewedAt: profile?.driver_abstract_reviewed_at ?? null, expiryMonths: 12 },
            { label: 'Drug & alcohol test', reviewedAt: profile?.drug_alcohol_test_reviewed_at ?? null, expiryMonths: 12 },
            { label: 'Medical fitness test', reviewedAt: profile?.medical_fitness_test_reviewed_at ?? null, expiryMonths: 12 },
            { label: 'Vulnerable sector check', reviewedAt: profile?.vulnerable_sector_check_reviewed_at ?? null, expiryMonths: 12 },
            ...(wantsPassengerJobs
              ? [{ label: 'Vehicle safety inspection', reviewedAt: profile?.vehicle_safety_inspection_reviewed_at ?? null, expiryMonths: 6 }]
              : []),
          ]
          const expired: string[] = []
          const expiringSoon: { label: string; date: string }[] = []
          for (const doc of docs) {
            if (!doc.reviewedAt) {
              expired.push(doc.label)
              continue
            }
            const expiresAt = new Date(doc.reviewedAt)
            expiresAt.setMonth(expiresAt.getMonth() + doc.expiryMonths)
            const daysLeft = Math.round((expiresAt.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24))
            if (daysLeft < 0) expired.push(doc.label)
            else if (daysLeft <= REMINDER_DAYS) expiringSoon.push({ label: doc.label, date: expiresAt.toLocaleDateString('en-CA', { dateStyle: 'medium' }) })
          }

          // Grace period = the admin's existing compliance override (with its own
          // expiry date). The countdown is days until that override ends and
          // never changes when the banner is dismissed.
          const overrideActive = !!profile?.compliance_override && (!profile?.compliance_override_expires_at || new Date(profile.compliance_override_expires_at) > nowDate)
          const graceDaysLeft = overrideActive && profile?.compliance_override_expires_at
            ? Math.max(1, Math.ceil((new Date(profile.compliance_override_expires_at).getTime() - nowDate.getTime()) / 86400000))
            : null

          return (
            <>
              {licenceBlocked && (
                <DismissibleBanner title="Driver's Licence Expired" dismissible={false}>
                  {licenceExpiry
                    ? "Your driver's licence has expired. You cannot view or claim available jobs until your updated valid licence has been submitted and approved."
                    : "We don't have an approved driver's licence expiry date on file for you. You cannot view or claim available jobs until your licence has been uploaded and approved."}{' '}
                  <Link href="/driver/settings" className="underline font-medium">Upload licence</Link>
                </DismissibleBanner>
              )}
              {!licenceBlocked && transitionDays != null && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3">
                  <p className="text-sm font-medium text-amber-800">
                    Please upload your driver&apos;s licence within {transitionDays} day{transitionDays === 1 ? '' : 's'} to keep seeing available jobs.
                  </p>
                  <Link href="/driver/settings" className="text-xs underline mt-1 inline-block text-gray-700">Upload licence</Link>
                </div>
              )}
              {expired.length > 0 && (
                <DismissibleBanner title={expired.length === 1 ? 'Action Required — Document Expired' : 'Multiple Expired Documents'}>
                  {expired.length === 1 && <p>Your {expired[0]} has expired.</p>}
                  <p className={expired.length === 1 ? 'mt-1' : ''}>
                    {graceDaysLeft != null
                      ? `You have ${graceDaysLeft} day${graceDaysLeft === 1 ? '' : 's'} remaining to update your documentation before access to available jobs is restricted.`
                      : overrideActive
                        ? 'An admin has allowed you to keep working while you update your documentation.'
                        : 'Access to available jobs is restricted until your documentation is updated and approved.'}
                  </p>
                  <Link href="/driver/settings" className="underline font-medium inline-block mt-1">Go to Compliance</Link>
                </DismissibleBanner>
              )}
              {expiringSoon.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3">
                  <p className="text-sm text-amber-700 font-medium">
                    {expiringSoon.map((d) => `${d.label} expires ${d.date}`).join(' · ')} — upload a renewal before then to keep claiming jobs.
                  </p>
                  <Link href="/driver/settings" className="text-xs underline mt-1 inline-block text-gray-700">
                    Go to Compliance
                  </Link>
                </div>
              )}
            </>
          )
        })()}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatCents(pendingPay)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{pendingCount} claimed job{pendingCount === 1 ? '' : 's'}</p>
          </div>
          <div className="border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">This month</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatCents(earnedThisMonth)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{jobsThisMonth} job{jobsThisMonth === 1 ? '' : 's'} completed</p>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
          {([
            { key: 'claimed', label: `Claimed (${pendingCount})` },
            { key: 'available', label: `Available (${openJobs.length})` },
          ] as const).map((t) => (
            <Link
              key={t.key}
              href={`/driver?tab=${t.key}${sort ? `&sort=${sort}` : ''}`}
              className={`text-sm px-4 py-2 -mb-px border-b-2 ${tab === t.key ? 'border-[#378ADD] text-gray-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              {t.label}
            </Link>
          ))}
          <Link href="/driver/history" className="text-sm px-4 py-2 -mb-px border-b-2 border-transparent text-gray-500 hover:text-gray-800">
            History
          </Link>
        </div>

        {tab === 'claimed' && (
          <div>
            {justClaimed === '1' && (
              <p className="mb-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                ✓ Job claimed. It&apos;s in your Claimed list below.
              </p>
            )}
            <ClaimedJobsList
              jobs={(myJobs ?? []) as never}
              currentUserId={user.id}
              unreadChatJobIds={[...unreadChatJobs]}
              approvedReimbursementByJob={approvedReimbursementByJob}
            />
            {myJobs && myJobs.length > 0 && <JobMessageWatcher jobIds={myJobs.map((j) => j.id)} currentUserId={user.id} />}
          </div>
        )}

        {tab === 'available' && (
          <div className="space-y-3">
            {openJobs.length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">No open jobs right now.</p>
            )}
            {openJobs.map((job) => (
              <div key={job.id}>
                <JobRequirementFlags job={job} />
                <DriverJobActions job={job} isActive={false} disabled={overlapsAnyMyJob(job)} approvedReimbursementCents={approvedReimbursementByJob[job.id] ?? 0} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
