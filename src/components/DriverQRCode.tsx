'use client'

import { useEffect, useState } from 'react'

export default function DriverQRCode({ driverId }: { driverId: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/driver-profile/${driverId}` : ''

  useEffect(() => {
    let cancelled = false
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(url, { width: 240, margin: 1 }).then((generated) => {
        if (!cancelled) setDataUrl(generated)
      })
    })
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="border border-gray-200 rounded-xl p-4 text-center">
      <p className="text-sm font-medium text-gray-900 mb-3">Public profile QR code</p>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="QR code linking to this driver's public profile" className="mx-auto w-40 h-40" />
      ) : (
        <div className="w-40 h-40 mx-auto flex items-center justify-center text-xs text-gray-400">Generating…</div>
      )}
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all mt-2 block">
        {url}
      </a>
      <p className="text-xs text-gray-400 mt-2">
        Scanning shows this driver&apos;s active status, rating, and lets anyone leave praise or a complaint.
      </p>
    </div>
  )
}
