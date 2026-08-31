'use client'

import { useEffect } from 'react'
import { registerForPushNotifications, setupPushTokenListener } from '@/lib/pushNotificationBridge'

// Mounted once, unconditionally, on the driver dashboard - unlike
// LocationSharer (which only runs while there's an active job), push
// registration needs to happen regardless of whether the driver currently
// has a job, since the whole point is to notify them of NEW jobs while
// they don't have one yet.
export default function PushNotificationSetup() {
  useEffect(() => {
    setupPushTokenListener()
    registerForPushNotifications()
  }, [])

  return null
}
