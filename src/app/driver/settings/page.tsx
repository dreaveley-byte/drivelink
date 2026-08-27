import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import ProfileSettingsForm from '@/components/ProfileSettingsForm'
import DriverApplicationEditForm from '@/components/DriverApplicationEditForm'
import ComplianceDocumentsSection from '@/components/ComplianceDocumentsSection'
import SettingsTabs from '@/components/SettingsTabs'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'

export default async function DriverSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      full_name, phone, photo_url, sms_notifications_opt_in, gender,
      driver_abstract_path, driver_abstract_uploaded_at, driver_abstract_reviewed_at,
      drug_alcohol_test_path, drug_alcohol_test_uploaded_at, drug_alcohol_test_reviewed_at,
      medical_fitness_test_path, medical_fitness_test_uploaded_at, medical_fitness_test_reviewed_at,
      vulnerable_sector_check_path, vulnerable_sector_check_uploaded_at, vulnerable_sector_check_reviewed_at
    `)
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
          compliance={
            <ComplianceDocumentsSection
              userId={user.id}
              documents={{
                driver_abstract: {
                  path: profile?.driver_abstract_path ?? null,
                  uploadedAt: profile?.driver_abstract_uploaded_at ?? null,
                  reviewedAt: profile?.driver_abstract_reviewed_at ?? null,
                },
                drug_alcohol_test: {
                  path: profile?.drug_alcohol_test_path ?? null,
                  uploadedAt: profile?.drug_alcohol_test_uploaded_at ?? null,
                  reviewedAt: profile?.drug_alcohol_test_reviewed_at ?? null,
                },
                medical_fitness_test: {
                  path: profile?.medical_fitness_test_path ?? null,
                  uploadedAt: profile?.medical_fitness_test_uploaded_at ?? null,
                  reviewedAt: profile?.medical_fitness_test_reviewed_at ?? null,
                },
                vulnerable_sector_check: {
                  path: profile?.vulnerable_sector_check_path ?? null,
                  uploadedAt: profile?.vulnerable_sector_check_uploaded_at ?? null,
                  reviewedAt: profile?.vulnerable_sector_check_reviewed_at ?? null,
                },
              }}
            />
          }
        />
      </main>
    </div>
  )
}
