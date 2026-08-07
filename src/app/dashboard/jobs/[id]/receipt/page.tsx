import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PrintButton from '@/components/PrintButton'
import CloseButton from '@/components/CloseButton'
import { formatCents } from '@/lib/pricing'
import { buildDeliveryDisclosureText } from '@/lib/checklist'
import DealerFeedbackForm from '@/components/DealerFeedbackForm'
import ConditionReportView from '@/components/ConditionReportView'
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

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
}

const CONDITION_LABEL_MATCH = /condition report|walkaround|photos of any.*damage/i
const DISCLOSURE_LABEL_MATCH = /delivery disclosure/i

export default async function JobReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'platform_admin'

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*, job_types(name), organizations(name, address, phone), driver:driver_id(full_name, phone)')
    .eq('id', jobId)
    .single()

  if (jobError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Couldn&apos;t load this receipt</h1>
          <p className="text-sm text-red-600 mb-4">{jobError.message}</p>
          <p className="text-sm text-gray-500">
            This usually means a recent database migration hasn&apos;t been run yet in Supabase.
          </p>
        </div>
      </div>
    )
  }

  if (!job) notFound()

  const { data: events } = await supabase
    .from('job_status_events')
    .select('status, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  const { data: checklist } = await supabase
    .from('job_checklist_items')
    .select('id, label, item_type, completed_at, file_paths, notes, condition_data')
    .eq('job_id', jobId)
    .order('sort_order')

  // Generate short-lived signed URLs for any uploaded evidence, since job-media is a private bucket.
  const checklistWithUrls = await Promise.all(
    (checklist ?? []).map(async (item) => {
      const urls = await Promise.all(
        (item.file_paths ?? []).map(async (path: string) => {
          const { data } = await supabase.storage.from('job-media').createSignedUrl(path, 60 * 60)
          return { path, url: data?.signedUrl ?? null }
        })
      )
      return { ...item, files: urls.filter((u) => u.url) as { path: string; url: string }[] }
    })
  )

  const driverInfo = Array.isArray(job.driver) ? job.driver[0] : job.driver
  const driverName = driverInfo?.full_name as string | undefined
  const driverPhone = driverInfo?.phone as string | undefined
  const jobTypeName = Array.isArray(job.job_types) ? job.job_types[0]?.name : job.job_types?.name
  const org = Array.isArray(job.organizations) ? job.organizations[0] : job.organizations
  const orgName = org?.name

  const pickedUpEvent = events?.find((e) => e.status === 'picked_up')
  const deliveredEvent = events?.find((e) => e.status === 'delivered' || e.status === 'completed')

  const conditionItems = checklistWithUrls.filter((i) => CONDITION_LABEL_MATCH.test(i.label))
  const disclosureItem = checklistWithUrls.find((i) => DISCLOSURE_LABEL_MATCH.test(i.label))
  const otherItems = checklistWithUrls.filter((i) => i !== disclosureItem && !conditionItems.includes(i))

  function isImagePath(path: string) {
    return /\.(jpe?g|png|gif|webp)$/i.test(path)
  }

  function FileThumbs({ files }: { files: { path: string; url: string }[] }) {
    if (files.length === 0) return null
    return (
      <div className="flex flex-wrap gap-2 mt-1.5">
        {files.map((f) => (
          <a key={f.path} href={f.url} target="_blank" rel="noopener noreferrer">
            {isImagePath(f.path) ? (
              <img src={f.url} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
            ) : (
              <span className="w-20 h-20 rounded-lg border border-gray-200 flex items-center justify-center text-xs text-gray-500 bg-gray-50 print:hidden">
                File
              </span>
            )}
          </a>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-8 print:px-0 print:py-0">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <CloseButton />
          <PrintButton />
        </div>

        <div className="border-b border-gray-200 pb-6 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Delivery Receipt</p>
          <Logo height={28} />
          <p className="text-sm text-gray-500 mt-2">{orgName}</p>
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
            {(job.key_count || job.has_wheel_lock || job.has_charging_cables || job.other_included_items) && (
              <p className="text-xs text-gray-500 mt-1">
                Included: {[
                  job.key_count && `${job.key_count} set${job.key_count === 1 ? '' : 's'} of keys`,
                  job.has_wheel_lock && 'wheel lock',
                  job.has_charging_cables && 'charging cables',
                  job.other_included_items,
                ].filter(Boolean).join(', ')}
              </p>
            )}
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
        </div>

        {/* Driver, GPS, and pickup/delivery timing */}
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Delivery Info</p>
          <div className="text-sm text-gray-700 space-y-1">
            {driverName && (
              <p>Driver: {driverName}{driverPhone && ` · ${driverPhone}`}</p>
            )}
            {pickedUpEvent && <p>Picked up: {fmtDateTime(pickedUpEvent.created_at)}</p>}
            {job.pickup_gps_lat != null && job.pickup_gps_lng != null && (
              <p className="text-gray-500">
                Pickup GPS: {Number(job.pickup_gps_lat).toFixed(5)}, {Number(job.pickup_gps_lng).toFixed(5)}
                {job.pickup_gps_at && ` (${fmtDateTime(job.pickup_gps_at)})`}
              </p>
            )}
            {deliveredEvent && <p>Delivered: {fmtDateTime(deliveredEvent.created_at)}</p>}
            {job.delivery_gps_lat != null && job.delivery_gps_lng != null && (
              <p className="text-gray-500">
                Delivery GPS: {Number(job.delivery_gps_lat).toFixed(5)}, {Number(job.delivery_gps_lng).toFixed(5)}
                {job.delivery_gps_at && ` (${fmtDateTime(job.delivery_gps_at)})`}
              </p>
            )}
          </div>
        </div>

        {events && events.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Timeline</p>
            <div className="space-y-1">
              {events.map((e, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700">{statusLabels[e.status] ?? e.status}</span>
                  <span className="text-gray-400">{fmtDateTime(e.created_at)}</span>
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

        {/* Condition Report: pickup + delivery condition documentation, with visible photos */}
        {conditionItems.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Condition Report</p>
            <div className="space-y-3">
              {conditionItems.map((item) => (
                <div key={item.id} className="text-sm">
                  <span className={item.completed_at ? 'text-gray-700' : 'text-gray-400'}>
                    {item.completed_at ? '✓ ' : '○ '}{item.label.replace(/^(Pickup|Delivery):\s*/, '')}
                  </span>
                  {item.notes && <p className="text-xs text-gray-600 mt-0.5">{item.notes}</p>}
                  {item.condition_data && (item.condition_data.cleanliness || item.condition_data.smell) && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {item.condition_data.cleanliness && `Cleanliness: ${item.condition_data.cleanliness}/5`}
                      {item.condition_data.cleanliness && item.condition_data.smell && ' · '}
                      {item.condition_data.smell && `Smell: ${item.condition_data.smell}`}
                    </p>
                  )}
                  {item.condition_data && item.condition_data.markers?.length > 0 && (
                    <ConditionReportView data={item.condition_data} />
                  )}
                  <FileThumbs files={item.files} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delivery Disclosure: the full acknowledgement / condition acceptance / media consent document */}
        {disclosureItem && (() => {
          const odometerItem = checklistWithUrls.find((i) => i.label === 'Delivery: Enter the odometer reading')
          const deliveryConditionItem = conditionItems.find((i) => i.label.startsWith('Delivery:'))
          const disclosureText = buildDeliveryDisclosureText({
            customerName: job.customer_full_name || job.recipient_name,
            customerAddress: job.customer_address,
            customerPhone: job.customer_phone,
            vehicleYear: job.vehicle_year,
            vehicleMake: job.vehicle_make,
            vehicleModel: job.vehicle_model,
            vin: job.vin,
            odometer: odometerItem?.notes ?? null,
            dealerName: org?.name,
            dealerAddress: org?.address,
            dealerPhone: org?.phone,
            deliveryDateTime: disclosureItem.completed_at ? fmtDateTime(disclosureItem.completed_at) : null,
            deliveryLat: job.delivery_gps_lat,
            deliveryLng: job.delivery_gps_lng,
          })
          return (
            <div className="mb-6">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Delivery Disclosure</p>
              <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2 whitespace-pre-line">
                {disclosureText}
              </p>
              {deliveryConditionItem?.condition_data && deliveryConditionItem.condition_data.markers?.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-1">Condition at delivery</p>
                  <ConditionReportView data={deliveryConditionItem.condition_data} />
                </div>
              )}
              <p className="text-sm text-gray-700">
                {disclosureItem.completed_at ? `Signed by ${job.customer_full_name || 'customer'} on ${fmtDateTime(disclosureItem.completed_at)}` : 'Not yet signed'}
              </p>
              <FileThumbs files={disclosureItem.files} />
            </div>
          )
        })()}

        {/* Full checklist for reference */}
        {otherItems.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              Checklist ({checklistWithUrls.filter((i) => i.completed_at).length}/{checklistWithUrls.length})
            </p>
            <div className="space-y-2">
              {otherItems.map((item, idx) => {
                const phase = item.label.startsWith('Delivery:') ? 'Delivery' : item.label.startsWith('Pickup:') ? 'Pickup' : null
                const prevPhase = idx > 0
                  ? (otherItems[idx - 1].label.startsWith('Delivery:') ? 'Delivery' : otherItems[idx - 1].label.startsWith('Pickup:') ? 'Pickup' : null)
                  : null
                const displayLabel = item.label.replace(/^(Pickup|Delivery):\s*/, '')
                return (
                <div key={item.id} className="text-sm">
                  {phase && phase !== prevPhase && (
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-1 first:mt-0">{phase}</p>
                  )}
                  <span className={item.completed_at ? 'text-gray-700' : 'text-gray-400'}>
                    {item.completed_at ? '✓ ' : '○ '}{displayLabel}
                  </span>
                  {item.notes && (
                    <p className="text-xs text-gray-500 mt-0.5 ml-4">{item.notes}</p>
                  )}
                  <FileThumbs files={item.files} />
                </div>
              )})}
            </div>
          </div>
        )}

        {!isAdmin && job.status === 'completed' && (
          <div className="mb-6">
            <DealerFeedbackForm jobId={job.id} initialRating={job.dealer_rating} initialFeedback={job.dealer_feedback} />
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
              {job.actual_driver_hours != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Actual hours (pickup → back at origin)</span>
                  <span className="text-gray-900 font-medium">{job.actual_driver_hours.toFixed(1)} hrs</span>
                </div>
              )}
              {(job.customer_rating != null || job.customer_feedback) && (
                <div className="text-sm mt-2">
                  <span className="text-gray-600">Customer rating: </span>
                  <span className="text-gray-900 font-medium">{job.customer_rating != null ? `${job.customer_rating}/5` : '—'}</span>
                  {job.customer_feedback && <p className="text-xs text-gray-500 mt-0.5">{job.customer_feedback}</p>}
                </div>
              )}
              {(job.dealer_rating != null || job.dealer_feedback) && (
                <div className="text-sm mt-2">
                  <span className="text-gray-600">Dealer rating: </span>
                  <span className="text-gray-900 font-medium">{job.dealer_rating != null ? `${job.dealer_rating}/5` : '—'}</span>
                  {job.dealer_feedback && <p className="text-xs text-gray-500 mt-0.5">{job.dealer_feedback}</p>}
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
