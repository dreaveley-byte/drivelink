'use client'

import { useEffect, useRef, useState } from 'react'

// A simple, reliable in-app camera capture using getUserMedia — the same
// approach already proven working in GuidedCaptureModal and the customer
// /verify page. This replaces the plain <input type="file" capture> pattern,
// which on Android WebViews frequently falls back to file-picker-only
// instead of actually opening the camera (no CAMERA permission is ever
// requested for it, so there's nothing forcing the native camera to launch).
export default function SimpleCameraCapture({
  open,
  onClose,
  onCapture,
  filenamePrefix = 'photo',
}: {
  open: boolean
  onClose: () => void
  onCapture: (file: File) => void
  filenamePrefix?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setReady(false)
    setError('')
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setReady(true)
      })
      .catch(() => setError('Could not access your camera. Please allow camera access and try again.'))

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open])

  function handleCapture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `${filenamePrefix}-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onCapture(file)
      },
      'image/jpeg',
      0.9
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-2xl leading-none z-10 w-9 h-9 flex items-center justify-center bg-black/40 rounded-full"
      >
        ✕
      </button>

      {error ? (
        <div className="text-center px-6">
          <p className="text-white text-sm">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 bg-white text-gray-900 text-sm font-medium px-4 py-2 rounded-lg"
          >
            Close
          </button>
        </div>
      ) : (
        <>
          <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
          <div className="py-6">
            <button
              type="button"
              onClick={handleCapture}
              disabled={!ready}
              className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 disabled:opacity-40"
              aria-label="Take photo"
            />
          </div>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
