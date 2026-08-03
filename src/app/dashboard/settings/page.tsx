import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import ProfileSettingsForm from '@/components/ProfileSettingsForm'
import DealerApplicationEditForm from '@/components/DealerApplicationEditForm'
import SettingsTabs from '@/components/SettingsTabs'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'

export default async function DealerSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, organization_id, role')
    .eq('id', user.id)
    .single()

  const isOrgAdmin = profile?.role === 'org_admin'

  let logoUrl: string | null = null
  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('logo_url')
      .eq('id', profile.organization_id)
      .single()
    logoUrl = org?.logo_url ?? null
  }

  const { data: application } = await supabase
    .from('dealer_applications')
    .select('*')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/dashboard"><Logo height={22} /></Link>
          <span className="text-sm text-gray-400">— Settings</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            Back to dashboard
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        {isOrgAdmin ? (
          <SettingsTabs
            profile={
              <ProfileSettingsForm
                userId={user.id}
                initialFullName={profile?.full_name ?? ''}
                initialPhone={profile?.phone ?? ''}
                initialEmail={user.email ?? ''}
                initialSmsOptIn={false}
                showSmsToggle={false}
                photoTarget={{
                  kind: 'dealer',
                  currentUrl: logoUrl,
                  bucket: 'dealer-logos',
                  folder: user.id,
                  label: 'Business logo or photo — shown to drivers, admin, and customers',
                }}
              />
            }
            application={
              <DealerApplicationEditForm userId={user.id} organizationId={profile?.organization_id ?? null} application={application ?? null} />
            }
          />
        ) : (
          <ProfileSettingsForm
            userId={user.id}
            initialFullName={profile?.full_name ?? ''}
            initialPhone={profile?.phone ?? ''}
            initialEmail={user.email ?? ''}
            initialSmsOptIn={false}
            showSmsToggle={false}
          />
        )}
      </main>
    </div>
  )
}
