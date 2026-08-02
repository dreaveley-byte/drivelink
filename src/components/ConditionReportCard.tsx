'use client'

import { useState } from 'react'

export type ConditionPanel = 'driver' | 'passenger'
export type ConditionMarker = { panel: ConditionPanel; x: number; y: number; note: string }
export type ConditionData = { markers: ConditionMarker[]; cleanliness: number | null; smell: string }

const PANELS: { key: ConditionPanel; label: string }[] = [
  { key: 'driver', label: "Driver's side" },
  { key: 'passenger', label: "Passenger's side" },
]

// A more detailed 3/4-profile car outline — roofline, window line, wheel wells,
// door seams — so it actually reads as a car rather than an abstract shape.
function CarOutline() {
  return (
    <>
      <path
        d="M15,105 L15,82 Q15,74 24,71 L55,62 Q65,45 85,38 L100,33 Q120,28 145,28 L215,28
           Q245,28 262,45 L272,62 L282,66 Q292,68 292,80 L292,105 Z"
        fill="none" stroke="#6b7280" strokeWidth="2" strokeLinejoin="round"
      />
      {/* Window line */}
      <path
        d="M62,62 L88,42 Q100,36 118,34 L140,34 L140,62 Z"
        fill="none" stroke="#9ca3af" strokeWidth="1.3"
      />
      <path
        d="M148,34 L212,34 Q232,34 248,48 L262,62 L148,62 Z"
        fill="none" stroke="#9ca3af" strokeWidth="1.3"
      />
      <line x1="140" y1="34" x2="140" y2="62" stroke="#9ca3af" strokeWidth="1.3" />
      {/* Door seams */}
      <line x1="118" y1="62" x2="115" y2="105" stroke="#9ca3af" strokeWidth="1" />
      <line x1="205" y1="62" x2="205" y2="105" stroke="#9ca3af" strokeWidth="1" />
      {/* Door handles */}
      <line x1="150" y1="72" x2="165" y2="72" stroke="#9ca3af" strokeWidth="1.3" />
      <line x1="230" y1="72" x2="245" y2="72" stroke="#9ca3af" strokeWidth="1.3" />
      {/* Wheel wells */}
      <path d="M45,105 A32,32 0 0 1 109,105" fill="none" stroke="#6b7280" strokeWidth="2" />
      <path d="M198,105 A32,32 0 0 1 262,105" fill="none" stroke="#6b7280" strokeWidth="2" />
      <circle cx="77" cy="106" r="16" fill="none" stroke="#6b7280" strokeWidth="2" />
      <circle cx="230" cy="106" r="16" fill="none" stroke="#6b7280" strokeWidth="2" />
      {/* Mirror */}
      <path d="M100,58 L92,52 L96,48 L104,54 Z" fill="none" stroke="#9ca3af" strokeWidth="1" />
    </>
  )
}

