import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import TeamInviteGenerator from '@/components/TeamInviteGenerator'
import RemoveTeamMemberButton from '@/components/RemoveTeamMemberButton'
import PendingInvitesList from '@/components/PendingInvitesList'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'

export default async function DealerTeamPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')

  const { data: members } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role')
    .eq('organization_id', profile.organization_id)
    .in('role', ['org_admin', 'org_member'])
    .order('full_name')

  const { data: pendingInvites } = profile.role === 'org_admin'
    ? await supabase
        .from('org_invites')
        .select('id, invitee_name, invitee_phone, created_at')
        .eq('organization_id', profile.organization_id)
        .is('accepted_at', null)
        .order('created_at', { ascending: false })
    : { data: null }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/dashboard"><Logo height={22} /></Link>
          <span className="text-sm text-gray-400">— Team</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            Back to dashboard
          </Link>
          <SignOutButton />
          <SettingsGearLink href="/dashboard/settings" />
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Your team</h1>
          <p className="text-sm text-gray-500">
            Other people at your dealership — like whoever schedules deliveries — can have their own login under
            your account.
          </p>
        </div>

        {profile.role === 'org_admin' ? (
          <TeamInviteGenerator organizationId={profile.organization_id} userId={user.id} />
        ) : (
          <p className="text-xs text-gray-400">Only dealership admins can invite new team members.</p>
        )}

        {pendingInvites && pendingInvites.length > 0 && (
          <PendingInvitesList invites={pendingInvites} />
        )}

        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Team Members</p>
          <div className="space-y-2">
            {(!members || members.length === 0) && (
              <p className="text-sm text-gray-400 py-4 text-center">Just you so far.</p>
            )}
            {members?.map((m) => (
              <div key={m.id} className="border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.phone || 'No phone on file'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1 whitespace-nowrap">
                    {m.role === 'org_admin' ? 'Admin' : 'Member'}
                  </span>
                  {profile.role === 'org_admin' && m.id !== user.id && (
                    <RemoveTeamMemberButton memberId={m.id} memberName={m.full_name || 'this person'} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
