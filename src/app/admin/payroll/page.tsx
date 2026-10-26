import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import Logo from '@/components/Logo'
import MarkPaidButton from '@/components/MarkPaidButton'
import AddDrawButton from '@/components/AddDrawButton'
import DateRangeFilter from '@/components/DateRangeFilter'
import DriverPayrollJobs, { type PayrollJobRow, type PayrollDrawRow } from '@/components/DriverPayrollJobs'
import { formatCents } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

function mostRecentMonday(): Date {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export default async function AdminPayrollPage({ searchParams }: { searchParams: Promise<{ week?: string; start?: string; end?: string }> }) {
  const { week, start, end } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'platform_admin') redirect('/dashboard')

  let weekStart: Date
  let weekEnd: Date
  if (start && end) {
    weekStart = new Date(start + 'T00:00:00')
    weekEnd = new Date(end + 'T00:00:00')
  } else {
    weekStart = week ? new Date(week + 'T00:00:00') : mostRecentMonday()
    weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
  }
  const weekStartStr = weekStart.toISOString().slice(0, 10)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)

  const prevWeek = new Date(weekStart)
  prevWeek.setDate(prevWeek.getDate() - 7)

  // Which period is on screen, so every heading says so (they used to say
  // "this week" no matter which dates were picked).
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' })
  const monthStartStr = `${todayStr.slice(0, 7)}-01`
  const monthToDateActive = !!start && start === monthStartStr && end === todayStr
  const periodUnit = monthToDateActive ? 'month to date' : start ? 'in period' : week ? 'previous week' : 'this week'
  const periodName = monthToDateActive ? 'Month to date' : start ? 'Selected period' : week ? 'Previous week' : 'This week'

  const { data: rows } = await supabase.rpc('get_driver_payroll_summary_range', { p_period_start: weekStartStr, p_period_end: weekEndStr })

  const weekTotalCents = (rows ?? []).reduce((sum: number, r: { week_earnings_cents: number }) => sum + r.week_earnings_cents, 0)
  const monthTotalCents = (rows ?? []).reduce((sum: number, r: { month_earnings_cents: number }) => sum + r.month_earnings_cents, 0)

  // Detail behind each driver's job count: the completed jobs in the period
  // (same filter the summary uses), their approved expenses, the payouts and
  // the advances (draws). A job counts as paid when a payout recorded for that
  // driver covers its completion date.
  const periodEndExclusive = new Date(weekEnd)
  periodEndExclusive.setDate(periodEndExclusive.getDate() + 1)
  const periodEndExclusiveStr = periodEndExclusive.toISOString().slice(0, 10)

  type PeriodJob = {
    id: string
    driver_id: string | null
    completed_at: string | null
    final_driver_pay_cents: number | null
    estimated_driver_pay_cents: number | null
    performance_bonus_cents: number | null
    performance_bonus_override_cents: number | null
    performance_bonus_eligible: boolean | null
    customer_full_name: string | null
    pickup_address: string | null
    dropoff_address: string | null
    organizations: { name: string } | { name: string }[] | null
  }
  const { data: periodJobsRaw } = await supabase
    .from('jobs')
    .select('id, driver_id, completed_at, final_driver_pay_cents, estimated_driver_pay_cents, performance_bonus_cents, performance_bonus_override_cents, performance_bonus_eligible, customer_full_name, pickup_address, dropoff_address, organizations(name)')
    .eq('status', 'completed')
    .is('archived_at', null)
    .gte('completed_at', weekStartStr)
    .lt('completed_at', periodEndExclusiveStr)
    .order('completed_at', { ascending: true })
  const periodJobs = (periodJobsRaw ?? []) as unknown as PeriodJob[]
  const periodJobIds = periodJobs.map((j) => j.id)

  const { data: periodExpenses } = periodJobIds.length > 0
    ? await supabase
        .from('job_expenses')
        .select('job_id, submitted_by, amount_cents, reimbursement_paid_at')
        .in('job_id', periodJobIds)
        .eq('status', 'approved')
    : { data: [] as { job_id: string; submitted_by: string | null; amount_cents: number; reimbursement_paid_at: string | null }[] }

  const { data: payouts } = await supabase
    .from('driver_payouts')
    .select('driver_id, period_start, period_end, paid_at')
    .lte('period_start', weekEndStr)
    .gte('period_end', weekStartStr)

  const { data: drawRows } = await supabase
    .from('driver_draws')
    .select('id, driver_id, amount_cents, note, created_at, settled_at')
    .or(`settled_at.is.null,and(created_at.gte.${weekStartStr},created_at.lt.${periodEndExclusiveStr})`)
    .order('created_at', { ascending: true })

  const jobRowsByDriver = new Map<string, PayrollJobRow[]>()
  for (const j of periodJobs) {
    if (!j.driver_id) continue
    const dateStr = (j.completed_at ?? '').slice(0, 10)
    const payout = (payouts ?? []).find((p) => p.driver_id === j.driver_id && p.period_start <= dateStr && dateStr <= p.period_end)
    const jobExpenses = (periodExpenses ?? []).filter((e) => e.job_id === j.id && e.submitted_by === j.driver_id)
    const expensesCents = jobExpenses.reduce((sum, e) => sum + e.amount_cents, 0)
    const unpaidExpensesCents = jobExpenses.filter((e) => !e.reimbursement_paid_at).reduce((sum, e) => sum + e.amount_cents, 0)
    const basePayCents = j.final_driver_pay_cents ?? j.estimated_driver_pay_cents ?? 0
    const bonusCents = j.performance_bonus_override_cents ?? (j.performance_bonus_eligible ? (j.performance_bonus_cents ?? 0) : 0)
    const org = Array.isArray(j.organizations) ? j.organizations[0] : j.organizations
    const row: PayrollJobRow = {
      id: j.id,
      completedAt: j.completed_at,
      dealer: org?.name ?? 'Unknown dealer',
      customer: j.customer_full_name || '-',
      pickup: j.pickup_address ?? '',
      dropoff: j.dropoff_address ?? '',
      basePayCents,
      bonusCents,
      expensesCents,
      unpaidExpensesCents,
      paid: !!payout && unpaidExpensesCents === 0,
      paidAt: payout?.paid_at ?? null,
      outstandingCents: (payout ? 0 : basePayCents + bonusCents) + unpaidExpensesCents,
    }
    const list = jobRowsByDriver.get(j.driver_id) ?? []
    list.push(row)
    jobRowsByDriver.set(j.driver_id, list)
  }

  const drawsByDriver = new Map<string, PayrollDrawRow[]>()
  for (const d of drawRows ?? []) {
    const list = drawsByDriver.get(d.driver_id) ?? []
    list.push({ id: d.id, amountCents: d.amount_cents, note: d.note, createdAt: d.created_at, settled: !!d.settled_at })
    drawsByDriver.set(d.driver_id, list)
  }

  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const { data: ytdJobs } = await supabase
    .from('jobs')
    .select('final_driver_pay_cents, estimated_driver_pay_cents')
    .eq('status', 'completed')
    .is('archived_at', null)
    .gte('completed_at', yearStart)
  const yearTotalCents = (ytdJobs ?? []).reduce((sum, j) => sum + (j.final_driver_pay_cents ?? j.estimated_driver_pay_cents ?? 0), 0)

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Logo height={22} />
          <div className="flex items-center gap-3">
            <SettingsGearLink href="/admin/settings" />
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-5xl mx-auto">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back to admin
          </Link>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400">{periodName === 'This week' ? 'This week\u2019s payroll' : `${periodName} payroll`}</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatCents(weekTotalCents)}</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400">Month-to-date</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatCents(monthTotalCents)}</p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400">Year-to-date</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatCents(yearTotalCents)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Payroll</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Period: {weekStart.toLocaleDateString('en-CA', { dateStyle: 'medium' })} – {weekEnd.toLocaleDateString('en-CA', { dateStyle: 'medium' })}
              {!start && <span className="text-gray-400"> (pays out the following Monday)</span>}
            </p>
          </div>
          <DateRangeFilter
            baseHref="/admin/payroll"
            isCustomActive={!!start && !monthToDateActive}
            customStart={start}
            customEnd={end}
            activeLabel={monthToDateActive ? 'Month to date' : start ? `${weekStart.toLocaleDateString('en-CA', { dateStyle: 'medium' })} – ${weekEnd.toLocaleDateString('en-CA', { dateStyle: 'medium' })}` : (week ? 'Previous week' : 'This week')}
            presets={[
              { label: 'This week', href: '/admin/payroll', isCurrent: !week && !start },
              { label: 'Previous week', href: `/admin/payroll?week=${prevWeek.toISOString().slice(0, 10)}`, isCurrent: !!week && !start },
              { label: 'Month to date', href: `/admin/payroll?start=${monthStartStr}&end=${todayStr}`, isCurrent: monthToDateActive },
            ]}
          />
        </div>

        <div className="space-y-3">
          {rows?.map((r: {
            driver_id: string
            driver_name: string | null
            driver_code: string | null
            week_earnings_cents: number
            week_job_count: number
            pending_job_count: number
            pending_amount_cents: number
            outstanding_reimbursements_cents: number
            unsettled_draws_cents: number
            net_owed_cents: number
            month_earnings_cents: number
          }) => (
            <div key={r.driver_id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{r.driver_name || 'Unnamed driver'}</p>
                    <span className="text-xs text-gray-500">
                      Month earnings: <span className="text-gray-900 font-medium">{formatCents(r.month_earnings_cents)}</span>
                    </span>
                  </div>
                  {r.driver_code && <p className="text-xs text-gray-400 font-mono">{r.driver_code}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <AddDrawButton driverId={r.driver_id} driverName={r.driver_name} />
                  <MarkPaidButton
                    driverId={r.driver_id}
                    driverName={r.driver_name}
                    periodStart={weekStartStr}
                    periodEnd={weekEnd.toISOString().slice(0, 10)}
                    earningsCents={r.week_earnings_cents}
                    reimbursementsCents={r.outstanding_reimbursements_cents}
                    drawsCents={r.unsettled_draws_cents}
                    netOwedCents={r.net_owed_cents}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mt-3 pt-3 border-t border-gray-100">
                <DriverPayrollJobs
                  label={`Jobs ${periodUnit}`}
                  jobs={jobRowsByDriver.get(r.driver_id) ?? []}
                  draws={drawsByDriver.get(r.driver_id) ?? []}
                  otherOutstandingReimbursementsCents={Math.max(
                    0,
                    r.outstanding_reimbursements_cents - (jobRowsByDriver.get(r.driver_id) ?? []).reduce((sum, j) => sum + j.unpaidExpensesCents, 0)
                  )}
                  netOwedCents={r.net_owed_cents}
                />
                <div>
                  <p className="text-gray-400">Earnings {periodUnit}</p>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">{formatCents(r.week_earnings_cents)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Outstanding reimbursements</p>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">{formatCents(r.outstanding_reimbursements_cents)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Advances</p>
                  <p className={`font-medium text-sm mt-0.5 ${r.unsettled_draws_cents > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {r.unsettled_draws_cents > 0 ? `−${formatCents(r.unsettled_draws_cents)}` : formatCents(0)}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-4 flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100">
                  <div>
                    {r.pending_job_count > 0 && (
                      <span className="text-amber-600">
                        {r.pending_job_count} job{r.pending_job_count === 1 ? '' : 's'} still in progress ({formatCents(r.pending_amount_cents)} pending) — not yet reflected in earnings
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span>
                      <span className="text-gray-400 mr-1.5">Net owed</span>
                      <span className="text-gray-900 font-semibold text-sm">{formatCents(r.net_owed_cents)}</span>
                    </span>
                    {r.pending_job_count > 0 && (
                      <span>
                        <span className="text-amber-600 mr-1.5">Total incl. pending</span>
                        <span className="text-amber-700 font-semibold text-sm">{formatCents(r.net_owed_cents + r.pending_amount_cents)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {(!rows || rows.length === 0) && (
            <p className="text-sm text-gray-400">No drivers found.</p>
          )}
        </div>
      </main>
    </div>
  )
}