export default function ConditionReportCard({
  data,
  onChange,
  notes,
  onNotesBlur,
  filePaths,
  fileUrls,
  onUploadPhotos,
  onDeleteFile,
  uploading,
}: {
  data: ConditionData
  onChange: (data: ConditionData) => void
  notes: string
  onNotesBlur: (value: string) => void
  filePaths: string[]
  fileUrls: Record<string, string>
  onUploadPhotos: (files: File[]) => void
  onDeleteFile: (path: string) => void
  uploading: boolean
}) {
  // Index (in data.markers) of the marker currently being labeled, so the note
  // input tracks a specific, already-placed marker rather than a shared "pending" dot.
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  function handleDiagramClick(panel: ConditionPanel, e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    // Every click immediately and permanently places its own marker — nothing
    // "follows" a later click, each mark is independent from the moment it's placed.
    const newMarkers = [...data.markers, { panel, x, y, note: '' }]
    onChange({ ...data, markers: newMarkers })
    setEditingIndex(newMarkers.length - 1)
  }

  function updateMarkerNote(index: number, note: string) {
    const newMarkers = data.markers.map((m, i) => (i === index ? { ...m, note } : m))
    onChange({ ...data, markers: newMarkers })
  }

  function removeMarker(index: number) {
    onChange({ ...data, markers: data.markers.filter((_, i) => i !== index) })
    if (editingIndex === index) setEditingIndex(null)
  }

  return (
    <div className="space-y-4 border border-gray-200 rounded-lg p-3 bg-gray-50">
      {/* 1. Cleanliness */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Cleanliness (1–5, 5 being great)</p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ ...data, cleanliness: n })}
              className={`w-8 h-8 rounded-lg border text-sm ${
                data.cleanliness === n ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Diagram */}
      <div>
        <p className="text-xs text-gray-500 mb-1.5">Tap either side to mark any damage</p>
        <div className="grid grid-cols-1 gap-2">
          {PANELS.map(({ key, label }) => (
            <div key={key} className="bg-white rounded-lg border border-gray-200 p-1.5">
              <p className="text-[10px] text-gray-400 text-center mb-0.5">{label}</p>
              <svg viewBox="0 0 305 115" className="w-full cursor-crosshair" onClick={(e) => handleDiagramClick(key, e)}>
                <CarOutline />
                {data.markers.map((m, i) =>
                  m.panel === key ? (
                    <g key={i}>
                      <circle
                        cx={(m.x / 100) * 305}
                        cy={(m.y / 115) * 115}
                        r="7"
                        fill={editingIndex === i ? '#f59e0b' : '#dc2626'}
                        stroke="white"
                        strokeWidth="1.5"
                      />
                      <text x={(m.x / 100) * 305} y={(m.y / 115) * 115 + 3} fontSize="8" fill="white" textAnchor="middle">
                        {i + 1}
                      </text>
                    </g>
                  ) : null
                )}
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* 3. What's the damage — inline editor for the marker just placed, plus the full list */}
      {data.markers.length > 0 && (
        <div className="space-y-1.5">
          {editingIndex != null && data.markers[editingIndex] && (
            <div className="flex gap-2">
              <input
                autoFocus
                value={data.markers[editingIndex].note}
                onChange={(e) => updateMarkerNote(editingIndex, e.target.value)}
                onBlur={() => setEditingIndex(null)}
                placeholder="What's the damage? (e.g. scratch, dent)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => removeMarker(editingIndex)}
                className="text-xs text-gray-500 px-2"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="space-y-1">
            {data.markers.map((m, i) =>
              i === editingIndex ? null : (
                <div key={i} className="flex items-center justify-between text-xs text-gray-600">
                  <button type="button" onClick={() => setEditingIndex(i)} className="text-left hover:text-gray-900">
                    {i + 1}. {PANELS.find((p) => p.key === m.panel)?.label}: {m.note || '(tap to describe)'}
                  </button>
                  <button type="button" onClick={() => removeMarker(i)} className="text-gray-400 hover:text-red-600 ml-2">
                    ✕
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* 4. Damage photos */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Damage photos</p>
        {filePaths.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {filePaths.map((path) => (
              <div key={path} className="relative">
                {fileUrls[path] ? (
                  <a href={fileUrls[path]} target="_blank" rel="noopener noreferrer">
                    <img src={fileUrls[path]} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                  </a>
                ) : (
                  <div className="w-14 h-14 rounded-lg border border-gray-200 bg-gray-100" />
                )}
                <button
                  type="button"
                  onClick={() => onDeleteFile(path)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="inline-block text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 cursor-pointer">
          {uploading ? 'Uploading...' : 'Take / upload photo'}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            multiple
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : []
              if (files.length > 0) onUploadPhotos(files)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {/* 5. Smells */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Any smells? (e.g. none, smoke, pets)</p>
        <input
          defaultValue={data.smell}
          onBlur={(e) => onChange({ ...data, smell: e.target.value })}
          placeholder="None"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        />
      </div>

      {/* 6. Additional notes */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Additional notes</p>
        <textarea
          defaultValue={notes}
          onBlur={(e) => onNotesBlur(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>
    </div>
  )
}
