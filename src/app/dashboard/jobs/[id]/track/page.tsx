import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import TrackingPanel from '@/components/TrackingPanel'
import ChatPanel from '@/components/ChatPanel'
import CustomerSmsThread from '@/components/CustomerSmsThread'
import CollapsibleSection from '@/components/CollapsibleSection'
import CloseButton from '@/components/CloseButton'
import CopyLinkButton from '@/components/CopyLinkButton'
import Logo from '@/components/Logo'

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

export default async function TrackJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, status, pickup_address, dropoff_address, driver_lat, driver_lng, driver_location_updated_at, tracking_token, customer_phone, job_types(name), driver:driver_id(full_name, photo_url)')
    .eq('id', jobId)
    .single()

  if (jobError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Couldn&apos;t load this job</h1>
          <p className="text-sm text-red-600 mb-4">{jobError.message}</p>
          <p className="text-sm text-gray-500">
            This usually means a recent database migration hasn&apos;t been run yet in Supabase.
          </p>
        </div>
      </div>
    )
  }

  if (!job) notFound()

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const headersList = await headers()
  const host = headersList.get('host')
  const protocol = host?.includes('localhost') ? 'http' : 'https'
  const publicTrackingUrl = `${protocol}://${host}/track/${job.tracking_token}`

  const { data: checklist } = await supabase
    .from('job_checklist_items')
    .select('id, label, completed_at, file_paths, notes')
    .eq('job_id', jobId)
    .order('sort_order')

  const checklistWithUrls = await Promise.all(
    (checklist ?? []).map(async (item) => {
      const urls = await Promise.all(
        (item.file_paths ?? []).map(async (path: string) => {
          const { data } = await supabase.storage.from('job-media').createSignedUrl(path, 60 * 60)
          return data?.signedUrl ?? null
        })
      )
      return { ...item, urls: urls.filter(Boolean) as string[] }
    })
  )

  const driverName = Array.isArray(job.driver) ? job.driver[0]?.full_name : (job.driver as { full_name: string } | null)?.full_name
  const driverPhoto = Array.isArray(job.driver) ? job.driver[0]?.photo_url : (job.driver as { photo_url: string | null } | null)?.photo_url
  const jobTypeName = Array.isArray(job.job_types) ? job.job_types[0]?.name : (job.job_types as { name: string } | null)?.name

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="mb-1">
              <Logo height={18} />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">{jobTypeName}</h1>
          </div>
          <CloseButton />
        </div>

        <TrackingPanel
          jobId={job.id}
          pickupAddress={job.pickup_address}
          dropoffAddress={job.dropoff_address}
          initialDriverLat={job.driver_lat}
          initialDriverLng={job.driver_lng}
          initialLocationUpdatedAt={job.driver_location_updated_at}
          jobStatus={job.status}
          driverName={driverName}
          driverPhotoUrl={driverPhoto}
          statusLabel={statusLabels[job.status] ?? job.status}
        />

        <div className="mt-4">
          <CopyLinkButton url={publicTrackingUrl} />
        </div>

        <div className="mt-6 p-3 rounded-xl border-2 border-[#378ADD] bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#378ADD]" />
            <p className="text-xs font-semibold text-[#2d6ead] uppercase tracking-wide">Internal Chat</p>
          </div>
          <p className="text-[11px] text-gray-500 mb-2">Driver, dealer &amp; admin only — the customer can't see this.</p>
          <ChatPanel
            jobId={job.id}
            currentUserId={user.id}
            currentUserName={myProfile?.full_name || 'You'}
            currentUserRole={myProfile?.role || 'org_member'}
          />
        </div>

        <div className="mt-6 p-3 rounded-xl border-2 border-amber-400 bg-amber-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Customer Text Thread</p>
          </div>
          <p className="text-[11px] text-gray-500 mb-2">Real text messages sent to the customer's phone — they can reply.</p>
          <CustomerSmsThread jobId={job.id} hasCustomerPhone={!!job.customer_phone} />
        </div>

        <div className="mt-4 text-sm text-gray-500">
          <p>{job.pickup_address}</p>
          <p className="text-xs text-gray-400 my-1">↓</p>
          <p>{job.dropoff_address}</p>
        </div>

        {checklistWithUrls.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <CollapsibleSection
              title={`Checklist (${checklistWithUrls.filter((i) => i.completed_at).length}/${checklistWithUrls.length})`}
            >
            <div className="space-y-1.5">
              {checklistWithUrls.map((item, idx) => {
                const phase = item.label.startsWith('Delivery:') ? 'Delivery' : item.label.startsWith('Pickup:') ? 'Pickup' : null
                const prevPhase = idx > 0
                  ? (checklistWithUrls[idx - 1].label.startsWith('Delivery:') ? 'Delivery' : checklistWithUrls[idx - 1].label.startsWith('Pickup:') ? 'Pickup' : null)
                  : null
                const displayLabel = item.label.replace(/^(Pickup|Delivery):\s*/, '')
                return (
                <div key={item.id}>
                  {phase && phase !== prevPhase && (
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-1 first:mt-0">{phase}</p>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs shrink-0 ${item.completed_at ? 'bg-[#378ADD] border-[#378ADD] text-white' : 'border-gray-300'}`}>
                      {item.completed_at ? '✓' : ''}
                    </span>
                    <span className={item.completed_at ? 'text-gray-400' : 'text-gray-700'}>
                      {displayLabel}
                    </span>
                    {item.urls.length > 0 && (
                      <span>
                        {item.urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline ml-1">
                            [view{item.urls.length > 1 ? ` ${i + 1}` : ''}]
                          </a>
                        ))}
                      </span>
                    )}
                  </div>
                  {item.notes && <p className="text-xs text-gray-500 ml-6">{item.notes}</p>}
                </div>
              )})}
            </div>
            </CollapsibleSection>
          </div>
        )}
      </div>
    </div>
  )
}
