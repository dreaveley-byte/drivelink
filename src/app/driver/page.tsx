import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import DriverJobActions from './DriverJobActions'

export default async function DriverPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'driver') {
    redirect('/dashboard')
  }

  const { data: myJob } = await supabase
    .from('jobs')
    .select('*, job_types(name)')
    .eq('driver_id', user.id)
    .not('status', 'in', '("completed","cancelled")')
    .maybeSingle()

  const { data: openJobs } = await supabase
    .from('jobs')
    .select('*, job_types(name)')
    .eq('status', 'awaiting_driver')
    .order('created_at', { ascending: true })

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">DriveLink — Driver</h1>
        <SignOutButton />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {myJob && (
          <div>
            <h2 className="text-sm font-medium text-gray-500 mb-2">Your active job</h2>
            <DriverJobActions job={myJob} isActive />
          </div>
        )}

        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-2">Available jobs</h2>
          <div className="space-y-3">
            {openJobs?.length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">No open jobs right now.</p>
            )}
            {openJobs?.map((job) => (
              <DriverJobActions key={job.id} job={job} isActive={false} disabled={!!myJob} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
