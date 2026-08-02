'use client'

import { useState } from 'react'

export type ConditionPanel = 'front' | 'rear' | 'driver' | 'passenger'
export type ConditionMarker = { panel: ConditionPanel; x: number; y: number; note: string }
export type ConditionData = { markers: ConditionMarker[]; cleanliness: number | null; smell: string }

const PANELS: { key: ConditionPanel; label: string }[] = [
  { key: 'driver', label: "Driver's side" },
  { key: 'passenger', label: "Passenger's side" },
  { key: 'front', label: 'Front' },
  { key: 'rear', label: 'Rear' },
]

function SidePath() {
  return (
    <>
      <path
        d="M20,100 L20,80 Q20,70 30,68 L70,55 Q90,35 120,35 L190,35 Q215,35 230,55 L270,68 Q280,70 280,80 L280,100 Z"
        fill="none" stroke="#9ca3af" strokeWidth="2"
      />
      <circle cx="70" cy="102" r="16" fill="none" stroke="#9ca3af" strokeWidth="2" />
      <circle cx="230" cy="102" r="16" fill="none" stroke="#9ca3af" strokeWidth="2" />
      <line x1="120" y1="35" x2="120" y2="60" stroke="#9ca3af" strokeWidth="1.5" />
      <line x1="190" y1="35" x2="190" y2="60" stroke="#9ca3af" strokeWidth="1.5" />
    </>
  )
}

function FrontPath() {
  return (
    <>
      <path
        d="M80,110 L80,60 Q80,40 110,35 L190,35 Q220,40 220,60 L220,110 Z"
        fill="none" stroke="#9ca3af" strokeWidth="2"
      />
      <rect x="95" y="60" width="30" height="18" rx="3" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
      <rect x="175" y="60" width="30" height="18" rx="3" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
      <rect x="130" y="85" width="40" height="14" rx="2" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
      <line x1="150" y1="35" x2="150" y2="110" stroke="#9ca3af" strokeWidth="1" />
    </>
  )
}

function RearPath() {
  return (
    <>
      <path
        d="M80,110 L80,65 Q80,42 110,38 L190,38 Q220,42 220,65 L220,110 Z"
        fill="none" stroke="#9ca3af" strokeWidth="2"
      />
      <rect x="90" y="65" width="26" height="16" rx="2" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
      <rect x="184" y="65" width="26" height="16" rx="2" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
      <rect x="125" y="95" width="50" height="10" rx="2" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
      <line x1="150" y1="38" x2="150" y2="110" stroke="#9ca3af" strokeWidth="1" />
    </>
  )
}

function panelPath(panel: ConditionPanel) {
  if (panel === 'front') return <FrontPath />
  if (panel === 'rear') return <RearPath />
  return <SidePath />
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
  const [pendingPoint, setPendingPoint] = useState<{ panel: ConditionPanel; x: number; y: number } | null>(null)
  const [pendingNote, setPendingNote] = useState('')

  function handleDiagramClick(panel: ConditionPanel, e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPendingPoint({ panel, x, y })
    setPendingNote('')
  }

  function confirmMarker() {
    if (!pendingPoint) return
    onChange({ ...data, markers: [...data.markers, { ...pendingPoint, note: pendingNote.trim() || 'Damage' }] })
    setPendingPoint(null)
    setPendingNote('')
  }

  function removeMarker(index: number) {
    onChange({ ...data, markers: data.markers.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
      <p className="text-xs text-gray-500">Tap any panel to mark damage on that side</p>

      <div className="grid grid-cols-2 gap-2">
        {PANELS.map(({ key, label }) => (
          <div key={key} className="bg-white rounded-lg border border-gray-200 p-1">
            <p className="text-[10px] text-gray-400 text-center mb-0.5">{label}</p>
            <svg viewBox="0 0 300 140" className="w-full cursor-crosshair" onClick={(e) => handleDiagramClick(key, e)}>
              {panelPath(key)}
              {data.markers.filter((m) => m.panel === key).map((m, i) => (
                <g key={i}>
                  <circle cx={(m.x / 100) * 300} cy={(m.y / 140) * 140} r="7" fill="#dc2626" stroke="white" strokeWidth="1.5" />
                </g>
              ))}
              {pendingPoint?.panel === key && (
                <circle cx={(pendingPoint.x / 100) * 300} cy={(pendingPoint.y / 140) * 140} r="7" fill="#f59e0b" stroke="white" strokeWidth="1.5" />
              )}
            </svg>
          </div>
        ))}
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
              <span>{PANELS.find((p) => p.key === m.panel)?.label}: {m.note}</span>
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

      <div>
        <p className="text-xs text-gray-500 mb-1">Any smells? (e.g. none, smoke, pets)</p>
        <input
          defaultValue={data.smell}
          onBlur={(e) => onChange({ ...data, smell: e.target.value })}
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
