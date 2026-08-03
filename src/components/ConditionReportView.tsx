type ConditionPanel = 'driver' | 'passenger'
type ConditionMarker = { panel: ConditionPanel; x: number; y: number; note: string }
type ConditionData = { markers: ConditionMarker[]; cleanliness: number | null; smell: string }

const PANELS: { key: ConditionPanel; label: string; image: string }[] = [
  { key: 'driver', label: "Driver's side", image: '/condition-report/driver-side.jpg' },
  { key: 'passenger', label: "Passenger's side", image: '/condition-report/passenger-side.jpg' },
]

// Read-only rendering of a completed condition report: shows the marked-up
// vehicle diagram exactly as the driver left it, for dealers/admins on the receipt.
export default function ConditionReportView({ data }: { data: ConditionData }) {
  if (!data.markers || data.markers.length === 0) return null

  return (
    <div className="mt-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
      <div className="grid grid-cols-2 gap-2">
        {PANELS.map(({ key, label, image }) => {
          const panelMarkers = data.markers.filter((m) => m.panel === key)
          return (
            <div key={key} className="bg-white rounded-lg border border-gray-200 p-1.5">
              <p className="text-[10px] text-gray-400 text-center mb-0.5">{label}</p>
              <div className="relative w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={label} className="w-full rounded" draggable={false} />
                {panelMarkers.map((m, i) => (
                  <div
                    key={i}
                    className="absolute w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-medium -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow"
                    style={{ left: `${m.x}%`, top: `${m.y}%`, backgroundColor: '#dc2626' }}
                  >
                    {data.markers.indexOf(m) + 1}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <ul className="text-xs text-gray-600 mt-2 list-disc list-inside">
        {data.markers.map((m, i) => (
          <li key={i}>
            {i + 1}. {PANELS.find((p) => p.key === m.panel)?.label}: {m.note || '(no description)'}
          </li>
        ))}
      </ul>
    </div>
  )
}
