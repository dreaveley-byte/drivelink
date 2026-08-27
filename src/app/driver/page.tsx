import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import DriverJobActions from './DriverJobActions'
import LocationSharer from '@/components/LocationSharer'
import AutoRefresh from '@/components/AutoRefresh'
import SortSelect from '@/components/SortSelect'
import Logo from '@/components/Logo'
import SettingsGearLink from '@/components/SettingsGearLink'
import ChatBadgeLink from '@/components/ChatBadgeLink'
import JobMessageWatcher from '@/components/JobMessageWatcher'
import { getUnreadJobChatSet } from '@/lib/unreadChat'
import { formatCents } from '@/lib/pricing'
import { getOutstandingLegalDocs } from '@/lib/legalGate'
import LegalGateModal from '@/components/LegalGateModal'

export const dynamic = 'force-dynamic'

export default async function DriverPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort } = await searchParams
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

  const jobSelect = 'id, status, scheduled_for, delivery_deadline, pickup_address, dropoff_address, recipient_name, customer_full_name, customer_address, customer_phone, vehicle_year, vehicle_make, vehicle_model, stock_number, vin, is_trade_in_pickup, is_chase_vehicle_job, is_first_nations_delivery, out_of_province_inspection, key_count, has_wheel_lock, has_charging_cables, other_included_items, package_description, package_direction, package_size, special_instructions, delivery_gps_lat, delivery_gps_lng, delivery_gps_at, pickup_gps_lat, pickup_gps_lng, pickup_gps_at, id_verification_completed_at, id_verification_sent_at, id_verification_approved_at, id_verification_failed_attempts, id_verification_manual_override, wait_time_started_at, total_wait_minutes, idle_fee_cents, estimated_distance_km, estimated_duration_minutes, estimated_driver_pay_cents, admin_pay_override_cents, estimated_driver_reimbursement_cents, additional_charges, job_types(name), organizations(name, address, phone)'

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
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo height={22} />
          <span className="text-sm text-gray-400">— Driver</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/driver/history" className="text-sm text-gray-600 hover:text-gray-900">
            History
          </Link>
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
          const EXPIRY_MONTHS = 12
          const REMINDER_DAYS = 30
          const docs: { label: string; reviewedAt: string | null }[] = [
            { label: "Driver's abstract", reviewedAt: profile?.driver_abstract_reviewed_at ?? null },
            { label: 'Drug & alcohol test', reviewedAt: profile?.drug_alcohol_test_reviewed_at ?? null },
            { label: 'Medical fitness test', reviewedAt: profile?.medical_fitness_test_reviewed_at ?? null },
            { label: 'Vulnerable sector check', reviewedAt: profile?.vulnerable_sector_check_reviewed_at ?? null },
          ]
          const now = new Date()
          const expired: string[] = []
          const expiringSoon: { label: string; date: string }[] = []
          for (const doc of docs) {
            if (!doc.reviewedAt) {
              expired.push(doc.label)
              continue
            }
            const expiresAt = new Date(doc.reviewedAt)
            expiresAt.setMonth(expiresAt.getMonth() + EXPIRY_MONTHS)
            const daysLeft = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            if (daysLeft < 0) expired.push(doc.label)
            else if (daysLeft <= REMINDER_DAYS) expiringSoon.push({ label: doc.label, date: expiresAt.toLocaleDateString('en-CA', { dateStyle: 'medium' }) })
          }
          if (expired.length === 0 && expiringSoon.length === 0) return null
          return (
            <div className={`border rounded-xl px-4 py-3 ${expired.length > 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
              {expired.length > 0 && (
                <p className="text-sm font-medium text-red-700">
                  You can&apos;t claim new jobs until you upload and get these reviewed: {expired.join(', ')}.
                </p>
              )}
              {expiringSoon.length > 0 && (
                <p className={`text-sm ${expired.length > 0 ? 'text-red-600 mt-1' : 'text-amber-700 font-medium'}`}>
                  {expiringSoon.map((d) => `${d.label} expires ${d.date}`).join(' · ')} — upload a renewal before then to keep claiming jobs.
                </p>
              )}
              <Link href="/driver/settings" className="text-xs underline mt-1 inline-block text-gray-700">
                Go to Compliance
              </Link>
            </div>
          )
        })()}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatCents(pendingPay)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{pendingCount} job{pendingCount === 1 ? '' : 's'} in progress</p>
          </div>
          <div className="border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">This month</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatCents(earnedThisMonth)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{jobsThisMonth} job{jobsThisMonth === 1 ? '' : 's'} completed</p>
          </div>
        </div>

        {myJobs && myJobs.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">
              Your active job{myJobs.length > 1 ? 's' : ''}
            </h2>
            <div className="space-y-3">
              {myJobs.map((job) => (
                <div key={job.id}>
                  <DriverJobActions job={job} isActive approvedReimbursementCents={approvedReimbursementByJob[job.id] ?? 0} />
                  <div className="mt-2 flex items-center gap-3">
                    <LocationSharer jobId={job.id} />
                    <ChatBadgeLink jobId={job.id} unread={unreadChatJobs.has(job.id)} />
                  </div>
                </div>
              ))}
            </div>
            <JobMessageWatcher jobIds={myJobs.map((j) => j.id)} currentUserId={user.id} />
          </div>
        )}

        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-2">Available jobs</h2>
          <div className="space-y-3">
            {openJobs.length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">No open jobs right now.</p>
            )}
            {openJobs.map((job) => (
              <DriverJobActions key={job.id} job={job} isActive={false} disabled={overlapsAnyMyJob(job)} approvedReimbursementCents={approvedReimbursementByJob[job.id] ?? 0} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
