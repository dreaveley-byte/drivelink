'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  mode: 'walkaround' | 'dash'
  onCapture: (file: File) => void
  onClose: () => void
}

// A car outline overlaid directly on the live camera view — the driver lines
// the real vehicle up inside it before starting, then keeps it framed inside
// the outline while walking counter-clockwise around the car and filming.
function CarOutline() {
  return (
    <svg viewBox="0 0 320 200" className="absolute inset-0 w-full h-full pointer-events-none">
      <path
        d="M40,150 L40,110 Q42,95 60,90 L95,75 Q115,62 150,60 L210,60 Q240,62 255,80 L275,95 Q288,100 288,115 L288,150 Q288,158 280,158 L260,158 Q258,145 245,145 Q232,145 230,158 L100,158 Q98,145 85,145 Q72,145 70,158 L48,158 Q40,158 40,150 Z"
        fill="none" stroke="white" strokeWidth="3" strokeDasharray="10 7" opacity="0.9"
      />
      <circle cx="85" cy="158" r="14" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="4 4" opacity="0.85" />
      <circle cx="245" cy="158" r="14" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="4 4" opacity="0.85" />
    </svg>
  )
}

export default function GuidedCaptureModal({ mode, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: mode === 'walkaround' })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
      .catch(() => setError('Could not access the camera. Check camera permissions and try again.'))

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [mode])

  useEffect(() => {
    if (!recording) return
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [recording])

  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    setSeconds(0)
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm'
    const recorder = new MediaRecorder(streamRef.current, { mimeType })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const file = new File([blob], `walkaround-${Date.now()}.webm`, { type: mimeType })
      onCapture(file)
    }
    recorder.start()
    mediaRecorderRef.current = recorder
    setRecording(true)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], `dash-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <button onClick={onClose} className="text-white text-sm">✕ Cancel</button>
        <div className="w-12" />
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center px-6 min-h-0">
          <p className="text-white text-sm text-center">{error}</p>
        </div>
      ) : (
        <div className="flex-1 relative min-h-0 overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted={mode === 'dash'} className="w-full h-full object-cover" />

          {mode === 'walkaround' ? (
            <>
              <CarOutline />
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 rounded-lg px-3 py-1.5 max-w-[90%]">
                <p className="text-white text-xs text-center leading-snug">
                  {recording
                    ? 'Keep the vehicle inside the outline — walk counter-clockwise around it, ending back at the front.'
                    : 'Line the front of the vehicle up inside the outline, then start recording.'}
                </p>
              </div>
            </>
          ) : (
            <svg viewBox="0 0 300 225" className="absolute inset-0 w-full h-full pointer-events-none">
              <rect x="20" y="40" width="260" height="145" rx="10" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8 6" opacity="0.9" />
              <text x="150" y="30" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">Frame the dash + fuel gauge here</text>
            </svg>
          )}

          {mode === 'walkaround' && recording && (
            <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </div>
          )}
        </div>
      )}

      <div className="px-6 py-4 flex justify-center shrink-0">
        {mode === 'dash' ? (
          <button onClick={capturePhoto} className="bg-[#378ADD] text-white text-sm font-medium px-8 py-3 rounded-full">
            Take photo
          </button>
        ) : recording ? (
          <button onClick={stopRecording} className="bg-white text-red-600 text-sm font-medium px-8 py-3 rounded-full">
            ⏹ Stop recording
          </button>
        ) : (
          <button onClick={startRecording} disabled={!!error} className="bg-red-600 text-white text-sm font-medium px-8 py-3 rounded-full disabled:opacity-50">
            ● Start recording
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

