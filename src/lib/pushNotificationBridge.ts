// Bridges the native push-notifications plugin so a driver's device gets
// registered for real push notifications (work even with the app closed or
// phone locked) - a no-op when running in a regular browser, same pattern
// as nativeLocationBridge.ts.
'use client'

import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { isNativeApp } from './nativeLocationBridge'

// Requests permission (if not already granted/denied) and registers this
// device for push notifications, then sends the resulting device token to
// the server so it can be used to notify this driver later (e.g. when a new
// job is posted). Safe to call every time the driver dashboard loads - it's
// cheap when already registered, and picks up a fresh token if iOS ever
// rotates it.
export async function registerForPushNotifications(): Promise<void> {
  if (!isNativeApp()) return
  // Push notifications aren't implemented on Android yet (needs Firebase
  // Cloud Messaging setup) - bail out early rather than letting every call
  // below throw "not implemented" errors.
  if (!Capacitor.isPluginAvailable('PushNotifications')) return

  try {
    let permStatus = await PushNotifications.checkPermissions()
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions()
    }
    if (permStatus.receive !== 'granted') return

    await PushNotifications.register()
  } catch {
    // Push registration is a nice-to-have, not something that should block
    // the rest of the app from loading.
  }
}

// Called once from a top-level driver page to wire up the listeners that
// receive the actual device token once registration succeeds, and send it
// to the server. Separate from registerForPushNotifications() itself since
// listeners should only be attached once per app session, not on every call.
export function setupPushTokenListener(): void {
  if (!isNativeApp()) return
  // Same reasoning as registerForPushNotifications() above - Android doesn't
  // implement this plugin yet, so addListener() itself would reject.
  if (!Capacitor.isPluginAvailable('PushNotifications')) return

  try {
    PushNotifications.addListener('registration', async (token) => {
      try {
        await fetch('/api/driver/register-push-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceToken: token.value, platform: Capacitor.getPlatform() }),
        })
      } catch {
        // Will retry naturally next time registerForPushNotifications() runs.
      }
    })

    PushNotifications.addListener('registrationError', () => {
      // Best-effort feature - nothing actionable to do client-side here.
    })
  } catch {
    // Belt-and-suspenders: isPluginAvailable() should already prevent this,
    // but never let a push-notification setup failure break the app.
  }
}
