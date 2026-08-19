'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isNativeApp, startBackgroundTracking, stopBackgroundTracking } from '@/lib/nativeLocationBridge'

const UPDATE_INTERVAL_MS = 20000

function getDeviceInstructions(): string {
  if (typeof navigator === 'undefined') return ''
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)

  if (isIOS) {
    return 'Open the Settings app → Safari → Location → set to "Allow", or Settings → Privacy & Security → Location Services → Safari Websites → drivflo.ca → Allow.'
  }
  if (isAndroid) {
    return 'Tap the lock/info icon next to the address bar → Permissions → Location → Allow. Or: Chrome menu (⋮) → Settings → Site settings → Location → find drivflo.ca → Allow.'
  }
  return 'Check your browser’s site settings for drivflo.ca and allow Location access.'
}

export default function LocationSharer({ jobId }: { jobId: string }) {
  // 'sharing' now ONLY means a location was actually confirmed saved to the
  // database — not just that a GPS coordinate was obtained. Getting a
  // coordinate but failing to save it (RLS issue, network issue, auth issue,
  // etc.) now shows as 'error' instead of silently claiming success, which
  // was previously misleading the driver into thinking sharing was working
  // when nothing was actually reaching the database.
  const [status, setStatus] = useState<'idle' | 'sharing' | 'denied' | 'unsupported' | 'error'>('idle')
  const [retrying, setRetrying] = useState(false)
  const [lastErrorMessage, setLastErrorMessage] = useState('')

  function attemptShare() {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }
    const supabase = createClient()
    let settled = false
    // Same independent safety net as everywhere else — the geolocation
    // call's own timeout option isn't reliably honored inside this webview,
    // so without this, clicking "Try again" could itself hang forever on
    // "Checking..." with no way out, which is exactly what was happening.
    const hardTimeout = setTimeout(() => {
      if (!settled) {
        settled = true
        setRetrying(false)
        setLastErrorMessage('Location request never completed after retrying — this usually means the permission prompt is stuck. Try closing and fully reopening the app.')
        setStatus('error')
      }
    }, 12000)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (settled) return
        settled = true
        clearTimeout(hardTimeout)
        setRetrying(false)
        const { error: updateError } = await supabase
          .from('jobs')
          .update({
            driver_lat: pos.coords.latitude,
            driver_lng: pos.coords.longitude,
            driver_location_updated_at: new Date().toISOString(),
          })
          .eq('id', jobId)
        const { error: pingError } = await supabase.from('job_location_pings').insert({ job_id: jobId, lat: pos.coords.latitude, lng: pos.coords.longitude })
        if (updateError || pingError) {
          console.error('Location save failed:', updateError, pingError)
          setLastErrorMessage((updateError || pingError)?.message ?? 'Unknown error')
          setStatus('error')
          return
        }
        setStatus('sharing')
      },
      () => {
        if (settled) return
        settled = true
        clearTimeout(hardTimeout)
        setStatus('denied')
        setRetrying(false)
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
    )
  }

  function handleRetry() {
    setRetrying(true)
    attemptShare()
  }

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }

    let cancelled = false
    let resolved = false
    const supabase = createClient()

    // If nothing (native watcher or web geolocation) produces any result at
    // all within 15s, stop showing an infinite "Getting your location..."
    // spinner and surface a real, visible error instead — this exact
    // indefinite-hang pattern is what caused "Mark picked up" to get stuck
    // earlier, just showing up here in a different spot.
    const stuckTimeout = setTimeout(() => {
      if (!resolved && !cancelled) {
        setLastErrorMessage('Location request never completed — this usually means the permission prompt is stuck or was missed.')
        setStatus('error')
      }
    }, 15000)

    async function recordPing(lat: number, lng: number) {
      resolved = true
      clearTimeout(stuckTimeout)
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ driver_lat: lat, driver_lng: lng, driver_location_updated_at: new Date().toISOString() })
        .eq('id', jobId)
      const { error: pingError } = await supabase.from('job_location_pings').insert({ job_id: jobId, lat, lng })
      if (updateError || pingError) {
        console.error('Location save failed:', updateError, pingError)
        if (!cancelled) {
          setLastErrorMessage((updateError || pingError)?.message ?? 'Unknown error')
          setStatus('error')
        }
        return
      }
      if (!cancelled) setStatus('sharing')
      fetch('/api/driver-idle-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, lat, lng }),
      }).catch(() => {})
    }

    // Inside the native app shell, try real background GPS tracking — it's
    // meant to keep producing updates even while the app is minimized, which
    // a browser tab fundamentally cannot do. This is currently unreliable on
    // some devices (the native watcher can silently never resolve), so this
    // ALSO runs the same proven foreground polling used in a regular browser
    // as a fallback — meaning even if background tracking isn't working yet,
    // basic tracking-while-the-app-is-open still works exactly like the web
    // app does today, rather than depending entirely on the flakier path.
    if (isNativeApp()) {
      startBackgroundTracking((loc) => {
        if (!cancelled) recordPing(loc.lat, loc.lng)
      })
      // falls through to also run the standard polling below
    }

    function pushLocation() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return
          recordPing(pos.coords.latitude, pos.coords.longitude)
        },
        () => {
          if (!cancelled) {
            resolved = true
            clearTimeout(stuckTimeout)
            setStatus('denied')
          }
        },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
      )
    }

    pushLocation()
    const interval = setInterval(pushLocation, UPDATE_INTERVAL_MS)

    // The interval above gets throttled/paused by the browser once the tab is
    // backgrounded (this is a browser-level limitation web apps can't bypass —
    // true background tracking needs a native app, which is what the
    // startBackgroundTracking() attempt above is for once it's fully reliable).
    // This at least makes sure location catches up immediately the moment the
    // driver reopens the tab/app, rather than waiting up to 20s or staying stale.
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') pushLocation()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      clearTimeout(stuckTimeout)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (isNativeApp()) stopBackgroundTracking()
    }
  }, [jobId])

  if (status === 'denied') {
    return (
      <div className="text-xs bg-red-50 border border-red-300 text-red-700 rounded-lg px-3 py-2 mt-1">
        <p className="font-medium">⚠️ Location sharing is off for this job.</p>
        <p className="mt-0.5">
          This is required while on an active job — dealers and customers can&apos;t see your progress, and drivers who
          don&apos;t share location may be removed from the platform.
        </p>
        <p className="mt-1.5 text-red-600">{getDeviceInstructions()}</p>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="mt-2 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {retrying ? 'Checking…' : "I've enabled it — try again"}
        </button>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="text-xs bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-3 py-2 mt-1">
        <p className="font-medium">⚠️ Location sharing isn&apos;t working right now.</p>
        <p className="mt-0.5">Dealers and customers won&apos;t see your progress until this is fixed.</p>
        {lastErrorMessage && <p className="mt-1 text-amber-600">{lastErrorMessage}</p>}
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="mt-2 text-xs bg-amber-700 text-white px-3 py-1.5 rounded-lg hover:bg-amber-800 disabled:opacity-50"
        >
          {retrying ? 'Checking…' : 'Try again'}
        </button>
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
