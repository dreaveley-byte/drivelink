'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

declare global {
  interface Window {
    google: any
    __driveLinkMapsLoading?: Promise<void>
    gm_authFailure?: () => void
  }
}

// A small white car silhouette (top-down) with the Drivflo blue accent, used as
// the live driver marker instead of a generic dot — reinforces the brand and
// reads clearly as "a car" at a glance on the map.
const DRIVER_CAR_ICON_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
  <circle cx="22" cy="22" r="21" fill="#ffffff" stroke="#378ADD" stroke-width="2"/>
  <g transform="translate(22,23) rotate(0)">
    <path d="M-9,2 L-8,-4 Q-7,-8 -3,-8 L3,-8 Q7,-8 8,-4 L9,2 Q9,5 6,5 L-6,5 Q-9,5 -9,2 Z"
      fill="#378ADD" stroke="#1D1D1F" stroke-width="0.5"/>
    <path d="M-6,-3.5 L-5,-6.5 Q-4,-7.5 -2,-7.5 L2,-7.5 Q4,-7.5 5,-6.5 L6,-3.5 Z" fill="#ffffff" opacity="0.85"/>
    <circle cx="-5.5" cy="5" r="2" fill="#1D1D1F"/>
    <circle cx="5.5" cy="5" r="2" fill="#1D1D1F"/>
  </g>
</svg>
`.trim())

function driverCarIcon(google: any) {
  return {
    url: `data:image/svg+xml,${DRIVER_CAR_ICON_SVG}`,
    scaledSize: new google.maps.Size(44, 44),
    anchor: new google.maps.Point(22, 22),
  }
}

function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve()
  if (window.__driveLinkMapsLoading) return window.__driveLinkMapsLoading

  window.__driveLinkMapsLoading = new Promise((resolve, reject) => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!key) {
      reject(new Error('missing_key'))
      return
    }
    // Google calls this global when it rejects the key (invalid key, billing
    // not active, referrer not allowed, or an API not enabled for it). Nothing
    // listened before, so the map just rendered blank with no explanation.
    window.gm_authFailure = () => window.dispatchEvent(new Event('drivflo-maps-auth-failure'))
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geocoding`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('load_failed'))
    document.head.appendChild(script)
  })

  return window.__driveLinkMapsLoading
}

type Props = {
  jobId: string
  pickupAddress: string
  dropoffAddress: string
  initialDriverLat: number | null
  initialDriverLng: number | null
  initialLocationUpdatedAt: string | null
  jobStatus: string
  publicToken?: string
  onEtaChange?: (eta: string) => void
  trackWhilePickedUp?: boolean
  /** Only platform admin sees why Google failed - everyone else gets a plain message. */
  isAdmin?: boolean
}

