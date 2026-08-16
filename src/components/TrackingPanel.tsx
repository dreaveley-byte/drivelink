'use client'

import { useState } from 'react'
import GoogleMapView from '@/components/GoogleMapView'

export default function TrackingPanel({
  jobId,
  pickupAddress,
  dropoffAddress,
  initialDriverLat,
  initialDriverLng,
  initialLocationUpdatedAt,
  jobStatus,
  publicToken,
  driverName,
  driverPhotoUrl,
  statusLabel,
  trackWhilePickedUp,
}: {
  jobId: string
  pickupAddress: string
  dropoffAddress: string
  initialDriverLat: number | null
  initialDriverLng: number | null
  initialLocationUpdatedAt: string | null
  jobStatus: string
  publicToken?: string
  driverName?: string | null
  driverPhotoUrl?: string | null
  statusLabel: string
  trackWhilePickedUp?: boolean
}) {
  const [eta, setEta] = useState('')

  return (
    <div>
      <div className="flex items-center gap-2 mt-3">
        <p className="text-sm text-gray-500">{statusLabel}</p>
      </div>
      {eta && jobStatus === 'in_progress' && (
        <p className="text-base font-bold text-gray-900 mt-1">{eta}</p>
      )}

      <div className="mt-3">
        <GoogleMapView
          jobId={jobId}
          pickupAddress={pickupAddress}
          dropoffAddress={dropoffAddress}
          initialDriverLat={initialDriverLat}
          initialDriverLng={initialDriverLng}
          initialLocationUpdatedAt={initialLocationUpdatedAt}
          jobStatus={jobStatus}
          publicToken={publicToken}
          onEtaChange={setEta}
          trackWhilePickedUp={trackWhilePickedUp}
        />
      </div>
    </div>
  )
}
