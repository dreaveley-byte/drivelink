// Bridges .ics calendar file handoff for the native app. A blob: URL
// same-tab navigation (what the regular web app uses) works fine in mobile
// Safari/Chrome, but doesn't reliably hand off to the Calendar app inside a
// Capacitor WKWebView - there's no OS-level file-type integration the way
// there is in a real browser. Writing the file to disk and invoking the
// native share sheet is the reliable way to do this inside an app shell.
'use client'

import { isNativeApp } from './nativeLocationBridge'

export async function shareIcsFileNative(icsContent: string, filename: string): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')

    const write = await Filesystem.writeFile({
      path: filename,
      data: icsContent,
      directory: Directory.Cache,
      encoding: 'utf8' as any,
    })

    await Share.share({
      title: 'Add to Calendar',
      url: write.uri,
    })
    return true
  } catch (e) {
    console.error('Native calendar share failed:', e)
    return false
  }
}
