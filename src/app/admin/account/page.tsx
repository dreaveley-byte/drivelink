import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import ProfileSettingsForm from '@/components/ProfileSettingsForm'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'

export default async function AdminAccountPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, phone')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'platform_admin') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/admin"><Logo height={22} /></Link>
          <span className="text-sm text-gray-400">— My Account</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Back to dashboard
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        <ProfileSettingsForm
          userId={user.id}
          initialFullName={profile?.full_name ?? ''}
          initialPhone={profile?.phone ?? ''}
          initialEmail={user.email ?? ''}
          initialSmsOptIn={false}
          showSmsToggle={false}
        />
      </main>
    </div>
  )
}
