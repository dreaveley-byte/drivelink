// Bridges the native background-geolocation plugin into the same location-ping
// flow the web app already uses. Everything here is a no-op when running in a
// regular browser (Capacitor.isNativePlatform() returns false) — this file only
// does anything when the driver pages are loaded inside the native iOS app shell.
'use client'

import { Capacitor, registerPlugin } from '@capacitor/core'

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

type LocationCallback = (location: { latitude: number; longitude: number }, error: { code: string } | null) => void

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: { backgroundTitle: string; backgroundMessage: string; requestPermissions: boolean; stale: boolean; distanceFilter: number },
    callback: LocationCallback
  ): Promise<string>
  removeWatcher(options: { id: string }): Promise<void>
}

// registerPlugin (rather than a direct import) is this specific plugin's own
// required usage pattern — see node_modules/@capacitor-community/background-geolocation/README.md.
// Safe to call in a regular browser too: it just returns a proxy object whose
// methods are never actually invoked there, since isNativeApp() gates all callers.
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')

type LocationUpdate = { lat: number; lng: number }

let activeWatcherId: string | null = null

// Starts native background tracking for a job. The callback fires on every
// location update, including while the app is backgrounded — call the same
// Supabase insert logic the web app already uses for foreground tracking.
export async function startBackgroundTracking(onLocation: (loc: LocationUpdate) => void): Promise<void> {
  if (!isNativeApp()) return
  try {
    if (activeWatcherId) {
      await BackgroundGeolocation.removeWatcher({ id: activeWatcherId })
      activeWatcherId = null
    }
    activeWatcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: 'Drivflo is tracking your delivery',
        backgroundMessage: 'Location is shared with the dealer and customer while this job is active.',
        requestPermissions: true,
        stale: false,
        distanceFilter: 25,
      },
      (location, error) => {
        if (error) {
          console.error('Background location error:', error)
          return
        }
        if (location) {
          onLocation({ lat: location.latitude, lng: location.longitude })
        }
      }
    )
  } catch (e) {
    console.error('Could not start background tracking:', e)
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  if (!isNativeApp() || !activeWatcherId) return
  try {
    await BackgroundGeolocation.removeWatcher({ id: activeWatcherId })
    activeWatcherId = null
  } catch (e) {
    console.error('Could not stop background tracking:', e)
  }
}
