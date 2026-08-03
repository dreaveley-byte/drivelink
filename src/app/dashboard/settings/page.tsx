import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import ProfileSettingsForm from '@/components/ProfileSettingsForm'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'

export default async function DealerSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .single()

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
        <ProfileSettingsForm
          userId={user.id}
          initialFullName={profile?.full_name ?? ''}
          initialPhone={profile?.phone ?? ''}
          initialSmsOptIn={false}
          showSmsToggle={false}
        />
      </main>
    </div>
  )
}
