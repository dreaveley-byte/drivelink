'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

type Step = 'loading' | 'intro' | 'face' | 'license' | 'submitting' | 'done' | 'error' | 'already_done'

type VerificationInfo = {
  job_id: string
  customer_full_name: string | null
  vehicle_year: number | null
  vehicle_make: string | null
  vehicle_model: string | null
  driver_name: string | null
  status: string
  id_verification_completed_at: string | null
}

export default function VerifyPage() {
  const params = useParams()
  const token = params.token as string
  const [step, setStep] = useState<Step>('loading')
  const [info, setInfo] = useState<VerificationInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [facePhoto, setFacePhoto] = useState<string | null>(null)
  const [licensePhoto, setLicensePhoto] = useState<string | null>(null)
  const [retakeReason, setRetakeReason] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cameraReady, setCameraReady] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!token) return
    const supabase = createClient()
    supabase.rpc('get_verification_info', { p_token: token }).then(({ data, error }) => {
      const row = Array.isArray(data) ? data[0] : data
      if (error || !row) {
        setStep('error')
        setErrorMsg('This verification link is invalid or has expired.')
        return
      }
      setInfo(row)
      setStep(row.id_verification_completed_at ? 'already_done' : 'intro')
    })
  }, [token])

  useEffect(() => {
    setCountdown(null)
    if (step !== 'face' && step !== 'license') {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setCameraReady(false)
      return
    }
    setCameraReady(false)
    const facingMode = step === 'face' ? 'user' : 'environment'
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setCameraReady(true)
      })
      .catch(() => {
        setErrorMsg('Could not access your camera. Please allow camera access and reload this page.')
      })
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [step])

  // Countdown only starts once the person says they're ready — auto-starting
  // it the instant the camera turns on didn't give people time to actually
  // line their face/ID up first.
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) return
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c === null) return null
        if (c <= 1) {
          clearInterval(interval)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [countdown === null])

  function startCountdown() {
    setCountdown(4)
  }

  useEffect(() => {
    if (countdown === 0) {
      if (step === 'face') handleCaptureFace()
      else if (step === 'license') handleCaptureLicense()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  function capture(): string | null {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.9)
  }

  function handleCaptureFace() {
    const photo = capture()
    if (photo) {
      setCountdown(null)
      setFacePhoto(photo)
      setStep('license')
    }
  }

  function handleCaptureLicense() {
    const photo = capture()
    if (photo) {
      setCountdown(null)
      setLicensePhoto(photo)
      submit(facePhoto, photo)
    }
  }

  async function submit(face: string | null, license: string | null) {
    if (!face || !license) return
    setStep('submitting')
    setRetakeReason('')
    try {
      const res = await fetch('/api/id-verification/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, facePhoto: face, licensePhoto: license }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.retake === 'face') {
          setFacePhoto(null)
          setStep('face')
        } else if (data.retake === 'license') {
          setLicensePhoto(null)
          setStep('license')
        } else {
          setStep('error')
        }
        setRetakeReason(data.error || 'Please try again.')
        return
      }
      setStep('done')
    } catch {
      setRetakeReason('Something went wrong submitting your photos. Please try again.')
      setStep(license ? 'license' : 'face')
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 py-8">
      <Logo height={24} />

      {step === 'loading' && <p className="text-sm text-gray-400 mt-10">Loading…</p>}

      {step === 'error' && (
        <div className="mt-10 text-center max-w-sm">
          <p className="text-sm text-red-600">{errorMsg || retakeReason}</p>
        </div>
      )}

      {step === 'already_done' && (
        <div className="mt-10 text-center max-w-sm">
          <p className="text-lg font-medium text-gray-900">You&apos;re all set!</p>
          <p className="text-sm text-gray-500 mt-2">Your identity has already been verified for this delivery.</p>
        </div>
      )}

      {step === 'intro' && info && (
        <div className="mt-8 max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900">
            {info.customer_full_name ? `Hi ${info.customer_full_name},` : 'Hi,'} let&apos;s verify your identity
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            Your {[info.vehicle_year, info.vehicle_make, info.vehicle_model].filter(Boolean).join(' ')} has arrived.
            Before {info.driver_name || 'your driver'} hands over the keys, we just need a quick photo of your face
            and your driver&apos;s license or government photo ID.
          </p>
          <p className="text-xs text-gray-400 mt-2">This takes about 30 seconds and stays private with your delivery record.</p>
          <button
            onClick={() => setStep('face')}
            className="mt-6 bg-[#378ADD] text-white text-sm font-medium px-6 py-3 rounded-lg hover:bg-[#2d6ead] w-full"
          >
            Start verification
          </button>
        </div>
      )}

      {(step === 'face' || step === 'license') && (
        <div className="mt-6 w-full max-w-sm">
          <p className="text-sm font-medium text-gray-900 text-center mb-1">
            {step === 'face' ? 'Step 1 of 2 — Your face' : 'Step 2 of 2 — Your ID'}
          </p>
          <p className="text-xs text-gray-500 text-center mb-3">
            {step === 'face'
              ? 'Line your face up inside the oval, in good lighting, then tap when ready.'
              : 'Line your driver\u2019s license or photo ID up inside the frame, then tap when ready.'}
          </p>
          {retakeReason && <p className="text-xs text-red-600 text-center mb-2">⚠️ {retakeReason}</p>}
          <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {step === 'face' ? (
              <svg viewBox="0 0 300 225" className="absolute inset-0 w-full h-full pointer-events-none">
                <ellipse cx="150" cy="112" rx="80" ry="100" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8 6" opacity="0.9" />
              </svg>
            ) : (
              <svg viewBox="0 0 300 225" className="absolute inset-0 w-full h-full pointer-events-none">
                <rect x="35" y="55" width="230" height="115" rx="10" fill="none" stroke="white" strokeWidth="3" strokeDasharray="8 6" opacity="0.9" />
              </svg>
            )}
            {countdown != null && countdown > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                <span className="text-white text-7xl font-bold drop-shadow-lg">{countdown}</span>
              </div>
            )}
          </div>
          {countdown == null ? (
            <button
              onClick={startCountdown}
              disabled={!cameraReady}
              className="mt-4 bg-[#378ADD] text-white text-sm font-medium px-6 py-3 rounded-lg hover:bg-[#2d6ead] w-full disabled:opacity-50"
            >
              {cameraReady ? "I'm ready" : 'Starting camera…'}
            </button>
          ) : (
            <button
              onClick={() => setCountdown(null)}
              className="mt-4 bg-gray-100 text-gray-600 text-sm font-medium px-6 py-3 rounded-lg hover:bg-gray-200 w-full"
            >
              Cancel and reposition
            </button>
          )}
        </div>
      )}

      {step === 'submitting' && (
        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500">Checking your photos…</p>
        </div>
      )}

      {step === 'done' && (
        <div className="mt-10 text-center max-w-sm">
          <p className="text-lg font-medium text-gray-900">Verified! ✓</p>
          <p className="text-sm text-gray-500 mt-2">
            Thanks — you&apos;re all set. Your driver will bring your keys out now.
          </p>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
