'use client'

import { useState } from 'react'

export type ConditionMarker = { x: number; y: number; note: string }
export type ConditionData = { markers: ConditionMarker[]; cleanliness: number | null; smell: string }

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
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null)
  const [pendingNote, setPendingNote] = useState('')

  function handleDiagramClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPendingPoint({ x, y })
    setPendingNote('')
  }

  function confirmMarker() {
    if (!pendingPoint) return
    const newMarker = { ...pendingPoint, note: pendingNote.trim() || 'Damage' }
    onChange({ ...data, markers: [...data.markers, newMarker] })
    setPendingPoint(null)
    setPendingNote('')
  }

  function removeMarker(index: number) {
    onChange({ ...data, markers: data.markers.filter((_, i) => i !== index) })
  }

  function setCleanliness(value: number) {
    onChange({ ...data, cleanliness: value })
  }

  function setSmell(value: string) {
    onChange({ ...data, smell: value })
  }

  return (
    <div className="space-y-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
      <p className="text-xs text-gray-500">Tap the diagram to mark any damage</p>

      <div className="relative bg-white rounded-lg border border-gray-200">
        <svg
          viewBox="0 0 300 140"
          className="w-full cursor-crosshair"
          onClick={handleDiagramClick}
        >
          <path
            d="M20,100 L20,80 Q20,70 30,68 L70,55 Q90,35 120,35 L190,35 Q215,35 230,55 L270,68 Q280,70 280,80 L280,100 Z"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
          />
          <circle cx="70" cy="102" r="16" fill="none" stroke="#9ca3af" strokeWidth="2" />
          <circle cx="230" cy="102" r="16" fill="none" stroke="#9ca3af" strokeWidth="2" />
          <line x1="120" y1="35" x2="120" y2="60" stroke="#9ca3af" strokeWidth="1.5" />
          <line x1="190" y1="35" x2="190" y2="60" stroke="#9ca3af" strokeWidth="1.5" />

          {data.markers.map((m, i) => (
            <g key={i}>
              <circle cx={(m.x / 100) * 300} cy={(m.y / 140) * 140} r="6" fill="#dc2626" stroke="white" strokeWidth="1.5" />
              <text x={(m.x / 100) * 300} y={(m.y / 140) * 140 + 3.5} fontSize="8" fill="white" textAnchor="middle">
                {i + 1}
              </text>
            </g>
          ))}
          {pendingPoint && (
            <circle cx={(pendingPoint.x / 100) * 300} cy={(pendingPoint.y / 140) * 140} r="6" fill="#f59e0b" stroke="white" strokeWidth="1.5" />
          )}
        </svg>
      </div>

      {pendingPoint && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={pendingNote}
            onChange={(e) => setPendingNote(e.target.value)}
            placeholder="What's the damage? (e.g. scratch, dent)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
          <button type="button" onClick={confirmMarker} className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800">
            Add
          </button>
          <button type="button" onClick={() => setPendingPoint(null)} className="text-xs text-gray-500 px-2">
            Cancel
          </button>
        </div>
      )}

      {data.markers.length > 0 && (
        <div className="space-y-1">
          {data.markers.map((m, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-gray-600">
              <span>{i + 1}. {m.note}</span>
              <button type="button" onClick={() => removeMarker(i)} className="text-gray-400 hover:text-red-600">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-xs text-gray-500 mb-1">Cleanliness (1–5, 5 being great)</p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCleanliness(n)}
              className={`w-8 h-8 rounded-lg border text-sm ${
                data.cleanliness === n ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">Any smells? (e.g. none, smoke, pets)</p>
        <input
          defaultValue={data.smell}
          onBlur={(e) => setSmell(e.target.value)}
          placeholder="None"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        />
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-1">Additional notes</p>
        <textarea
          defaultValue={notes}
          onBlur={(e) => onNotesBlur(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {filePaths.length > 0 && (
        <div className="flex flex-wrap gap-2">
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
  )
}
