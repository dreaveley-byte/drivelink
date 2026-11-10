// Red flags on a job for requirements that need a specific driver capability.
// Shown on every job while drivers' capability answers are still being filled in.
export default function JobRequirementFlags({
  job,
}: {
  job: { vehicle_transmission?: string | null; second_vehicle_transmission?: string | null; vehicle_mode?: string | null }
}) {
  const manual = job.vehicle_transmission === 'manual' || job.second_vehicle_transmission === 'manual'
  const towing = job.vehicle_mode === 'towed'
  if (!manual && !towing) return null
  return (
    <div className="flex flex-wrap gap-1.5 mb-1.5">
      {manual && <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-full px-2.5 py-0.5">Manual transmission required</span>}
      {towing && <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-300 rounded-full px-2.5 py-0.5">Towing required</span>}
    </div>
  )
}
