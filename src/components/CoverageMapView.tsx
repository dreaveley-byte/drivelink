'use client'

import { useEffect, useRef, useState } from 'react'
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

type Dealer = { id: string; name: string; address: string | null; lat: number | null; lng: number | null }
type Driver = { id: string; name: string; address: string | null; lat: number | null; lng: number | null; is_active: boolean }

export default function CoverageMapView({ dealers, drivers }: { dealers: Dealer[]; drivers: Driver[] }) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [geocoding, setGeocoding] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    loadGoogleMaps()
      .then(async () => {
        if (cancelled || !mapDivRef.current) return
        const google = window.google
        const geocoder = new google.maps.Geocoder()

        async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
          return new Promise((resolve) => {
            geocoder.geocode({ address }, (results: any, status: string) => {
              if (status === 'OK' && results?.[0]) {
                const loc = results[0].geometry.location
                resolve({ lat: loc.lat(), lng: loc.lng() })
              } else {
                resolve(null)
              }
            })
          })
        }

        // Geocode anything missing coordinates, then persist so we never have to do it again
        const resolvedDealers: (Dealer & { lat: number; lng: number })[] = []
        for (const d of dealers) {
          if (d.lat != null && d.lng != null) {
            resolvedDealers.push({ ...d, lat: d.lat, lng: d.lng })
            continue
          }
          if (!d.address) continue
          setGeocoding((n) => n + 1)
          const coords = await geocodeAddress(d.address)
          if (coords) {
            resolvedDealers.push({ ...d, ...coords })
            await supabase.from('organizations').update({ lat: coords.lat, lng: coords.lng }).eq('id', d.id)
          }
        }

        const resolvedDrivers: (Driver & { lat: number; lng: number })[] = []
        for (const dr of drivers) {
          if (dr.lat != null && dr.lng != null) {
            resolvedDrivers.push({ ...dr, lat: dr.lat, lng: dr.lng })
            continue
          }
          if (!dr.address) continue
          setGeocoding((n) => n + 1)
          const coords = await geocodeAddress(dr.address)
          if (coords) {
            resolvedDrivers.push({ ...dr, ...coords })
            await supabase.from('profiles').update({ home_lat: coords.lat, home_lng: coords.lng }).eq('id', dr.id)
          }
        }

        if (cancelled) return
        setGeocoding(0)

        if (resolvedDealers.length === 0 && resolvedDrivers.length === 0) {
          setError('No addresses could be located yet.')
          return
        }

        const map = new google.maps.Map(mapDivRef.current, {
          zoom: 9,
          center: resolvedDealers[0] ?? resolvedDrivers[0],
          mapTypeControl: false,
          streetViewControl: false,
        })

        const bounds = new google.maps.LatLngBounds()

        resolvedDealers.forEach((d) => {
          const position = { lat: d.lat, lng: d.lng }
          new google.maps.Marker({
            position,
            map,
            title: d.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#2563eb',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          })
          // 20km coverage radius
          new google.maps.Circle({
            center: position,
            radius: 20000,
            map,
            fillColor: '#2563eb',
            fillOpacity: 0.06,
            strokeColor: '#2563eb',
            strokeOpacity: 0.3,
            strokeWeight: 1,
          })
          bounds.extend(position)
        })

        resolvedDrivers.forEach((dr) => {
          const position = { lat: dr.lat, lng: dr.lng }
          new google.maps.Marker({
            position,
            map,
            title: dr.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: dr.is_active ? '#16a34a' : '#9ca3af',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          })
          bounds.extend(position)
        })

        if (!bounds.isEmpty()) map.fitBounds(bounds)
      })
      .catch(() => setError('Could not load Google Maps.'))

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Dealer (20km radius shown)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" /> Active driver</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" /> Inactive driver</span>
      </div>
      {geocoding > 0 && <p className="text-xs text-gray-400 mb-2">Locating addresses… ({geocoding})</p>}
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div ref={mapDivRef} className="w-full h-[500px] rounded-xl border border-gray-200 bg-gray-50" />
    </div>
  )
}
