import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import Logo from '@/components/Logo'
import { formatCents } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const statusLabels: Record<string, string> = {
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { dateStyle: 'medium' })
}

export default async function DriverHistoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status, updated_at, pickup_address, dropoff_address, vehicle_year, vehicle_make, vehicle_model, stock_number, final_driver_pay_cents, estimated_driver_pay_cents, final_driver_reimbursement_cents, estimated_driver_reimbursement_cents, job_types(name), organizations(name)')
    .eq('driver_id', user.id)
    .in('status', ['completed', 'cancelled'])
    .order('updated_at', { ascending: false })

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/driver"><Logo height={22} /></Link>
          <span className="text-sm text-gray-400">— History</span>
        </div>
        <div className="flex items-center gap-4">
          <SignOutButton />
          <SettingsGearLink href="/driver/settings" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <Link href="/driver" className="text-sm text-gray-600 hover:text-gray-900 mb-6 inline-block">
          ← Back to dashboard
        </Link>

        <div className="space-y-3">
          {(!jobs || jobs.length === 0) && (
            <p className="text-sm text-gray-400 py-8 text-center">No completed jobs yet.</p>
          )}

          {jobs?.map((job) => {
            const org = Array.isArray(job.organizations) ? job.organizations[0] : job.organizations
            const jobType = Array.isArray(job.job_types) ? job.job_types[0] : job.job_types
            const payCents = job.final_driver_pay_cents ?? job.estimated_driver_pay_cents
            const reimbursementCents = job.final_driver_reimbursement_cents ?? job.estimated_driver_reimbursement_cents
            return (
              <Link
                key={job.id}
                href={`/dashboard/jobs/${job.id}/receipt`}
                target="_blank"
                className="block border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {jobType?.name}{org?.name ? ` · ${org.name}` : ''}
                    </p>
                    {(job.vehicle_year || job.vehicle_make || job.vehicle_model) && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')}
                        {job.stock_number && ` · Stock #${job.stock_number}`}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(job.updated_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1 whitespace-nowrap">
                      {statusLabels[job.status] ?? job.status}
                    </span>
                    {payCents != null && job.status === 'completed' && (
                      <span className="text-xs text-green-700 font-medium">
                        {formatCents(payCents)}
                        {!!reimbursementCents && <span className="text-gray-500 font-normal"> + {formatCents(reimbursementCents)}</span>}
                      </span>
                    )}
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
