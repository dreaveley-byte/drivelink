'use client'

import { useState } from 'react'

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can fail in some contexts; not worth extra complexity for a fallback here.
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <p className="text-xs text-gray-500 mb-1.5">Share with customer — no login needed</p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-600"
        />
        <button
          type="button"
          onClick={copy}
          className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 whitespace-nowrap"
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}
