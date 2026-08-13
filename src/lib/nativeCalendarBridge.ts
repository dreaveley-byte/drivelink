// Bridges calendar event creation for the native app. The earlier approach
// (sharing an .ics file via the native share sheet) didn't reliably surface
// Calendar as an option on this device/iOS version, even though the file was
// correctly recognized. Directly creating the event through a real calendar
// plugin is the more reliable approach - it skips the share sheet entirely.
'use client'

import { isNativeApp } from './nativeLocationBridge'

export async function addCalendarEventNative(event: {
  title: string
  location: string
  start: Date
  end: Date
}): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar')

    const permission = await CapacitorCalendar.requestPermission({ alias: 'writeCalendar' as any })
    if (permission.result !== 'granted') {
      console.error('Calendar permission not granted:', permission.result)
      return false
    }

    await CapacitorCalendar.createEvent({
      title: event.title,
      location: event.location,
      startDate: event.start.getTime(),
      endDate: event.end.getTime(),
    })
    return true
  } catch (e) {
    console.error('Native calendar event creation failed:', e)
    return false
  }
}
