import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DriverFeedbackForm from '@/components/DriverFeedbackForm'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'

export default async function DriverPublicProfilePage({ params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params
  const supabase = await createClient()

  const { data: profileRows } = await supabase.rpc('get_driver_public_profile', { p_driver_id: driverId })
  const profile = profileRows?.[0]
  if (!profile) notFound()

  const { data: ratingRows } = await supabase.rpc('get_driver_public_rating', { p_driver_id: driverId })
  const rating = ratingRows?.[0]

  const { data: feedback } = await supabase
    .from('driver_public_feedback')
    .select('type, message, submitter_name, created_at')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <Logo height={22} />
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-4">
          {profile.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.photo_url} alt="" className="w-16 h-16 rounded-full object-cover border border-gray-200" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">
              {profile.full_name?.[0] ?? '?'}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-gray-900">{profile.full_name ?? 'Driver'}</p>
            <span className={`text-xs border rounded-full px-2.5 py-0.5 ${profile.is_active ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-300 text-gray-500 bg-gray-50'}`}>
              {profile.is_active ? 'Active Drivflo driver' : 'Not currently active'}
            </span>
          </div>
        </div>

        {rating?.rating_count > 0 && (
          <div className="flex items-center gap-1.5 mb-6 text-sm">
            <span className="text-amber-500">\u2605</span>
            <span className="font-medium text-gray-900">{rating.avg_rating}</span>
            <span className="text-gray-400">({rating.rating_count} rating{rating.rating_count === 1 ? '' : 's'})</span>
          </div>
        )}

        <DriverFeedbackForm driverId={driverId} />

        {feedback && feedback.length > 0 && (
          <div className="mt-8">
            <p className="text-sm font-medium text-gray-900 mb-3">Recent feedback</p>
            <div className="space-y-3">
              {feedback.map((f, i) => (
                <div key={i} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${f.type === 'praise' ? 'text-green-700' : 'text-red-600'}`}>
                      {f.type === 'praise' ? '\ud83d\udc4d Praise' : '\u26a0\ufe0f Complaint'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(f.created_at).toLocaleDateString('en-CA', { dateStyle: 'medium' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{f.message}</p>
                  {f.submitter_name && <p className="text-xs text-gray-400 mt-0.5">\u2014 {f.submitter_name}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
