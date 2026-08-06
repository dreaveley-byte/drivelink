'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

declare global {
  interface Window {
    google: any
    __driveLinkMapsLoading?: Promise<void>
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
}: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const driverMarkerRef = useRef<any>(null)
  const [mapError, setMapError] = useState('')
  const [locationUpdatedAt, setLocationUpdatedAt] = useState(initialLocationUpdatedAt)
  const [eta, setEta] = useState<string>('')
  const isTerminal = jobStatus === 'completed' || jobStatus === 'cancelled'
  // Live GPS tracking only makes sense once the driver has actually started the
  // delivery drive — before that (assigned/picked up) there's no meaningful
  // position to show yet, so the map stays a static preview of the planned route.
  const isTracking = jobStatus === 'in_progress'

  const updateEta = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: [`${lat},${lng}`, dropoffAddress] }),
      })
      const data = await res.json()
      if (res.ok) {
        setEta(`${data.durationMinutes} min (${data.distanceKm} km) to dropoff`)
      }
    } catch {
      // ETA is a nice-to-have; fail silently if it doesn't come back.
    }
  }, [dropoffAddress])

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
          }
        })

        geocoder.geocode({ address: dropoffAddress }, (results: any, status: string) => {
          if (status === 'OK' && results?.[0]) {
            const loc = results[0].geometry.location
            new google.maps.Marker({ position: loc, map, label: 'D', title: 'Dropoff' })
            bounds.extend(loc)
            map.fitBounds(bounds)
          }
        })

        if (isTracking && initialDriverLat != null && initialDriverLng != null) {
          const pos = { lat: initialDriverLat, lng: initialDriverLng }
          driverMarkerRef.current = new google.maps.Marker({
            position: pos,
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#2563eb',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
            title: 'Driver',
          })
          bounds.extend(pos)
          map.fitBounds(bounds)
          if (!isTerminal) updateEta(initialDriverLat, initialDriverLng)
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

      if (driverLat != null && driverLng != null && window.google?.maps) {
        const pos = { lat: driverLat, lng: driverLng }
        if (driverMarkerRef.current) {
          driverMarkerRef.current.setPosition(pos)
        } else if (mapRef.current) {
          driverMarkerRef.current = new window.google.maps.Marker({
            position: pos,
            map: mapRef.current,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#2563eb',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
            title: 'Driver',
          })
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
