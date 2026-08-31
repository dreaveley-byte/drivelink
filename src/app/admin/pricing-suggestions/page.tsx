import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import Logo from '@/components/Logo'
import PricingSuggestionActions from '@/components/PricingSuggestionActions'
import { formatCents } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const FIELD_LABELS: Record<string, string> = {
  hourly_rate_cents: 'Driver hourly rate',
  simple_job_hourly_rate_cents: 'Simple job hourly rate',
}

export default async function PricingSuggestionsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'platform_admin') redirect('/dashboard')

  const { data: pending } = await supabase
    .from('pricing_suggestions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const { data: history } = await supabase
    .from('pricing_suggestions')
    .select('*, reviewer:reviewed_by(full_name)')
    .neq('status', 'pending')
    .order('reviewed_at', { ascending: false })
    .limit(20)

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/admin"><Logo height={22} /></Link>
          <span className="text-sm text-gray-400">— Pricing Suggestions</span>
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
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">Pricing Suggestions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Automatically generated after a job completes, when several recent similar jobs show a consistent pattern of actual hours running over or under booked hours. Never applied without your approval.
          </p>
        </div>

        {(!pending || pending.length === 0) && (
          <p className="text-sm text-gray-400 py-8 text-center">No pending suggestions right now.</p>
        )}

        <div className="space-y-3 mb-8">
          {pending?.map((s) => (
            <div key={s.id} className="border border-amber-300 bg-amber-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">{s.title}</p>
              <p className="text-sm text-gray-700 mb-3">{s.analysis_summary}</p>
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span>{FIELD_LABELS[s.field_name] ?? s.field_name}</span>
                <span>{formatCents(s.current_value)} → {formatCents(s.suggested_value)}</span>
                <span>{s.similar_jobs_count} similar jobs</span>
                <span>{s.avg_variance_percent > 0 ? '+' : ''}{Math.round(s.avg_variance_percent)}% avg variance</span>
              </div>
              {s.triggering_job_id && (
                <Link href={`/dashboard/jobs/${s.triggering_job_id}/receipt`} className="text-xs text-[#378ADD] underline">
                  View the job that triggered this
                </Link>
              )}
              <div className="mt-3">
                <PricingSuggestionActions
                  suggestionId={s.id}
                  fieldName={s.field_name}
                  suggestedValue={s.suggested_value}
                />
              </div>
            </div>
          ))}
        </div>

        {history && history.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">History</h2>
            <div className="space-y-2">
              {history.map((s) => (
                <div key={s.id} className="border border-gray-200 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-gray-900 font-medium">{s.title}</p>
                    <span
                      className={`px-2 py-0.5 rounded-full border ${
                        s.status === 'applied'
                          ? 'border-green-300 text-green-700'
                          : 'border-gray-300 text-gray-500'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="text-gray-500">
                    {FIELD_LABELS[s.field_name] ?? s.field_name}: {formatCents(s.current_value)} → {formatCents(s.suggested_value)}
                    {s.reviewer?.full_name && ` · reviewed by ${s.reviewer.full_name}`}
                    {s.reviewed_at && ` · ${new Date(s.reviewed_at).toLocaleDateString('en-CA', { dateStyle: 'medium' })}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
