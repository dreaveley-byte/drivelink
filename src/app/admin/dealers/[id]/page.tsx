import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import ApplicationCard from '@/components/ApplicationCard'
import DealerApplicationEditForm from '@/components/DealerApplicationEditForm'
import CollapsibleSection from '@/components/CollapsibleSection'
import ResetPasswordButton from '@/components/ResetPasswordButton'
import RemoveTeamMemberButton from '@/components/RemoveTeamMemberButton'
import PendingInvitesList from '@/components/PendingInvitesList'
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

export default async function AdminDealerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: dealerId } = await params
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

  const { data: dealer } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', dealerId)
    .single()

  if (!dealer) notFound()

  const { data: members } = await supabase
    .from('profiles')
    .select('*')
    .eq('organization_id', dealerId)
    .in('role', ['org_admin', 'org_member'])
    .order('full_name')

  const { data: pendingInvites } = await supabase
    .from('org_invites')
    .select('id, invitee_name, invitee_phone, created_at')
    .eq('organization_id', dealerId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  const { data: application } = await supabase
    .from('dealer_applications')
    .select('*')
    .eq('organization_id', dealerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: statsJobs } = await supabase
    .from('jobs')
    .select('status, created_at, updated_at, estimated_dealer_cost_cents, customer_rating')
    .eq('organization_id', dealerId)

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  let requestedThisMonth = 0
  let completedThisMonth = 0
  let spentThisMonth = 0
  let totalCompleted = 0
  let ratingSum = 0
  let ratingCount = 0

  for (const job of statsJobs ?? []) {
    if (job.created_at && new Date(job.created_at) >= monthStart) requestedThisMonth += 1
    if (job.status === 'completed') {
      totalCompleted += 1
      if (job.customer_rating != null) {
        ratingSum += job.customer_rating
        ratingCount += 1
      }
      if (job.updated_at && new Date(job.updated_at) >= monthStart) {
        completedThisMonth += 1
        spentThisMonth += job.estimated_dealer_cost_cents ?? 0
      }
    }
  }
  const avgCustomerRating = ratingCount > 0 ? ratingSum / ratingCount : null

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status, scheduled_for, pickup_address, dropoff_address, estimated_dealer_cost_cents, driver:driver_id(full_name)')
    .eq('organization_id', dealerId)
    .order('scheduled_for', { ascending: false, nullsFirst: false })
    .limit(25)

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin"><Logo height={22} /></Link>
            <span className="text-sm text-gray-400">— Dealer</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Dealer profile</p>
        </div>
        <div className="flex items-center gap-4">
          <SignOutButton />
          <SettingsGearLink href="/admin/account" />
        </div>
      </header>

      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-4 flex-wrap">
          <Link href="/admin/dealers" className="text-sm text-gray-600 hover:text-gray-900">
            Dealers
          </Link>
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div>
          <Link href="/admin/dealers" className="text-xs text-gray-400 hover:text-gray-600">
            ← Back to dealers
          </Link>
        </div>

        <div>
          <h1 className="text-lg font-semibold text-gray-900">{dealer.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{dealer.address || 'No address on file'}</p>
          {dealer.phone && <p className="text-sm text-gray-500">{dealer.phone}</p>}
          <p className="text-xs text-gray-400 mt-1">Member since {fmtDate(dealer.created_at)}</p>
        </div>

        <div className="border-t border-gray-100 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-gray-400">Requested this month</p>
            <p className="text-gray-900 font-medium text-sm mt-0.5">{requestedThisMonth}</p>
          </div>
          <div>
            <p className="text-gray-400">Completed this month</p>
            <p className="text-gray-900 font-medium text-sm mt-0.5">{completedThisMonth}</p>
          </div>
          <div>
            <p className="text-gray-400">Spent this month</p>
            <p className="text-gray-900 font-medium text-sm mt-0.5">{formatCents(spentThisMonth)}</p>
          </div>
          <div>
            <p className="text-gray-400">Avg. customer rating</p>
            <p className="text-gray-900 font-medium text-sm mt-0.5">
              {avgCustomerRating != null ? `${avgCustomerRating.toFixed(1)} / 5` : '—'}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <p className="text-gray-400">{totalCompleted} completed job{totalCompleted === 1 ? '' : 's'} all-time</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Company Info</p>
          <div className="border border-gray-200 rounded-xl px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Business name</p>
              <p className="text-gray-900">{application?.business_name || dealer.name || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Business address</p>
              <p className="text-gray-900">{application?.business_address || dealer.address || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Store phone</p>
              <p className="text-gray-900">{application?.store_phone || dealer.phone || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Dealer number</p>
              <p className="text-gray-900">{application?.dealer_number || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">PST number</p>
              <p className="text-gray-900">{application?.pst_number || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">GST number</p>
              <p className="text-gray-900">{application?.gst_number || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Contact name</p>
              <p className="text-gray-900">{application?.contact_full_name || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Contact position</p>
              <p className="text-gray-900">{application?.contact_position || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Contact cell phone</p>
              <p className="text-gray-900">{application?.contact_cell_phone || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Payment method</p>
              <p className="text-gray-900 capitalize">{application?.payment_method?.replace(/_/g, ' ') || '—'}</p>
            </div>
          </div>
        </div>

        {pendingInvites && pendingInvites.length > 0 && (
          <PendingInvitesList invites={pendingInvites} />
        )}

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Team Members</p>
          <div className="space-y-2">
            {(!members || members.length === 0) && (
              <p className="text-sm text-gray-400 py-4 text-center">No team members yet.</p>
            )}
            {members?.map((m) => (
              <div key={m.id} className="border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.phone || 'No phone on file'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1 whitespace-nowrap">
                    {m.role === 'org_admin' ? 'Admin' : 'Member'}
                  </span>
                  <ResetPasswordButton email={m.email} />
                  <RemoveTeamMemberButton memberId={m.id} memberName={m.full_name || 'this person'} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <CollapsibleSection
            title="Application & Documents"
            subtitle={
              application?.contract_signed_at ? (
                <Link
                  href={`/admin/dealers/${dealer.id}/agreement`}
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
                table="dealer_applications"
                id={application.id}
                title={application.business_name || dealer.name}
                subtitle={`${application.contact_full_name ?? ''} · ${application.contact_position ?? ''}`}
                status={application.status}
                bucket="dealer-documents"
                dealerSubmittedBy={application.submitted_by}
                dealerOrganizationId={application.organization_id}
                dealerBusinessName={application.business_name}
                docs={[
                  { label: 'Pre-authorized debit form', path: application.pre_authorized_debit_form_path },
                  { label: 'Signed contract', path: application.contract_signature_path },
                ]}
              />
            ) : (
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-4">
                  No application on file for this dealer yet — you can fill it in here on their behalf.
                </p>
                <DealerApplicationEditForm
                  userId={members && members.length > 0 ? members[0].id : user.id}
                  organizationId={dealer.id}
                  application={null}
                />
              </div>
            )}
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
                      {(job.driver as unknown as { full_name: string } | null)?.full_name ?? 'Unassigned'}
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
                    {job.estimated_dealer_cost_cents != null && (
                      <span className="text-xs text-gray-500">{formatCents(job.estimated_dealer_cost_cents)}</span>
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
