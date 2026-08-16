import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrackingPanel from '@/components/TrackingPanel'
import PublicChatWidget from '@/components/PublicChatWidget'
import ShareRideButton from '@/components/ShareRideButton'
import CustomerFeedbackForm from '@/components/CustomerFeedbackForm'
import Logo from '@/components/Logo'

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

const rideStatusLabels: Record<string, string> = {
  awaiting_driver: 'Preparing your ride',
  assigned: 'Driver assigned',
  picked_up: 'Picking you up',
  in_progress: 'On the way',
  delivered: 'Ride complete',
  completed: 'Ride complete',
  cancelled: 'Ride cancelled',
}

export default async function PublicTrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data } = await supabase.rpc('get_tracking_info', { p_token: token })
  const info = Array.isArray(data) ? data[0] : data

  if (!info) notFound()

  const vehicleDesc = [info.vehicle_year, info.vehicle_make, info.vehicle_model].filter(Boolean).join(' ')
  const isCustomerRide = info.job_type_name === 'Customer Pick Up' || info.job_type_name === 'Customer Drop Off'
  const isCourier = info.job_type_name === 'Courier / Package'

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-6 py-8">
        <div className="mb-6">
          <Logo height={24} />
          <div className="flex items-center gap-3 mt-3">
            {info.organization_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.organization_logo_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
            )}
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {info.organization_name ? `${info.organization_name} — ` : ''}{isCustomerRide ? 'Your ride' : isCourier ? 'Your package' : 'Your delivery'}
              </h1>
              {isCourier && info.package_description && <p className="text-sm text-gray-600 mt-0.5">{info.package_description}</p>}
              {vehicleDesc && !isCustomerRide && !isCourier && <p className="text-sm text-gray-600 mt-0.5">{vehicleDesc}</p>}
            </div>
          </div>
        </div>

        {info.status === 'delivered' || info.status === 'completed' ? (
          <div className="border border-gray-200 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-700 font-medium">
              {isCustomerRide ? 'Your ride is complete.' : isCourier ? 'Your package has been delivered.' : 'Your vehicle has been delivered.'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Live tracking has ended.</p>
          </div>
        ) : (
          <>
          {info.driver_name && (
            <div className="flex items-center gap-3 border border-gray-200 rounded-xl p-3 mb-3">
              {info.driver_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={info.driver_photo_url} alt="" className="w-12 h-12 rounded-full object-cover border border-gray-200" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  {info.driver_name[0]}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900">{info.driver_name}</p>
                {info.driver_rating_count > 0 ? (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <span className="text-amber-500">\u2605</span>
                    {info.driver_avg_rating} ({info.driver_rating_count} rating{info.driver_rating_count === 1 ? '' : 's'})
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">New driver</p>
                )}
              </div>
            </div>
          )}
          <TrackingPanel
            jobId=""
            pickupAddress={info.pickup_address}
            dropoffAddress={info.dropoff_address}
            initialDriverLat={info.driver_lat}
            initialDriverLng={info.driver_lng}
            initialLocationUpdatedAt={info.driver_location_updated_at}
            jobStatus={info.status}
            publicToken={token}
            driverName={info.driver_name}
            driverPhotoUrl={info.driver_photo_url}
            statusLabel={(isCustomerRide ? rideStatusLabels : statusLabels)[info.status] ?? info.status}
            trackWhilePickedUp={isCustomerRide}
          />
          <ShareRideButton label={isCustomerRide ? 'ride' : isCourier ? 'package' : 'delivery'} />
          <PublicChatWidget token={token} driverName={info.driver_name} />
          </>
        )}

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
