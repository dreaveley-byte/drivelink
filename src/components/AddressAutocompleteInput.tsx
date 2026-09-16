'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    google: any
    __driveLinkPlacesLoading?: Promise<void>
  }
}

// Separate from GoogleMapView's loader (which only requests the geocoding
// library) - Autocomplete needs the places library specifically. Checks for
// an already-loaded google.maps.places first, in case some other component
// on the same page already brought it in, before adding another script tag.
function loadGooglePlaces(): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve()
  if (window.__driveLinkPlacesLoading) return window.__driveLinkPlacesLoading

  window.__driveLinkPlacesLoading = new Promise((resolve, reject) => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!key) {
      reject(new Error('missing_key'))
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('load_failed'))
    document.head.appendChild(script)
  })

  return window.__driveLinkPlacesLoading
}

export default function AddressAutocompleteInput({
  value,
  onChange,
  placeholder,
  required,
  className,
}: {
  value: string
  onChange: (address: string) => void
  placeholder?: string
  required?: boolean
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Always current inside the Google callback below without needing to
  // re-run the setup effect (and re-attach the widget) every keystroke.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    let cancelled = false
    let listener: any
    loadGooglePlaces()
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places) return
        // Address-only suggestions, biased to Canada/US since that's where
        // this app operates - this is the actual fix for wrong-address
        // pricing errors: a selected suggestion is Google's own verified,
        // correctly-formatted address, not whatever free-text a person
        // typed (typos, missing city, swapped digits, etc.) that geocoding
        // then has to guess at.
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ['address'],
          componentRestrictions: { country: ['ca', 'us'] },
          fields: ['formatted_address'],
        })
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          if (place?.formatted_address) {
            onChangeRef.current(place.formatted_address)
          }
        })
      })
      .catch(() => {
        // Missing key or failed to load - the plain text input below still
        // works exactly as it always did, just without suggestions.
      })
    return () => {
      cancelled = true
      if (listener) window.google?.maps?.event?.removeListener(listener)
    }
  }, [])

  return (
    <input
      ref={inputRef}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  )
}
