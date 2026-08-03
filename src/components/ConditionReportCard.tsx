'use client'

import { useState } from 'react'

export type ConditionPanel = 'driver' | 'passenger'
export type ConditionMarker = { panel: ConditionPanel; x: number; y: number; note: string }
export type ConditionData = { markers: ConditionMarker[]; cleanliness: number | null; smell: string }

const PANELS: { key: ConditionPanel; label: string; image: string }[] = [
  { key: 'driver', label: "Driver's side", image: '/condition-report/driver-side.jpg' },
  { key: 'passenger', label: "Passenger's side", image: '/condition-report/passenger-side.jpg' },
]

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

  function handleDiagramClick(panel: ConditionPanel, e: React.MouseEvent<HTMLDivElement>) {
    const container = e.currentTarget
    const rect = container.getBoundingClientRect()
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
                data.cleanliness === n ? 'bg-[#378ADD] text-white border-[#378ADD]' : 'border-gray-300 text-gray-600'
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
          {PANELS.map(({ key, label, image }) => (
            <div key={key} className="bg-white rounded-lg border border-gray-200 p-1.5">
              <p className="text-[10px] text-gray-400 text-center mb-0.5">{label}</p>
              <div
                className="relative w-full cursor-crosshair select-none"
                onClick={(e) => handleDiagramClick(key, e)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={label} className="w-full rounded pointer-events-none" draggable={false} />
                {data.markers.map((m, i) =>
                  m.panel === key ? (
                    <div
                      key={i}
                      className="absolute w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-medium -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow"
                      style={{
                        left: `${m.x}%`,
                        top: `${m.y}%`,
                        backgroundColor: editingIndex === i ? '#f59e0b' : '#dc2626',
                      }}
                    >
                      {i + 1}
                    </div>
                  ) : null
                )}
              </div>
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
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#378ADD] text-white text-xs flex items-center justify-center hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="inline-block text-xs bg-[#378ADD] text-white px-3 py-1.5 rounded-lg hover:bg-[#2d6ead] cursor-pointer">
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
