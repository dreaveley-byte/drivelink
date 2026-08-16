import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import Logo from '@/components/Logo'
import MarkPaidButton from '@/components/MarkPaidButton'
import AddDrawButton from '@/components/AddDrawButton'
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

  const { data: rows } = await supabase.rpc('get_driver_payroll_summary_range', { p_period_start: weekStartStr, p_period_end: weekEndStr })

  const weekTotalCents = (rows ?? []).reduce((sum: number, r: { week_earnings_cents: number }) => sum + r.week_earnings_cents, 0)
  const monthTotalCents = (rows ?? []).reduce((sum: number, r: { month_earnings_cents: number }) => sum + r.month_earnings_cents, 0)

  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const { data: ytdJobs } = await supabase
    .from('jobs')
    .select('final_driver_pay_cents, estimated_driver_pay_cents')
    .eq('status', 'completed')
    .gte('updated_at', yearStart)
  const yearTotalCents = (ytdJobs ?? []).reduce((sum, j) => sum + (j.final_driver_pay_cents ?? j.estimated_driver_pay_cents ?? 0), 0)

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/admin"><Logo height={22} /></Link>
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
            <p className="text-xs text-gray-400">This week&apos;s payroll</p>
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
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`/admin/payroll?week=${prevWeek.toISOString().slice(0, 10)}`} className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5">
              ← Prev week
            </a>
            <a href="/admin/payroll" className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5">
              This week
            </a>
            <form action="/admin/payroll" method="get" className="flex items-center gap-1.5">
              <input type="date" name="start" defaultValue={start ?? ''} className="text-sm border border-gray-300 rounded-lg px-2 py-1.5" />
              <span className="text-gray-400 text-sm">to</span>
              <input type="date" name="end" defaultValue={end ?? ''} className="text-sm border border-gray-300 rounded-lg px-2 py-1.5" />
              <button type="submit" className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5">
                Custom
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-3">
          {rows?.map((r: {
            driver_id: string
            driver_name: string | null
            driver_code: string | null
            week_earnings_cents: number
            week_job_count: number
            pending_job_count: number
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
                <div>
                  <p className="text-gray-400">Jobs this week</p>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">{r.week_job_count}</p>
                </div>
                <div>
                  <p className="text-gray-400">Week earnings</p>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">{formatCents(r.week_earnings_cents)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Outstanding reimbursements</p>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">{formatCents(r.outstanding_reimbursements_cents)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Advances</p>
                  <p className={`font-medium text-sm mt-0.5 ${r.unsettled_draws_cents > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {r.unsettled_draws_cents > 0 ? `\u2212${formatCents(r.unsettled_draws_cents)}` : formatCents(0)}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-4 flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-gray-400">Net owed</span>
                  <span className="text-gray-900 font-semibold text-sm">{formatCents(r.net_owed_cents)}</span>
                </div>
              </div>
              {r.pending_job_count > 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  {r.pending_job_count} job{r.pending_job_count === 1 ? '' : 's'} still in progress \u2014 not yet reflected in earnings above
                </p>
              )}
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
