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

    // The interval above gets throttled/paused by the browser once the tab is
    // backgrounded (this is a browser-level limitation web apps can't bypass —
    // true background tracking needs a native app). This at least makes sure
    // location catches up immediately the moment the driver reopens the tab,
    // rather than waiting up to 20s or staying stale.
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') pushLocation()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [jobId])

  if (status === 'denied') {
    return (
      <div className="text-xs bg-red-50 border border-red-300 text-red-700 rounded-lg px-3 py-2 mt-1">
        <p className="font-medium">⚠️ Location sharing is off for this job.</p>
        <p className="mt-0.5">
          This is required while on an active job — dealers and customers can&apos;t see your progress, and drivers who
          don&apos;t share location may be removed from the platform. Enable location access for this site in your phone&apos;s
          browser settings, then reopen this page.
        </p>
      </div>
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
