'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const UPDATE_INTERVAL_MS = 20000

export default function LocationSharer({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<'idle' | 'sharing' | 'denied' | 'unsupported'>('idle')

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }

    let cancelled = false
    const supabase = createClient()

    function pushLocation() {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return
          setStatus('sharing')
          await supabase
            .from('jobs')
            .update({
              driver_lat: pos.coords.latitude,
              driver_lng: pos.coords.longitude,
              driver_location_updated_at: new Date().toISOString(),
            })
            .eq('id', jobId)
        },
        () => {
          if (!cancelled) setStatus('denied')
        },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
      )
    }

    pushLocation()
    const interval = setInterval(pushLocation, UPDATE_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [jobId])

  if (status === 'denied') {
    return (
      <p className="text-xs text-amber-600">
        Location permission denied — the dealer won&apos;t be able to see your live position. Enable location access for this site to share it.
      </p>
    )
  }
  if (status === 'unsupported') return null

  return (
    <p className="text-xs text-gray-400 flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'sharing' ? 'bg-green-500' : 'bg-gray-300'}`} />
      {status === 'sharing' ? 'Sharing your location' : 'Getting your location...'}
    </p>
  )
}
