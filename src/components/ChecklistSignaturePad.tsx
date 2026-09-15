'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

export default function ChecklistSignaturePad({
  onSave,
  saving = false,
}: {
  onSave: (blob: Blob) => void
  saving?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  // Rotating the phone to landscape gives a much better signing surface than
  // the narrow portrait width, so the pad expands to fill the screen when
  // the phone is turned sideways, rather than staying squeezed into the
  // checklist card at whatever width portrait mode happened to give it.
  const [isLandscape, setIsLandscape] = useState(false)

  // The canvas element has two separate sizes: its drawing-buffer
  // resolution (the width/height attributes) and however big it actually
  // renders on screen (controlled by CSS, e.g. w-full). If those two don't
  // match, every touch/mouse coordinate - which is measured in on-screen
  // CSS pixels via getBoundingClientRect() - ends up mapped to the wrong
  // spot in the drawing buffer, so the line appears offset from wherever
  // the finger actually is. Fix: size the drawing buffer to match the
  // actual rendered size exactly (scaled for device pixel ratio so it
  // stays crisp), every time the pad's on-screen size changes.
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const dpr = window.devicePixelRatio || 1
    const newWidth = Math.round(rect.width * dpr)
    const newHeight = Math.round(rect.height * dpr)
    // Skip re-applying an identical size - setting width/height on a
    // canvas always clears it, even to the same value, which would
    // otherwise wipe an in-progress signature on spurious observer
    // firings that report no real change.
    if (canvas.width === newWidth && canvas.height === newHeight) return
    canvas.width = newWidth
    canvas.height = newHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#111827'
    }
    setHasDrawn(false)
  }, [])

  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape)')
    setIsLandscape(mql.matches)
    const handleOrientationChange = () => setIsLandscape(mql.matches)
    mql.addEventListener('change', handleOrientationChange)
    return () => mql.removeEventListener('change', handleOrientationChange)
  }, [])

  // A one-time requestAnimationFrame after switching layouts (portrait vs.
  // the landscape overlay) turned out not to be reliable: on-device
  // rotation, the browser's own viewport/chrome adjustment can settle
  // noticeably later than a single frame after the orientation change
  // fires, especially on iOS Safari - so the canvas was measuring itself
  // against a stale size and ended up calibrated to the PRE-rotation
  // dimensions, which is exactly why touches landed nowhere near the
  // drawn line specifically in landscape. A ResizeObserver instead reacts
  // to the container's REAL rendered size settling, however long that
  // actually takes, so the canvas is always calibrated to what's actually
  // on screen rather than a one-frame guess.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    resizeCanvas()
    const observer = new ResizeObserver(() => resizeCanvas())
    observer.observe(container)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLandscape])

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
        if (isLandscape) setIsLandscape(false)
      }
    }, 'image/png')
  }

  // Prevents the browser's text-selection/callout behavior from
  // triggering during a signing touch-drag. touch-action: none (the
  // touch-none class) stops scrolling/zooming, but on some mobile
  // browsers - Safari in particular - a press-and-drag can still be
  // interpreted as a text-selection gesture unless selection itself is
  // explicitly disabled, which shows up as background text getting
  // highlighted mid-signature instead of the line actually drawing.
  const noSelectStyle: React.CSSProperties = {
    WebkitUserSelect: 'none',
    userSelect: 'none',
    WebkitTouchCallout: 'none',
  }

  const canvasEl = (
    <div ref={containerRef} className={isLandscape ? 'flex-1 min-h-0' : 'h-32'} style={noSelectStyle}>
      <canvas
        ref={canvasRef}
        className="border border-gray-300 rounded-lg bg-white w-full h-full touch-none"
        style={noSelectStyle}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
    </div>
  )

  const buttons = (
    <div className="flex gap-2" style={noSelectStyle}>
      <button
        type="button"
        onClick={save}
        disabled={!hasDrawn || saving}
        className="text-xs bg-[#378ADD] text-white px-3 py-1.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save signature'}
      </button>
      <button type="button" onClick={clear} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">
        Clear
      </button>
    </div>
  )

  if (isLandscape) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col p-4 gap-3" style={noSelectStyle}>
        <p className="text-sm text-gray-500 text-center">Sign below</p>
        {canvasEl}
        {buttons}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400">Tip: turn your phone sideways for a bigger signing area.</p>
      {canvasEl}
      {buttons}
    </div>
  )
}
