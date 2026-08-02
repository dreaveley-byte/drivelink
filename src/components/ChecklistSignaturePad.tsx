'use client'

import { useRef, useState } from 'react'

export default function ChecklistSignaturePad({
  onSave,
  saving = false,
}: {
  onSave: (blob: Blob) => void
  saving?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const point = 'touches' in e ? e.touches[0] : e
    return { x: point.clientX - rect.left, y: point.clientY - rect.top }
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    drawing.current = true
    const ctx = canvas.getContext('2d')
    const { x, y } = getPos(e, canvas)
    ctx?.beginPath()
    ctx?.moveTo(x, y)
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111827'
    const { x, y } = getPos(e, canvas)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawn(true)
  }

  function end() {
    drawing.current = false
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  function save() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (blob) {
        onSave(blob)
        clear()
      }
    }, 'image/png')
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={320}
        height={120}
        className="border border-gray-300 rounded-lg bg-white w-full touch-none"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!hasDrawn || saving}
          className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save signature'}
        </button>
        <button type="button" onClick={clear} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
          Clear
        </button>
      </div>
    </div>
  )
}
