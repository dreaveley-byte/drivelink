import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GoogleMapView from '@/components/GoogleMapView'
import CloseButton from '@/components/CloseButton'

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

  const { data: job } = await supabase
    .from('jobs')
    .select('id, status, pickup_address, dropoff_address, driver_lat, driver_lng, driver_location_updated_at, job_types(name), driver:driver_id(full_name)')
    .eq('id', jobId)
    .single()

  if (!job) notFound()

  const { data: checklist } = await supabase
    .from('job_checklist_items')
    .select('id, label, completed_at')
    .eq('job_id', jobId)
    .order('sort_order')

  const driverName = Array.isArray(job.driver) ? job.driver[0]?.full_name : (job.driver as { full_name: string } | null)?.full_name
  const jobTypeName = Array.isArray(job.job_types) ? job.job_types[0]?.name : (job.job_types as { name: string } | null)?.name

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{jobTypeName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {statusLabels[job.status] ?? job.status}
              {driverName && ` · Driver: ${driverName}`}
            </p>
          </div>
          <CloseButton />
        </div>

        <GoogleMapView
          jobId={job.id}
          pickupAddress={job.pickup_address}
          dropoffAddress={job.dropoff_address}
          initialDriverLat={job.driver_lat}
          initialDriverLng={job.driver_lng}
          initialLocationUpdatedAt={job.driver_location_updated_at}
          jobStatus={job.status}
        />

        <div className="mt-4 text-sm text-gray-500">
          <p>{job.pickup_address}</p>
          <p className="text-xs text-gray-400 my-1">↓</p>
          <p>{job.dropoff_address}</p>
        </div>

        {checklist && checklist.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              Checklist ({checklist.filter((i) => i.completed_at).length}/{checklist.length})
            </p>
            <div className="space-y-1.5">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${item.completed_at ? 'bg-gray-900 border-gray-900 text-white' : 'border-gray-300'}`}>
                    {item.completed_at ? '✓' : ''}
                  </span>
                  <span className={item.completed_at ? 'text-gray-400 line-through' : 'text-gray-700'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