export default function GoogleMapView({
  jobId,
  pickupAddress,
  dropoffAddress,
  initialDriverLat,
  initialDriverLng,
  initialLocationUpdatedAt,
  jobStatus,
  publicToken,
  onEtaChange,
  trackWhilePickedUp = false,
  isAdmin = false,
}: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const driverMarkerRef = useRef<any>(null)
  const trailPolylineRef = useRef<any>(null)
  const [mapError, setMapError] = useState('')
  // Non-fatal problems (route line / pins couldn't be drawn). Only ever shown
  // to platform admin - dealers, drivers and customers never see these.
  const [mapIssues, setMapIssues] = useState<string[]>([])
  const trailLoadedRef = useRef(false)
  const addIssue = useCallback((msg: string) => {
    setMapIssues((prev) => (prev.includes(msg) ? prev : [...prev, msg]))
  }, [])
  const [locationUpdatedAt, setLocationUpdatedAt] = useState(initialLocationUpdatedAt)
  const [eta, setEta] = useState<string>('')
  const isTerminal = jobStatus === 'completed' || jobStatus === 'cancelled'
  // Live GPS tracking only makes sense once the driver has actually started
  // driving. For a vehicle delivery, "picked up" means at the pickup
  // location filling out paperwork, not yet driving - so tracking only
  // starts at "in progress". For a customer ride, "picked up" (the driver
  // tapping "Picking up customer") IS the driver actively en route, so that
  // one needs to start tracking a full stage earlier.
  const isTracking = jobStatus === 'in_progress' || (trackWhilePickedUp && jobStatus === 'picked_up')

  const updateEta = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: [`${lat},${lng}`, dropoffAddress] }),
      })
      const data = await res.json()
      if (res.ok) {
        const etaText = `${data.durationMinutes} min (${data.distanceKm} km) to dropoff`
        setEta(etaText)
        onEtaChange?.(etaText)
      }
    } catch {
      // ETA is a nice-to-have; fail silently if it doesn't come back.
    }
  }, [dropoffAddress, onEtaChange])

  useEffect(() => {
    function onAuthFailure() {
      setMapError(
        isAdmin
          ? "Google rejected the Maps key, so the map can't load. This is usually billing not active on the Google Cloud account, the key's restrictions, or a Maps API that isn't enabled."
          : publicToken
            ? 'The map is temporarily unavailable. Your driver is still on the way.'
            : 'The map is temporarily unavailable.'
      )
    }
    window.addEventListener('drivflo-maps-auth-failure', onAuthFailure)
    return () => window.removeEventListener('drivflo-maps-auth-failure', onAuthFailure)
  }, [publicToken, isAdmin])

  useEffect(() => {
    let cancelled = false

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapDivRef.current) return
        const google = window.google

        const map = new google.maps.Map(mapDivRef.current, {
          zoom: 11,
          center: { lat: 49.28, lng: -123.12 },
          disableDefaultUI: false,
        })
        mapRef.current = map

        // Draw the actual planned driving route as a line between pickup and
        // dropoff — this is what lets the customer see the driver visibly
        // progressing along a real road path, not just two disconnected pins.
        const directionsService = new google.maps.DirectionsService()
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#2563eb', strokeOpacity: 0.6, strokeWeight: 4 },
        })
        directionsService.route(
          {
            origin: pickupAddress,
            destination: dropoffAddress,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result: any, status: string) => {
            if (status === 'OK' && result) {
              directionsRenderer.setDirections(result)
            } else {
              addIssue(`Planned route line couldn't be drawn (Google Directions: ${status}).`)
            }
          }
        )

        const geocoder = new google.maps.Geocoder()
        const bounds = new google.maps.LatLngBounds()

        geocoder.geocode({ address: pickupAddress }, (results: any, status: string) => {
          if (status === 'OK' && results?.[0]) {
            const loc = results[0].geometry.location
            new google.maps.Marker({ position: loc, map, label: 'P', title: 'Pickup' })
            bounds.extend(loc)
            map.fitBounds(bounds)
          } else {
            addIssue(`Pickup pin couldn't be placed (Google Geocoding: ${status}).`)
          }
        })

        geocoder.geocode({ address: dropoffAddress }, (results: any, status: string) => {
          if (status === 'OK' && results?.[0]) {
            const loc = results[0].geometry.location
            new google.maps.Marker({ position: loc, map, label: 'D', title: 'Dropoff' })
            bounds.extend(loc)
            map.fitBounds(bounds)
          } else {
            addIssue(`Dropoff pin couldn't be placed (Google Geocoding: ${status}).`)
          }
        })

        if (isTracking && initialDriverLat != null && initialDriverLng != null) {
          const pos = { lat: initialDriverLat, lng: initialDriverLng }
          driverMarkerRef.current = new google.maps.Marker({
            position: pos,
            map,
            icon: driverCarIcon(google),
            title: 'Driver',
          })
          bounds.extend(pos)
          map.fitBounds(bounds)
          if (!isTerminal) updateEta(initialDriverLat, initialDriverLng)
        }

        // The driven trail — a solid line that grows to show exactly where the
        // driver has actually been since marking "in progress", separate from
        // the lighter planned-route line above.
        trailPolylineRef.current = new google.maps.Polyline({
          map,
          path: [],
          strokeColor: '#378ADD',
          strokeOpacity: 0.9,
          strokeWeight: 7,
        })
        if (isTracking) {
          const supabase = createClient()
          const trailQuery = publicToken
            ? supabase.rpc('get_job_location_trail', { p_token: publicToken })
            : supabase.rpc('get_job_location_trail_by_id', { p_job_id: jobId })
          trailQuery.then(({ data }: { data: any }) => {
            if (cancelled) return
            trailLoadedRef.current = true
            if (!Array.isArray(data) || data.length === 0) return
            const path = data.map((p: any) => ({ lat: p.lat, lng: p.lng }))
            trailPolylineRef.current?.setPath(path)
          })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMapError(err.message === 'missing_key' ? 'Maps is not configured yet.' : 'Could not load the map.')
        }
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll for driver location updates every 15s while the driver is actively en route
  useEffect(() => {
    if (!isTracking) return

    const supabase = createClient()
    const interval = setInterval(async () => {
      let driverLat: number | null = null
      let driverLng: number | null = null
      let updatedAt: string | null = null

      if (publicToken) {
        const { data } = await supabase.rpc('get_tracking_info', { p_token: publicToken })
        const row = Array.isArray(data) ? data[0] : data
        driverLat = row?.driver_lat ?? null
        driverLng = row?.driver_lng ?? null
        updatedAt = row?.driver_location_updated_at ?? null
      } else {
        const { data } = await supabase
          .from('jobs')
          .select('driver_lat, driver_lng, driver_location_updated_at')
          .eq('id', jobId)
          .single()
        driverLat = data?.driver_lat ?? null
        driverLng = data?.driver_lng ?? null
        updatedAt = data?.driver_location_updated_at ?? null
      }

      // If tracking only began after this page was already open, the trail
      // wasn't loaded at mount - load what's been driven so far, once.
      if (!trailLoadedRef.current && trailPolylineRef.current) {
        trailLoadedRef.current = true
        const trailQuery = publicToken
          ? supabase.rpc('get_job_location_trail', { p_token: publicToken })
          : supabase.rpc('get_job_location_trail_by_id', { p_job_id: jobId })
        trailQuery.then(({ data }: { data: { lat: number; lng: number }[] | null }) => {
          if (!Array.isArray(data) || data.length === 0) return
          trailPolylineRef.current?.setPath(data.map((p) => ({ lat: p.lat, lng: p.lng })))
        })
      }

      if (driverLat != null && driverLng != null && window.google?.maps) {
        const pos = { lat: driverLat, lng: driverLng }
        if (driverMarkerRef.current) {
          driverMarkerRef.current.setPosition(pos)
        } else if (mapRef.current) {
          driverMarkerRef.current = new window.google.maps.Marker({
            position: pos,
            map: mapRef.current,
            icon: driverCarIcon(window.google),
            title: 'Driver',
          })
        }
        if (trailPolylineRef.current) {
          const path = trailPolylineRef.current.getPath()
          const last = path.getLength() > 0 ? path.getAt(path.getLength() - 1) : null
          if (!last || last.lat() !== pos.lat || last.lng() !== pos.lng) {
            path.push(new window.google.maps.LatLng(pos.lat, pos.lng))
          }
        }
        setLocationUpdatedAt(updatedAt)
        updateEta(driverLat, driverLng)
      }
    }, 15000)

    return () => clearInterval(interval)
  }, [jobId, isTracking, isTerminal, updateEta, publicToken])

  const minutesAgo = locationUpdatedAt
    ? Math.round((Date.now() - new Date(locationUpdatedAt).getTime()) / 60000)
    : null

  return (
    <div>
      {mapError ? (
        <div className="border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">{mapError}</div>
      ) : (
        <div ref={mapDivRef} className="w-full h-80 rounded-lg border border-gray-200" />
      )}
      {isAdmin && mapIssues.length > 0 && !mapError && (
        <div className="mt-2 text-xs bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-3 py-2">
          {mapIssues.map((m) => <p key={m}>⚠️ {m}</p>)}
          <p className="mt-1 text-amber-700">
            Usually means that Google API isn&apos;t enabled for the Maps key, the key&apos;s restrictions don&apos;t list it, or billing isn&apos;t active.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>
          {isTerminal
            ? 'Trip finished'
            : !isTracking
              ? 'Live tracking starts once your driver is on the way'
              : eta || 'Waiting for driver location...'}
        </span>
        {minutesAgo != null && isTracking && !isTerminal && (
          <span>Updated {minutesAgo === 0 ? 'just now' : `${minutesAgo} min ago`}</span>
        )}
      </div>
    </div>
  )
}
