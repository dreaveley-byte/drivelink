'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Plain-language reason for a camera failure, so a driver (or whoever is
// helping them) can tell "the app isn't allowed to use the camera" apart from
// "no camera" or "another app has it".
function cameraErrorMessage(e: unknown): string {
  const name = (e as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'The camera is blocked for this app. You can still add the photo with the button below. To fix it for good: phone Settings \u2192 Apps \u2192 Drivflo \u2192 Permissions \u2192 Camera \u2192 Allow.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No camera was found on this device. You can still add a photo with the button below.'
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'Another app is using the camera. Close other camera apps and try again, or add the photo with the button below.'
  return 'Could not open the camera. You can still add the photo with the button below.'
}

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
    // Some in-app browsers don't expose the camera API at all - without this
    // the screen just stayed black with a dead capture button and no message.
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(cameraErrorMessage(null))
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setReady(true)
      })
      .catch((e) => setError(cameraErrorMessage(e)))

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

  // Rendered via a portal straight to document.body rather than inline in
  // the component tree - a fixed-position full-screen overlay can get
  // clipped or mispositioned in some Android WebViews if it ends up
  // nested inside any ancestor with its own stacking/transform context,
  // even one that looks harmless. A portal sidesteps that class of bug
  // entirely instead of chasing down which ancestor might be the cause.
  return createPortal(
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
          {/* Hands off to the phone's own camera / photo picker, which doesn't
              depend on the in-app camera permission, so a driver is never stuck. */}
          <label className="mt-4 inline-block bg-[#378ADD] text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer">
            Take or choose a photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) onCapture(file)
              }}
            />
          </label>
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
    </div>,
    document.body
  )
}
