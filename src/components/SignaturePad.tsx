'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

export default function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  // See ChecklistSignaturePad for why this matters: without it, the
  // canvas's fixed drawing-buffer resolution (previously 500x150) gets
  // stretched by CSS to whatever width the device actually renders it at,
  // so touch/mouse coordinates (measured in on-screen pixels) land in the
  // wrong spot in the buffer - the signature ends up warped or offset from
  // where the finger actually is.
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#111827'
    }
  }, [])

  useEffect(() => {
    const raf = requestAnimationFrame(resizeCanvas)
    return () => cancelAnimationFrame(raf)
  }, [resizeCanvas])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const touch = e.touches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawn(true)
  }

  function end() {
    if (!isDrawing) return
    setIsDrawing(false)
    if (hasDrawn) {
      onChange(canvasRef.current!.toDataURL('image/png'))
    }
  }

  function clear() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    onChange(null)
  }

  return (
    <div>
      <div ref={containerRef} className="h-36">
        <canvas
          ref={canvasRef}
          className="w-full h-full border border-gray-300 rounded-lg touch-none bg-white"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <button
        type="button"
        onClick={clear}
        className="text-xs text-gray-500 mt-1 hover:text-gray-900"
      >
        Clear signature
      </button>
    </div>
  )
}
