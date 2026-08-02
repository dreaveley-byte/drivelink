import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import ApplicationCard from '@/components/ApplicationCard'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'

export default async function AdminApplicationsPage() {
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

  const { data: driverApps } = await supabase
    .from('driver_applications')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: dealerApps } = await supabase
    .from('dealer_applications')
    .select('*, organizations(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Logo height={22} />
            <span className="text-sm text-gray-400">— Applications</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Review driver and dealer applications</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
          <Link href="/admin/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Pricing
          </Link>
          <Link href="/admin/drivers" className="text-sm text-gray-600 hover:text-gray-900">
            Drivers
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        <div>
          <h2 className="text-base font-medium text-gray-900 mb-4">Driver Applications</h2>
          <div className="space-y-3">
            {driverApps?.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">No driver applications yet.</p>
            )}
            {driverApps?.map((app) => (
              <ApplicationCard
                key={app.id}
                table="driver_applications"
                id={app.id}
                title={app.full_name || 'Unnamed applicant'}
                subtitle={`${app.email ?? ''} · ${app.cell_phone ?? ''}`}
                status={app.status}
                bucket="driver-documents"
                userId={app.user_id}
                profilePhotoPath={app.profile_photo_path}
                docs={[
                  { label: 'Profile photo', path: app.profile_photo_path },
                  { label: "Driver's license", path: app.drivers_license_path },
                  { label: "Driver's abstract", path: app.drivers_abstract_path },
                  { label: 'Background check', path: app.criminal_background_check_path },
                  { label: 'VSA license', path: app.vsa_license_path },
                  { label: 'Medical fitness', path: app.medical_fitness_path },
                  { label: 'Drug & alcohol test', path: app.drug_alcohol_test_path },
                  { label: 'Optical test', path: app.optical_test_path },
                  { label: 'Void cheque', path: app.void_cheque_path },
                  { label: 'Signed contract', path: app.contract_signature_path },
                ]}
              />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-base font-medium text-gray-900 mb-4">Dealer Applications</h2>
          <div className="space-y-3">
            {dealerApps?.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">No dealer applications yet.</p>
            )}
            {dealerApps?.map((app) => (
              <ApplicationCard
                key={app.id}
                table="dealer_applications"
                id={app.id}
                title={app.business_name || 'Unnamed business'}
                subtitle={`${app.contact_full_name ?? ''} · ${app.contact_position ?? ''}`}
                status={app.status}
                bucket="dealer-documents"
                docs={[
                  { label: 'Pre-authorized debit form', path: app.pre_authorized_debit_form_path },
                  { label: 'Signed contract', path: app.contract_signature_path },
                ]}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
