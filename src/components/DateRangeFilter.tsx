'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export type DateRangePreset = { label: string; href: string; isCurrent: boolean }

export default function DateRangeFilter({
  presets,
  baseHref,
  customStart,
  customEnd,
  isCustomActive,
  activeLabel,
}: {
  presets: DateRangePreset[]
  baseHref: string
  customStart?: string
  customEnd?: string
  isCustomActive: boolean
  activeLabel: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(isCustomActive)
  const [start, setStart] = useState(customStart ?? '')
  const [end, setEnd] = useState(customEnd ?? '')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCustom(isCustomActive)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isCustomActive])

  function applyCustom() {
    if (!start || !end) return
    router.push(`${baseHref}?start=${start}&end=${end}`)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50"
      >
        {activeLabel}
        <span className="text-gray-400 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 border border-gray-200 rounded-lg bg-white shadow-lg z-10 p-1">
          {presets.map((preset) => (
            <a
              key={preset.href}
              href={preset.href}
              className={`block text-sm px-3 py-2 rounded-md ${preset.isCurrent ? 'bg-blue-50 text-[#378ADD] font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {preset.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => setShowCustom((s) => !s)}
            className={`w-full text-left text-sm px-3 py-2 rounded-md ${isCustomActive ? 'bg-blue-50 text-[#378ADD] font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            Custom range
          </button>
          {showCustom && (
            <div className="px-3 py-2 space-y-2 border-t border-gray-100 mt-1">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5" />
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5" />
              <button
                type="button"
                onClick={applyCustom}
                disabled={!start || !end}
                className="w-full text-sm bg-[#378ADD] text-white rounded-lg px-3 py-1.5 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
