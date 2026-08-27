import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import Logo from '@/components/Logo'
import DateRangeFilter from '@/components/DateRangeFilter'
import { formatCents } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

function firstOfMonth(monthsAgo: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo, 1)
  d.setHours(0, 0, 0, 0)
  return d
}

function lastOfMonth(monthsAgo: number): Date {
  const d = firstOfMonth(monthsAgo)
  d.setMonth(d.getMonth() + 1, 0)
  return d
}

export default async function AdminDealersPage({ searchParams }: { searchParams: Promise<{ month?: string; start?: string; end?: string }> }) {
  const { month, start, end } = await searchParams
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

  const monthsAgo = month ? parseInt(month, 10) : 0
  let periodStart: Date
  let periodEnd: Date
  if (start && end) {
    periodStart = new Date(start + 'T00:00:00')
    periodEnd = new Date(end + 'T00:00:00')
  } else {
    periodStart = firstOfMonth(monthsAgo)
    periodEnd = lastOfMonth(monthsAgo)
  }
  const periodStartStr = periodStart.toISOString().slice(0, 10)
  const periodEndStr = periodEnd.toISOString().slice(0, 10)

  const { data: dealers } = await supabase
    .from('organizations')
    .select('*')
    .order('name')

  const { data: summaries } = await supabase.rpc('get_dealer_summary_range', {
    p_period_start: periodStartStr,
    p_period_end: periodEndStr,
  })
  const summaryByOrg = new Map<string, { total_drives: number; total_revenue_cents: number; total_profit_cents: number; outstanding_debt_cents: number }>(
    (summaries ?? []).map((s: { organization_id: string; total_drives: number; total_revenue_cents: number; total_profit_cents: number; outstanding_debt_cents: number }) => [s.organization_id, s])
  )

  const drivesQueryParams = `?start=${periodStartStr}&end=${periodEndStr}`

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin"><Logo height={22} /></Link>
            <span className="text-sm text-gray-400">— Dealers</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">All dealer accounts</p>
        </div>
        <div className="flex items-center gap-4">
          <SignOutButton />
          <SettingsGearLink href="/admin/account" />
        </div>
      </header>

      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-4 flex-wrap">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
          <Link href="/admin/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </Link>
          <Link href="/admin/drivers" className="text-sm text-gray-600 hover:text-gray-900">
            Drivers
          </Link>
          <Link href="/admin/applications" className="text-sm text-gray-600 hover:text-gray-900">
            Applications
          </Link>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <p className="text-sm text-gray-500">
              Stats below for: {periodStart.toLocaleDateString('en-CA', { dateStyle: 'medium' })} – {periodEnd.toLocaleDateString('en-CA', { dateStyle: 'medium' })}
              <span className="text-gray-400"> (outstanding debt is always all-time)</span>
            </p>
          </div>
          <DateRangeFilter
            baseHref="/admin/dealers"
            isCustomActive={!!start}
            customStart={start}
            customEnd={end}
            activeLabel={start ? `${periodStart.toLocaleDateString('en-CA', { dateStyle: 'medium' })} – ${periodEnd.toLocaleDateString('en-CA', { dateStyle: 'medium' })}` : (monthsAgo === 0 ? 'This month' : monthsAgo === 1 ? 'Previous month' : `${monthsAgo} months ago`)}
            presets={[
              { label: 'This month', href: '/admin/dealers', isCurrent: !month && !start },
              { label: 'Previous month', href: '/admin/dealers?month=1', isCurrent: month === '1' && !start },
            ]}
          />
        </div>

        <div className="space-y-3">
          {dealers?.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No dealers yet.</p>
          )}
          {dealers?.map((dealer) => {
            const s = summaryByOrg.get(dealer.id)
            return (
              <div key={dealer.id} className="border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300">
                <div className="flex items-center justify-between">
                  <div>
                    <Link href={`/admin/dealers/${dealer.id}/drives${drivesQueryParams}`} className="text-sm font-medium text-gray-900 hover:text-[#378ADD] hover:underline">
                      {dealer.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">{dealer.address || 'No address on file'}</p>
                    {dealer.phone && <p className="text-xs text-gray-400 mt-0.5">{dealer.phone}</p>}
                  </div>
                  <Link href={`/admin/dealers/${dealer.id}`} className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap">
                    Manage →
                  </Link>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                  <div>
                    <p className="text-gray-400">Drives</p>
                    <p className="text-gray-900 font-medium mt-0.5">{s?.total_drives ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Total spend</p>
                    <p className="text-gray-900 font-medium mt-0.5">{formatCents(s?.total_revenue_cents ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Total profit</p>
                    <p className="text-gray-900 font-medium mt-0.5">{formatCents(s?.total_profit_cents ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Outstanding</p>
                    <p className={`font-medium mt-0.5 ${(s?.outstanding_debt_cents ?? 0) > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                      {formatCents(s?.outstanding_debt_cents ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
