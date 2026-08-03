'use client'

import { useEffect, useRef, useState } from 'react'

export default function PhotoCaptureField({
  currentUrl,
  shape = 'circle',
  label,
  onCaptured,
}: {
  currentUrl: string | null
  shape?: 'circle' | 'square'
  label: string
  onCaptured: (blob: Blob) => void
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setError('Camera access was denied or unavailable — use "Upload photo" instead.'))

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open])

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const size = Math.min(video.videoWidth, video.videoHeight)
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2
    // Mirror horizontally so the preview matches what the person sees (selfie mode)
    ctx.translate(size, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size)

    canvas.toBlob((blob) => {
      if (blob) onCaptured(blob)
      closeCamera()
    }, 'image/jpeg', 0.9)
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setOpen(false)
    setError('')
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onCaptured(file)
  }

  return (
    <div>
      <label className="block text-sm text-gray-700 mb-2">{label}</label>
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center ${shape === 'circle' ? 'rounded-full' : 'rounded-lg'}`}>
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-gray-300 text-xs">None</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50"
          >
            Take photo
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-gray-500 hover:text-gray-800 underline"
          >
            Upload photo
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="relative w-full max-w-sm mx-4">
            {error ? (
              <div className="bg-white rounded-xl p-6 text-center">
                <p className="text-sm text-red-600 mb-4">{error}</p>
                <button onClick={closeCamera} className="text-sm text-gray-600 underline">Close</button>
              </div>
            ) : (
              <>
                <div className="relative rounded-xl overflow-hidden bg-black">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-square object-cover [transform:scaleX(-1)]" />
                  {/* Face-alignment guide */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className={`w-[70%] aspect-square border-2 border-white/80 ${shape === 'circle' ? 'rounded-full' : 'rounded-2xl'}`}
                      style={{ boxShadow: '0 0 0 2000px rgba(0,0,0,0.45)' }}
                    />
                  </div>
                  {shape === 'circle' && (
                    <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/90">
                      Center your face in the circle
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-center gap-4 mt-4">
                  <button
                    onClick={closeCamera}
                    className="text-sm text-white/80 hover:text-white px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={capture}
                    className="w-14 h-14 rounded-full bg-white border-4 border-white/30 hover:border-white/50"
                    aria-label="Capture photo"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
