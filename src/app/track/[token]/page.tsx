import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GoogleMapView from '@/components/GoogleMapView'
import CustomerFeedbackForm from '@/components/CustomerFeedbackForm'

export const dynamic = 'force-dynamic'

const statusLabels: Record<string, string> = {
  awaiting_driver: 'Preparing your delivery',
  assigned: 'Driver assigned',
  picked_up: 'Vehicle picked up',
  in_progress: 'On the way',
  delivered: 'Delivered',
  completed: 'Delivered',
  cancelled: 'Delivery cancelled',
}

export default async function PublicTrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data } = await supabase.rpc('get_tracking_info', { p_token: token })
  const info = Array.isArray(data) ? data[0] : data

  if (!info) notFound()

  const vehicleDesc = [info.vehicle_year, info.vehicle_make, info.vehicle_model].filter(Boolean).join(' ')

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-6 py-8">
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Drivflo</p>
          <h1 className="text-lg font-semibold text-gray-900 mt-1">
            {info.organization_name ? `${info.organization_name} — ` : ''}Your delivery
          </h1>
          {vehicleDesc && <p className="text-sm text-gray-600 mt-1">{vehicleDesc}</p>}
          <p className="text-sm text-gray-500 mt-1">
            {statusLabels[info.status] ?? info.status}
            {info.driver_name && ` · Driver: ${info.driver_name}`}
          </p>
        </div>

        <GoogleMapView
          jobId=""
          pickupAddress={info.pickup_address}
          dropoffAddress={info.dropoff_address}
          initialDriverLat={info.driver_lat}
          initialDriverLng={info.driver_lng}
          initialLocationUpdatedAt={info.driver_location_updated_at}
          jobStatus={info.status}
          publicToken={token}
        />

        <p className="text-xs text-gray-400 mt-6 text-center">
          Powered by Drivflo
        </p>

        {(info.status === 'delivered' || info.status === 'completed') && (
          <div className="mt-6">
            {info.customer_rating != null ? (
              <div className="border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-600">
                Thank you for your feedback!
              </div>
            ) : (
              <CustomerFeedbackForm token={token} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
