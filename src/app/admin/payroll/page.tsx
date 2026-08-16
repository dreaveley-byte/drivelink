import { redirect } from 'next/navigation'
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

export default async function AdminPayrollPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'platform_admin') redirect('/dashboard')

  const weekStart = week ? new Date(week + 'T00:00:00') : mostRecentMonday()
  const weekStartStr = weekStart.toISOString().slice(0, 10)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const prevWeek = new Date(weekStart)
  prevWeek.setDate(prevWeek.getDate() - 7)
  const nextWeek = new Date(weekStart)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const { data: rows } = await supabase.rpc('get_driver_payroll_summary', { p_week_start: weekStartStr })

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

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Payroll</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Week of {weekStart.toLocaleDateString('en-CA', { dateStyle: 'medium' })} \u2013 {weekEnd.toLocaleDateString('en-CA', { dateStyle: 'medium' })}
              {' '}<span className="text-gray-400">(pays out the following Monday)</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/admin/payroll?week=${prevWeek.toISOString().slice(0, 10)}`} className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5">
              \u2190 Prev week
            </a>
            <a href="/admin/payroll" className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5">
              This week
            </a>
            <a href={`/admin/payroll?week=${nextWeek.toISOString().slice(0, 10)}`} className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5">
              Next week \u2192
            </a>
          </div>
        </div>

        <div className="space-y-3">
          {rows?.map((r: {
            driver_id: string
            driver_name: string | null
            driver_code: string | null
            week_earnings_cents: number
            outstanding_reimbursements_cents: number
            unsettled_draws_cents: number
            net_owed_cents: number
            month_earnings_cents: number
          }) => (
            <div key={r.driver_id} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.driver_name || 'Unnamed driver'}</p>
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs mt-3 pt-3 border-t border-gray-100">
                <div>
                  <p className="text-gray-400">Week earnings</p>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">{formatCents(r.week_earnings_cents)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Outstanding reimbursements</p>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">{formatCents(r.outstanding_reimbursements_cents)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Unsettled draws</p>
                  <p className={`font-medium text-sm mt-0.5 ${r.unsettled_draws_cents > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {r.unsettled_draws_cents > 0 ? `\u2212${formatCents(r.unsettled_draws_cents)}` : formatCents(0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Net owed</p>
                  <p className="text-gray-900 font-semibold text-sm mt-0.5">{formatCents(r.net_owed_cents)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Month earnings (excl. reimb.)</p>
                  <p className="text-gray-900 font-medium text-sm mt-0.5">{formatCents(r.month_earnings_cents)}</p>
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
