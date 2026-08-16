'use client'

import { useState } from 'react'

export default function ShareRideButton({ label }: { label: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = window.location.href
    const shareData = { title: 'Drivflo', text: `Track my ${label} live here:`, url }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // User cancelled the native share sheet, or it's unavailable - fall
        // through to the clipboard copy below either way.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can fail in some contexts - nothing more to do here
    }
  }

  return (
    <button
      onClick={share}
      className="w-full flex items-center justify-center gap-2 text-sm font-medium border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 mt-3"
    >
      {copied ? '\u2713 Link copied' : `\ud83d\udcce Share this ${label} with a friend`}
    </button>
  )
}
