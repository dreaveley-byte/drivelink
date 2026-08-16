import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import ProfileSettingsForm from '@/components/ProfileSettingsForm'
import DriverApplicationEditForm from '@/components/DriverApplicationEditForm'
import SettingsTabs from '@/components/SettingsTabs'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'

export default async function DriverSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, photo_url, sms_notifications_opt_in, gender')
    .eq('id', user.id)
    .single()

  const { data: application } = await supabase
    .from('driver_applications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/driver"><Logo height={22} /></Link>
          <span className="text-sm text-gray-400">— Settings</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/driver" className="text-sm text-gray-600 hover:text-gray-900">
            Back to dashboard
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        <SettingsTabs
          profile={
            <ProfileSettingsForm
              userId={user.id}
              initialFullName={profile?.full_name ?? ''}
              initialPhone={profile?.phone ?? ''}
              initialEmail={user.email ?? ''}
              initialSmsOptIn={profile?.sms_notifications_opt_in ?? true}
              initialGender={profile?.gender}
              showSmsToggle
              photoTarget={{
                kind: 'driver',
                currentUrl: profile?.photo_url ?? null,
                bucket: 'driver-photos',
                folder: user.id,
                label: 'Profile photo — shown to dealers and customers',
              }}
            />
          }
          application={
            <DriverApplicationEditForm userId={user.id} userEmail={user.email ?? ''} application={application ?? null} />
          }
        />
      </main>
    </div>
  )
}
