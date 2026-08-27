import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import Logo from '@/components/Logo'
import { formatCents } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—'
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

export default async function DealerDrivesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ start?: string; end?: string }>
}) {
  const { id: dealerId } = await params
  const { start, end } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'platform_admin') redirect('/dashboard')

  const { data: dealer } = await supabase.from('organizations').select('*').eq('id', dealerId).single()
  if (!dealer) notFound()

  const periodStart = start ?? (() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })()
  const periodEnd = end ?? new Date().toISOString().slice(0, 10)

  const { data: drives } = await supabase.rpc('get_dealer_drive_details', {
    p_organization_id: dealerId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  })

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/admin"><Logo height={22} /></Link>
          <span className="text-sm text-gray-400">— {dealer.name} · Drives</span>
        </div>
        <div className="flex items-center gap-4">
          <SignOutButton />
          <SettingsGearLink href="/admin/account" />
        </div>
      </header>

      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-4 flex-wrap">
          <Link href="/admin/dealers" className="text-sm text-gray-600 hover:text-gray-900">
            ← Dealers
          </Link>
          <Link href={`/admin/dealers/${dealerId}`} className="text-sm text-gray-600 hover:text-gray-900">
            Manage {dealer.name}
          </Link>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">Completed drives</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(periodStart + 'T00:00:00').toLocaleDateString('en-CA', { dateStyle: 'medium' })} – {new Date(periodEnd + 'T00:00:00').toLocaleDateString('en-CA', { dateStyle: 'medium' })}
            {' · '}{drives?.length ?? 0} drive{(drives?.length ?? 0) === 1 ? '' : 's'}
          </p>
        </div>

        {(!drives || drives.length === 0) && (
          <p className="text-sm text-gray-400 py-8 text-center">No completed drives in this period.</p>
        )}

        <div className="space-y-3">
          {drives?.map((drive: {
            job_id: string
            driver_name: string | null
            scheduled_for: string | null
            booked_minutes: number | null
            assigned_at: string | null
            completed_at: string | null
            total_cost_cents: number
            total_charged_cents: number
            profit_cents: number
          }) => {
            const actualMinutes =
              drive.assigned_at && drive.completed_at
                ? Math.round((new Date(drive.completed_at).getTime() - new Date(drive.assigned_at).getTime()) / 60000)
                : null
            return (
              <Link
                key={drive.job_id}
                href={`/dashboard/jobs/${drive.job_id}/receipt`}
                className="block border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">{drive.driver_name || 'Unassigned'}</p>
                  <p className="text-xs text-gray-400">
                    {drive.scheduled_for ? new Date(drive.scheduled_for).toLocaleDateString('en-CA', { dateStyle: 'medium' }) : '—'}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div>
                    <p className="text-gray-400">Booked time</p>
                    <p className="text-gray-900 font-medium mt-0.5">{formatDuration(drive.booked_minutes)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Actual time (round trip)</p>
                    <p className="text-gray-900 font-medium mt-0.5">{formatDuration(actualMinutes)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Total cost</p>
                    <p className="text-gray-900 font-medium mt-0.5">{formatCents(drive.total_cost_cents)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Total charged</p>
                    <p className="text-gray-900 font-medium mt-0.5">{formatCents(drive.total_charged_cents)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Profit</p>
                    <p className={`font-medium mt-0.5 ${drive.profit_cents >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {formatCents(drive.profit_cents)}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
