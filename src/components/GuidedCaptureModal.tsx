'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  mode: 'walkaround' | 'dash'
  onCapture: (file: File) => void
  onClose: () => void
}

// A simple top-down car silhouette with an animated dot circling it, showing
// the driver exactly where to start, which direction to walk, and where to
// end — front, around the passenger side, rear, driver side, back to front.
function WalkaroundGuide() {
  return (
    <svg viewBox="0 0 220 220" className="w-full h-full">
      <ellipse cx="110" cy="110" rx="95" ry="70" fill="none" stroke="white" strokeWidth="2" strokeDasharray="4 5" opacity="0.7" />
      <g transform="translate(110,110)">
        <path d="M-15,-45 L15,-45 Q28,-45 30,-30 L34,20 Q35,45 15,45 L-15,45 Q-35,45 -34,20 L-30,-30 Q-28,-45 -15,-45 Z"
          fill="#378ADD" stroke="white" strokeWidth="1.5" />
        <rect x="-12" y="-33" width="24" height="20" rx="3" fill="white" opacity="0.85" />
      </g>
      <circle r="6" fill="#ffffff" stroke="#378ADD" strokeWidth="2">
        <animateMotion dur="10s" repeatCount="indefinite"
          path="M 110,40 A 95,70 0 1 1 109.9,40" />
      </circle>
      <text x="110" y="30" textAnchor="middle" fill="white" fontSize="11" fontWeight="600">Front</text>
      <text x="205" y="114" textAnchor="middle" fill="white" fontSize="11" fontWeight="600">Side</text>
      <text x="110" y="196" textAnchor="middle" fill="white" fontSize="11" fontWeight="600">Rear</text>
      <text x="15" y="114" textAnchor="middle" fill="white" fontSize="11" fontWeight="600">Side</text>
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
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="text-white text-sm">✕ Cancel</button>
        <p className="text-white text-sm font-medium">
          {mode === 'walkaround' ? '360° Walkaround Video' : 'Dash & Fuel Gauge Photo'}
        </p>
        <div className="w-12" />
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-white text-sm text-center">{error}</p>
        </div>
      ) : (
        <div className="flex-1 relative">
          <video ref={videoRef} autoPlay playsInline muted={mode === 'dash'} className="w-full h-full object-cover" />

          {mode === 'walkaround' ? (
            <div className="absolute bottom-4 left-4 w-36 h-36 bg-black/40 rounded-xl">
              <WalkaroundGuide />
            </div>
          ) : (
            <svg viewBox="0 0 300 225" className="absolute inset-0 w-full h-full pointer-events-none">
              <rect x="20" y="40" width="260" height="145" rx="10" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8 6" opacity="0.9" />
              <text x="150" y="30" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">Frame the dash + fuel gauge here</text>
            </svg>
          )}

          {mode === 'walkaround' && recording && (
            <div className="absolute top-4 right-4 bg-red-600 text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </div>
          )}
        </div>
      )}

      <div className="px-6 py-6 flex justify-center">
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
