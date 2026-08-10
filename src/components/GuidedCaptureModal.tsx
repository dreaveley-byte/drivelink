'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  mode: 'walkaround' | 'dash'
  onCapture: (file: File) => void
  onClose: () => void
}

// Matches the 9-step storyboard exactly: front -> front driver 3/4 -> driver
// side -> rear driver 3/4 -> rear -> rear passenger 3/4 -> passenger side ->
// front passenger 3/4 -> front. Nine static images, nothing added — no zoom,
// no pan, no extra frames beyond exactly what's in the reference.
const OUTLINE_STEP_INDICES = [0, 10, 9, 7, 6, 4, 3, 1, 0]
const OUTLINE_FRAMES = OUTLINE_STEP_INDICES.map((i) => `/condition-report/outline-frames-16/step_${String(i).padStart(2, '0')}.png`)
const OUTLINE_STEP_SECONDS = 4 // ~4s/step matches the storyboard's own ~4s-per-step pacing
// Arrow points left while walking the driver side (front -> driver side ->
// rear), then right while walking the passenger side (rear -> passenger side
// -> front) — matches the direction the outline appears to move on screen.
const LEFT_ARROW_INDICES = new Set([0, 1, 2, 3, 4])

// The outline itself steps through the 9 static angles from the storyboard —
// front, counter-clockwise around the car, and back to front — cycling
// automatically so the driver has a live guide to follow as they walk the loop.
function CarOutlineOverlay({ elapsedSeconds }: { elapsedSeconds: number }) {
  const index = Math.floor(elapsedSeconds / OUTLINE_STEP_SECONDS) % OUTLINE_FRAMES.length
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={OUTLINE_FRAMES[index]}
      alt=""
      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      style={{ mixBlendMode: 'multiply', opacity: 0.9, transform: 'scale(1.35)' }}
    />
  )
}

// A simple flashing arrow (not a curved arc) showing which way to step next.
function DirectionArrow({ elapsedSeconds }: { elapsedSeconds: number }) {
  const index = Math.floor(elapsedSeconds / OUTLINE_STEP_SECONDS) % OUTLINE_FRAMES.length
  const pointLeft = LEFT_ARROW_INDICES.has(index)
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 text-[#378ADD]"
      style={{ [pointLeft ? 'left' : 'right']: '5%', animation: 'arrow-flash 1s ease-in-out infinite' }}
    >
      <style>{`
        @keyframes arrow-flash {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 1; }
        }
      `}</style>
      <svg width="56" height="56" viewBox="0 0 56 56">
        {pointLeft ? (
          <path d="M36,10 L18,28 L36,46" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M20,10 L38,28 L20,46" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </div>
  )
}

// A real short looping video showing the car rotating through all 8 angles
// so drivers see an actual demonstration of the walk before they start.
// Autoplay is unreliable in some mobile/PWA contexts even when muted, so this
// explicitly calls play() and falls back to a tap-to-play button if blocked.
function WalkaroundDemo() {
  const ref = useRef<HTMLVideoElement>(null)
  const [needsTap, setNeedsTap] = useState(false)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    video.muted = true
    const playPromise = video.play()
    if (playPromise) {
      playPromise.catch(() => setNeedsTap(true))
    }
  }, [])

  return (
    <div className="relative w-full max-w-xs mx-auto">
      <video
        ref={ref}
        src="/condition-report/walkaround-360-demo.mp4"
        autoPlay
        loop
        muted
        playsInline
        onCanPlay={() => ref.current?.play().catch(() => setNeedsTap(true))}
        className="w-full rounded-lg"
      />
      {needsTap && (
        <button
          onClick={() => {
            ref.current?.play().then(() => setNeedsTap(false)).catch(() => {})
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg"
        >
          <span className="text-white text-3xl">▶</span>
        </button>
      )}
    </div>
  )
}

export default function GuidedCaptureModal({ mode, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [showingDemo, setShowingDemo] = useState(mode === 'walkaround')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (showingDemo) return
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
  }, [mode, showingDemo])

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

  if (showingDemo) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ height: '100dvh' }}>
        <div className="flex items-center justify-between px-4 py-2 shrink-0">
          <button onClick={onClose} className="text-white text-sm">✕ Cancel</button>
          <div className="w-12" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 min-h-0">
          <p className="text-white text-sm font-medium text-center">Here&apos;s what to do</p>
          <WalkaroundDemo />
          <p className="text-white text-xs text-center max-w-xs leading-relaxed">
            Start at the front of the vehicle, walk counter-clockwise all the way around it while recording,
            and end back where you started. Keep the vehicle framed inside the outline the whole way.
          </p>
        </div>
        <div className="px-6 py-4 shrink-0">
          <button
            onClick={() => setShowingDemo(false)}
            className="w-full bg-[#378ADD] text-white text-sm font-medium px-8 py-3 rounded-full"
          >
            Got it, start
          </button>
        </div>
      </div>
    )
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
              <CarOutlineOverlay elapsedSeconds={recording ? seconds : 0} />
              {recording && <DirectionArrow elapsedSeconds={seconds} />}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 rounded-lg px-3 py-1.5 max-w-[90%]">
                <p className="text-white text-xs text-center leading-snug">
                  {recording
                    ? 'Keep the vehicle inside the outline — follow the arrow counter-clockwise around it, ending back at the front.'
                    : 'Line up and start recording.'}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/condition-report/dash-outline.png"
                alt=""
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                style={{ mixBlendMode: 'multiply', opacity: 0.9 }}
              />
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 rounded-lg px-3 py-1.5 max-w-[90%]">
                <p className="text-white text-xs text-center leading-snug">
                  Line the instrument cluster up inside the outline, then take the photo.
                </p>
              </div>
            </>
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

