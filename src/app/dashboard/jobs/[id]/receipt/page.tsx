import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PrintButton from '@/components/PrintButton'
import CloseButton from '@/components/CloseButton'
import { formatCents } from '@/lib/pricing'

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

export default async function JobReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'platform_admin'

  const { data: job } = await supabase
    .from('jobs')
    .select('*, job_types(name), organizations(name), driver:driver_id(full_name)')
    .eq('id', jobId)
    .single()

  if (!job) notFound()

  const { data: events } = await supabase
    .from('job_status_events')
    .select('status, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  const { data: checklist } = await supabase
    .from('job_checklist_items')
    .select('id, label, item_type, completed_at, file_paths')
    .eq('job_id', jobId)
    .order('sort_order')

  // Generate short-lived signed URLs for any uploaded evidence, since job-media is a private bucket.
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

  const driverName = Array.isArray(job.driver) ? job.driver[0]?.full_name : job.driver?.full_name
  const jobTypeName = Array.isArray(job.job_types) ? job.job_types[0]?.name : job.job_types?.name
  const orgName = Array.isArray(job.organizations) ? job.organizations[0]?.name : job.organizations?.name

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-8 print:px-0 print:py-0">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <CloseButton />
          <PrintButton />
        </div>

        <div className="border-b border-gray-200 pb-6 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Delivery Receipt</p>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">DriveLink</h1>
          <p className="text-sm text-gray-500 mt-1">{orgName}</p>
          <p className="text-xs text-gray-400 mt-2">Job ID: {job.id}</p>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Vehicle</p>
            {(job.vehicle_year || job.vehicle_make || job.vehicle_model) && (
              <p className="text-sm text-gray-900">
                {[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')}
              </p>
            )}
            {job.stock_number && <p className="text-sm text-gray-600">Stock #{job.stock_number}</p>}
            {job.vin && <p className="text-sm text-gray-600">VIN: {job.vin}</p>}
            {job.mileage && <p className="text-sm text-gray-600">{job.mileage} km</p>}
            <p className="text-sm text-gray-600 mt-1">{jobTypeName}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Customer</p>
            {job.customer_full_name && <p className="text-sm text-gray-900">{job.customer_full_name}</p>}
            {job.customer_phone && <p className="text-sm text-gray-600">{job.customer_phone}</p>}
            {job.customer_address && <p className="text-sm text-gray-600">{job.customer_address}</p>}
            {job.recipient_name && (
              <p className="text-sm text-gray-600 mt-1">Recipient: {job.recipient_name}</p>
            )}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Trip</p>
          <p className="text-sm text-gray-900">{job.pickup_address}</p>
          <p className="text-xs text-gray-400 my-1">↓</p>
          <p className="text-sm text-gray-900">{job.dropoff_address}</p>
          <p className="text-sm text-gray-600 mt-2">
            {job.estimated_distance_km != null && `${Math.round(job.estimated_distance_km)} km round trip`}
            {job.vehicle_mode && ` · ${job.vehicle_mode === 'towed' ? 'Towed' : 'Driven'}`}
            {job.second_driver_required && ' · Second driver'}
          </p>
          {driverName && <p className="text-sm text-gray-600 mt-1">Driver: {driverName}</p>}
        </div>

        {events && events.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Timeline</p>
            <div className="space-y-1">
              {events.map((e, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700">{statusLabels[e.status] ?? e.status}</span>
                  <span className="text-gray-400">
                    {new Date(e.created_at).toLocaleString('en-CA', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(job.notes || (job.additional_charges && job.additional_charges.length > 0)) && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Notes</p>
            {job.notes && <p className="text-sm text-gray-600">{job.notes}</p>}
            {job.additional_charges?.map((c: { description: string; dealerAmountCents: number }, i: number) => (
              <p key={i} className="text-sm text-gray-600">
                {c.description || 'Additional charge'} — {formatCents(c.dealerAmountCents)}
              </p>
            ))}
          </div>
        )}

        {checklistWithUrls.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              Checklist ({checklistWithUrls.filter((i) => i.completed_at).length}/{checklistWithUrls.length})
            </p>
            <div className="space-y-1.5">
              {checklistWithUrls.map((item) => (
                <div key={item.id} className="text-sm">
                  <span className={item.completed_at ? 'text-gray-700' : 'text-gray-400'}>
                    {item.completed_at ? '✓ ' : '○ '}{item.label}
                  </span>
                  {item.urls.length > 0 && (
                    <span className="ml-2 print:hidden">
                      {item.urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline ml-1">
                          [view{item.urls.length > 1 ? ` ${i + 1}` : ''}]
                        </a>
                      ))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-6">
          {isAdmin ? (
            <div className="space-y-1">
              {job.estimated_dealer_cost_cents != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Dealer charged</span>
                  <span className="text-gray-900 font-medium">{formatCents(job.estimated_dealer_cost_cents)}</span>
                </div>
              )}
              {job.estimated_driver_pay_cents != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Driver paid</span>
                  <span className="text-gray-900 font-medium">{formatCents(job.estimated_driver_pay_cents)}</span>
                </div>
              )}
            </div>
          ) : (
            job.estimated_dealer_cost_cents != null && (
              <div className="flex justify-between">
                <span className="text-base text-gray-700">Total charged</span>
                <span className="text-lg font-semibold text-gray-900">{formatCents(job.estimated_dealer_cost_cents)}</span>
              </div>
            )
          )}
          <p className="text-xs text-gray-400 mt-4">
            Status: {statusLabels[job.status] ?? job.status}
          </p>
        </div>
      </div>
    </div>
  )
}
