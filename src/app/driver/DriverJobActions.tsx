'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import { formatCents } from '@/lib/pricing'
import { getDefaultChecklist, getDocumentTextForLabel, buildDeliveryDisclosureText, type ChecklistItemType, type IncludedItems } from '@/lib/checklist'
import ChecklistSignaturePad from '@/components/ChecklistSignaturePad'
import ConditionReportCard, { type ConditionData } from '@/components/ConditionReportCard'

type Job = {
  id: string
  status: string
  scheduled_for: string | null
  estimated_duration_minutes: number | null
  pickup_address: string
  dropoff_address: string
  recipient_name: string | null
  customer_full_name: string | null
  estimated_driver_pay_cents: number | null
  estimated_distance_km: number | null
  vehicle_year: number | null
  vehicle_make: string | null
  vehicle_model: string | null
  stock_number: string | null
  vin: string | null
  is_trade_in_pickup: boolean | null
  is_first_nations_delivery: boolean | null
  out_of_province_inspection: boolean | null
  key_count: number | null
  has_wheel_lock: boolean | null
  has_charging_cables: boolean | null
  other_included_items: string | null
  customer_address: string | null
  customer_phone: string | null
  delivery_gps_lat: number | null
  delivery_gps_lng: number | null
  delivery_gps_at: string | null
  job_types: { name: string }[] | { name: string } | null
  organizations: { name: string; address: string | null; phone: string | null }[] | { name: string; address: string | null; phone: string | null } | null
}

// Pulls a city out of a full address string like "123 Main St, Coquitlam, BC, Canada".
// Falls back to the full address if it doesn't look like a standard formatted address.
function extractCity(address: string): string {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 3) return parts[parts.length - 3]
  return address
}

// Supabase's inferred type for joined tables can come back as either an array
// or a single object depending on the query shape — normalize to a plain value.
function joinName(value: { name: string }[] | { name: string } | null): string | null {
  if (!value) return null
  return Array.isArray(value) ? value[0]?.name ?? null : value.name
}

function joinOrg(
  value: { name: string; address: string | null; phone: string | null }[] | { name: string; address: string | null; phone: string | null } | null
) {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

type ChecklistItem = {
  id: string
  label: string
  item_type: ChecklistItemType
  completed_at: string | null
  file_paths: string[]
  notes: string | null
  condition_data: ConditionData | null
}

const nextStatus: Record<string, string> = {
  assigned: 'picked_up',
  picked_up: 'in_progress',
  in_progress: 'delivered',
  delivered: 'completed',
}

const previousStatus: Record<string, string> = {
  picked_up: 'assigned',
  in_progress: 'picked_up',
  delivered: 'in_progress',
  completed: 'delivered',
}

const nextStatusLabel: Record<string, string> = {
  assigned: 'Mark picked up',
  picked_up: 'Mark in progress',
  in_progress: 'Mark delivered',
  delivered: 'Mark completed',
}

const statusLabels: Record<string, string> = {
  awaiting_driver: 'Awaiting Driver',
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  in_progress: 'In Progress',
  delivered: 'Delivered',
  completed: 'Completed',
}

export default function DriverJobActions({
  job,
  isActive,
  disabled = false,
}: {
  job: Job
  isActive: boolean
  disabled?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const HEAVY_TYPES = ['photo', 'video', 'upload', 'signature', 'condition_report']

  async function refreshFileUrls(paths: string[]) {
    if (paths.length === 0) return
    const supabase = createClient()
    const entries = await Promise.all(
      paths.map(async (path) => {
        const { data } = await supabase.storage.from('job-media').createSignedUrl(path, 60 * 60)
        return [path, data?.signedUrl ?? ''] as const
      })
    )
    setFileUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
  }

  useEffect(() => {
    if (!isActive) return
    const supabase = createClient()

    async function loadChecklist() {
      const { data } = await supabase
        .from('job_checklist_items')
        .select('id, label, item_type, completed_at, file_paths, notes, condition_data')
        .eq('job_id', job.id)
        .order('sort_order')

      if (data && data.length > 0) {
        setChecklist(data)
        refreshFileUrls(data.flatMap((i) => i.file_paths))
        return
      }

      // Older jobs claimed before this feature existed won't have items yet — backfill them.
      const defaults = getDefaultChecklist(joinName(job.job_types), !!job.is_trade_in_pickup, !!job.is_first_nations_delivery, {
      keyCount: job.key_count,
      hasWheelLock: !!job.has_wheel_lock,
      hasChargingCables: !!job.has_charging_cables,
      otherItems: job.other_included_items,
    }, !!job.out_of_province_inspection)
      const rows = defaults.map((d, i) => ({ job_id: job.id, label: d.label, item_type: d.type, sort_order: i }))
      const { data: created } = await supabase
        .from('job_checklist_items')
        .insert(rows)
        .select('id, label, item_type, completed_at, file_paths, notes, condition_data')
      if (created) setChecklist(created)
    }

    loadChecklist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, job.id])

  async function toggleChecklistItem(item: ChecklistItem) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const nowCompleting = !item.completed_at

    setChecklist((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, completed_at: nowCompleting ? new Date().toISOString() : null } : i))
    )

    await supabase
      .from('job_checklist_items')
      .update({
        completed_at: nowCompleting ? new Date().toISOString() : null,
        completed_by: nowCompleting ? user?.id : null,
      })
      .eq('id', item.id)
  }

  async function uploadFilesForItem(item: ChecklistItem, files: File[]) {
    setUploadingItemId(item.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const newPaths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${job.id}/${item.id}-${Date.now()}-${i}.${ext}`
      const { error } = await supabase.storage.from('job-media').upload(path, file, { upsert: true })
      if (!error) newPaths.push(path)
    }

    const updatedPaths = [...item.file_paths, ...newPaths]
    const shouldComplete = item.item_type === 'condition_report'
      ? !!(item.notes && item.notes.trim().length > 0)
      : true

    setChecklist((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, file_paths: updatedPaths, completed_at: shouldComplete ? new Date().toISOString() : i.completed_at }
          : i
      )
    )

    await supabase
      .from('job_checklist_items')
      .update({
        file_paths: updatedPaths,
        ...(shouldComplete ? { completed_at: new Date().toISOString(), completed_by: user?.id } : {}),
      })
      .eq('id', item.id)

    refreshFileUrls(newPaths)
    setUploadingItemId(null)
    if (item.item_type !== 'condition_report') setExpandedId(null)
  }

  async function uploadSignatureForItem(item: ChecklistItem, blob: Blob) {
    setUploadingItemId(item.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const path = `${job.id}/${item.id}-${Date.now()}-signature.png`
    const { error } = await supabase.storage.from('job-media').upload(path, blob, { upsert: true, contentType: 'image/png' })

    if (!error) {
      const updatedPaths = [...item.file_paths, path]
      setChecklist((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, file_paths: updatedPaths, completed_at: new Date().toISOString() } : i))
      )
      await supabase
        .from('job_checklist_items')
        .update({ file_paths: updatedPaths, completed_at: new Date().toISOString(), completed_by: user?.id })
        .eq('id', item.id)
      refreshFileUrls([path])
    }
    setUploadingItemId(null)
    setExpandedId(null)
  }

  async function saveNotesForItem(item: ChecklistItem, notes: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const shouldComplete = notes.trim().length > 0 && item.file_paths.length > 0

    setChecklist((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, notes, completed_at: shouldComplete ? (i.completed_at ?? new Date().toISOString()) : i.completed_at }
          : i
      )
    )

    await supabase
      .from('job_checklist_items')
      .update({
        notes,
        ...(shouldComplete && !item.completed_at
          ? { completed_at: new Date().toISOString(), completed_by: user?.id }
          : {}),
      })
      .eq('id', item.id)
  }

  async function deleteFileFromItem(item: ChecklistItem, path: string) {
    const supabase = createClient()
    await supabase.storage.from('job-media').remove([path])

    const updatedPaths = item.file_paths.filter((p) => p !== path)
    // If this item required a file to be considered complete and none remain, un-complete it.
    const needsFile = item.item_type !== 'check'
    const stillComplete = needsFile
      ? updatedPaths.length > 0 && (item.item_type !== 'condition_report' || !!(item.notes && item.notes.trim().length > 0))
      : !!item.completed_at

    setChecklist((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, file_paths: updatedPaths, completed_at: stillComplete ? i.completed_at : null }
          : i
      )
    )

    await supabase
      .from('job_checklist_items')
      .update({ file_paths: updatedPaths, ...(stillComplete ? {} : { completed_at: null, completed_by: null }) })
      .eq('id', item.id)
  }

  async function setTristateValue(item: ChecklistItem, value: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    setChecklist((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, notes: value, completed_at: new Date().toISOString() } : i))
    )

    await supabase
      .from('job_checklist_items')
      .update({ notes: value, completed_at: new Date().toISOString(), completed_by: user?.id })
      .eq('id', item.id)
  }

  async function saveConditionData(item: ChecklistItem, conditionData: ConditionData) {
    const supabase = createClient()
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, condition_data: conditionData } : i)))
    await supabase.from('job_checklist_items').update({ condition_data: conditionData }).eq('id', item.id)
  }

  async function saveSimpleTextValue(item: ChecklistItem, value: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const shouldComplete = value.trim().length > 0

    setChecklist((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, notes: value, completed_at: shouldComplete ? (i.completed_at ?? new Date().toISOString()) : null }
          : i
      )
    )

    await supabase
      .from('job_checklist_items')
      .update({
        notes: value,
        completed_at: shouldComplete ? new Date().toISOString() : null,
        completed_by: shouldComplete ? user?.id : null,
      })
      .eq('id', item.id)
  }

  async function claimJob() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('jobs')
      .update({ driver_id: user.id, status: 'assigned' })
      .eq('id', job.id)

    await supabase.from('job_status_events').insert({
      job_id: job.id,
      status: 'assigned',
      changed_by: user.id,
    })

    const defaults = getDefaultChecklist(joinName(job.job_types), !!job.is_trade_in_pickup, !!job.is_first_nations_delivery, {
      keyCount: job.key_count,
      hasWheelLock: !!job.has_wheel_lock,
      hasChargingCables: !!job.has_charging_cables,
      otherItems: job.other_included_items,
    }, !!job.out_of_province_inspection)
    await supabase.from('job_checklist_items').insert(
      defaults.map((d, i) => ({ job_id: job.id, label: d.label, item_type: d.type, sort_order: i }))
    )

    router.refresh()
    setLoading(false)
  }

  function getCurrentPositionSafe(): Promise<GeolocationPosition | null> {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        resolve(null)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      )
    })
  }

  async function advanceStatus() {
    const newStatus = nextStatus[job.status]
    if (!newStatus) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const jobUpdate: Record<string, string | number> = { status: newStatus }

    if (newStatus === 'picked_up' || newStatus === 'delivered') {
      const pos = await getCurrentPositionSafe()
      if (pos) {
        const prefix = newStatus === 'picked_up' ? 'pickup' : 'delivery'
        jobUpdate[`${prefix}_gps_lat`] = pos.coords.latitude
        jobUpdate[`${prefix}_gps_lng`] = pos.coords.longitude
        jobUpdate[`${prefix}_gps_at`] = new Date().toISOString()
      }
    }

    await supabase.from('jobs').update(jobUpdate).eq('id', job.id)
    await supabase.from('job_status_events').insert({
      job_id: job.id,
      status: newStatus,
      changed_by: user?.id,
    })

    if (newStatus === 'in_progress') {
      fetch('/api/customer-sms/notify-in-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      }).catch(() => {})
    }

    router.refresh()
    setLoading(false)
  }

  async function goBackStatus() {
    const prevStatus = previousStatus[job.status]
    if (!prevStatus) return
    if (!confirm(`Go back to "${statusLabels[prevStatus]}"? This won't delete anything you've already filled in.`)) return

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('jobs').update({ status: prevStatus }).eq('id', job.id)
    await supabase.from('job_status_events').insert({
      job_id: job.id,
      status: prevStatus,
      changed_by: user?.id,
    })

    router.refresh()
    setLoading(false)
  }

  async function releaseJob() {
    if (!confirm('Release this job back to the pool? Another driver will be able to claim it. Anything you\'ve already filled in stays saved.')) return

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('jobs').update({ driver_id: null, status: 'awaiting_driver' }).eq('id', job.id)
    await supabase.from('job_status_events').insert({
      job_id: job.id,
      status: 'awaiting_driver',
      changed_by: user?.id,
    })
    if (user?.id) {
      await supabase.from('job_releases').insert({
        job_id: job.id,
        driver_id: user.id,
        released_from_status: job.status,
      })
    }

    router.refresh()
    setLoading(false)
  }

  const canReleaseByStatus = job.status === 'assigned' || job.status === 'picked_up'
  const withinReleaseWindow = job.scheduled_for
    ? new Date(job.scheduled_for).getTime() - Date.now() < 24 * 60 * 60 * 1000
    : false
  const canSelfRelease = canReleaseByStatus && !withinReleaseWindow

  function addToCalendar() {
    if (!job.scheduled_for) return
    const start = new Date(job.scheduled_for)
    const end = new Date(start.getTime() + (job.estimated_duration_minutes ? job.estimated_duration_minutes * 2 : 120) * 60000)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const title = `${joinName(job.job_types) ?? 'Drivflo job'} — ${[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')}`
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Drivflo//EN',
      'BEGIN:VEVENT',
      `UID:${job.id}@drivflo`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${title}`,
      `LOCATION:${job.pickup_address}`,
      `DESCRIPTION:Pickup: ${job.pickup_address}\\nDropoff: ${job.dropoff_address}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `drivflo-job-${job.id.slice(0, 8)}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="border border-gray-200 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between mb-1">
        <div>
          {job.scheduled_for && (
            <p className="text-xs font-semibold text-blue-700">
              {new Date(job.scheduled_for).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
          <p className="text-xs text-blue-600">To: {extractCity(job.dropoff_address)}</p>
        </div>
        {isActive && job.scheduled_for && (
          <button
            onClick={addToCalendar}
            className="text-xs text-gray-500 hover:text-gray-900 underline whitespace-nowrap"
          >
            Add to calendar
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">{joinName(job.job_types)}</p>
        {(job.vehicle_year || job.vehicle_make || job.vehicle_model || job.stock_number) && (
          <p className="text-xs text-gray-600 mt-0.5">
            {[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')}
            {job.stock_number && ` · Stock #${job.stock_number}`}
          </p>
        )}
        {joinName(job.organizations) && (
          <p className="text-xs text-gray-600 mt-0.5">{joinName(job.organizations)}</p>
        )}
        <p className="text-xs text-gray-500 mt-0.5">
          Drop-off: {extractCity(job.dropoff_address)}
          {job.estimated_distance_km != null && ` · ${Math.round(job.estimated_distance_km)} km round trip`}
        </p>
        {(job.customer_full_name || job.recipient_name) && (
          <p className="text-xs text-gray-400 mt-0.5">
            Customer: {job.customer_full_name || job.recipient_name}
          </p>
        )}
        {job.estimated_driver_pay_cents != null && (
          <p className="text-xs text-green-700 font-medium mt-0.5">
            Est. pay: {formatCents(job.estimated_driver_pay_cents)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isActive && previousStatus[job.status] ? (
          <button
            onClick={goBackStatus}
            disabled={loading}
            title="Tap to go back a step"
            className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            ← {statusLabels[job.status] ?? job.status}
          </button>
        ) : (
          <span className="text-xs border border-gray-300 text-gray-700 rounded-full px-2.5 py-1">
            {statusLabels[job.status] ?? job.status}
          </span>
        )}

        {isActive && nextStatus[job.status] && (
          <button
            onClick={advanceStatus}
            disabled={loading}
            className="text-xs bg-[#378ADD] text-white px-3 py-1.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
          >
            {loading ? '...' : nextStatusLabel[job.status]}
          </button>
        )}

        {!isActive && (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={claimJob}
              disabled={loading || disabled}
              className="text-xs bg-[#378ADD] text-white px-3 py-1.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
            >              {loading ? '...' : 'Claim'}
            </button>
            {disabled && (
              <span className="text-[10px] text-amber-600">Conflicts with another job</span>
            )}
          </div>
        )}
      </div>
      </div>

      {isActive && checklist.length > 0 && (() => {
        const currentPhase: 'Pickup' | 'Inspection' | 'Delivery' | 'None' =
          job.status === 'assigned' ? 'Pickup' :
          job.status === 'in_progress' ? 'Inspection' :
          job.status === 'delivered' ? 'Delivery' :
          'None'
        const hasPhases = checklist.some((i) => i.label.startsWith('Pickup:') || i.label.startsWith('Delivery:') || i.label.startsWith('Inspection:'))
        const visibleChecklist = hasPhases
          ? checklist.filter((item) => {
              if (item.label.startsWith('Pickup:')) return currentPhase === 'Pickup'
              if (item.label.startsWith('Inspection:')) return currentPhase === 'Inspection'
              if (item.label.startsWith('Delivery:')) return currentPhase === 'Delivery'
              return true
            })
          : checklist
        const pickupItems = checklist.filter((i) => i.label.startsWith('Pickup:'))
        const pickupDone = pickupItems.filter((i) => i.completed_at).length
        const inspectionItems = checklist.filter((i) => i.label.startsWith('Inspection:'))
        const inspectionDone = inspectionItems.filter((i) => i.completed_at).length

        if (hasPhases && currentPhase === 'None') return null
        if (hasPhases && visibleChecklist.length === 0) return null

        return (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          {(currentPhase === 'Inspection' || currentPhase === 'Delivery') && pickupItems.length > 0 && (
            <p className="text-xs text-gray-400">Pickup checklist: {pickupDone}/{pickupItems.length} completed</p>
          )}
          {currentPhase === 'Delivery' && inspectionItems.length > 0 && (
            <p className="text-xs text-gray-400">Inspection checklist: {inspectionDone}/{inspectionItems.length} completed</p>
          )}
          <p className="text-xs text-gray-500">
            {hasPhases ? `${currentPhase} checklist` : 'Checklist'} ({visibleChecklist.filter((i) => i.completed_at).length}/{visibleChecklist.length})
          </p>
          <div className="space-y-3">
            {visibleChecklist.map((item, idx) => {
              const phase = item.label.startsWith('Delivery:') ? 'Delivery' : item.label.startsWith('Inspection:') ? 'Inspection' : item.label.startsWith('Pickup:') ? 'Pickup' : null
              const prevPhase = idx > 0
                ? (visibleChecklist[idx - 1].label.startsWith('Delivery:') ? 'Delivery' : visibleChecklist[idx - 1].label.startsWith('Inspection:') ? 'Inspection' : visibleChecklist[idx - 1].label.startsWith('Pickup:') ? 'Pickup' : null)
                : null
              const displayLabel = item.label.replace(/^(Pickup|Delivery|Inspection):\s*/, '')
              return (
              <div key={item.id}>
                {phase && phase !== prevPhase && (
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-1">{phase}</p>
                )}
                {item.item_type === 'check' ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!item.completed_at}
                      onChange={() => toggleChecklistItem(item)}
                    />
                    <span className={item.completed_at ? 'text-gray-400 line-through' : 'text-gray-700'}>
                      {displayLabel}
                    </span>
                  </label>
                ) : item.item_type === 'yesno' ? (
                  <div>
                    <p className={`text-sm mb-1 ${item.completed_at ? 'text-gray-400' : 'text-gray-700'}`}>{displayLabel}</p>
                    <div className="flex gap-2">
                      {['Yes', 'No'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setTristateValue(item, opt)}
                          className={`text-xs px-3 py-1.5 rounded-lg border ${
                            item.notes === opt ? 'bg-[#378ADD] text-white border-[#378ADD]' : 'border-gray-300 text-gray-600'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : item.item_type === 'tristate' ? (
                  <div>
                    <p className={`text-sm mb-1 ${item.completed_at ? 'text-gray-400' : 'text-gray-700'}`}>{displayLabel}</p>
                    <div className="flex gap-2">
                      {['Yes', 'No', 'N/A'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setTristateValue(item, opt)}
                          className={`text-xs px-3 py-1.5 rounded-lg border ${
                            item.notes === opt ? 'bg-[#378ADD] text-white border-[#378ADD]' : 'border-gray-300 text-gray-600'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : item.item_type === 'input' ? (
                  <div>
                    <p className={`text-sm mb-1 ${item.completed_at ? 'text-gray-400' : 'text-gray-700'}`}>{displayLabel}</p>
                    <input
                      defaultValue={item.notes ?? ''}
                      onBlur={(e) => saveSimpleTextValue(item, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                ) : item.item_type === 'notes' ? (
                  <div>
                    <p className={`text-sm mb-1 ${item.completed_at ? 'text-gray-400' : 'text-gray-700'}`}>{displayLabel}</p>
                    <textarea
                      defaultValue={item.notes ?? ''}
                      onBlur={(e) => saveSimpleTextValue(item, e.target.value)}
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                ) : (
                  // Heavy items (photo/video/upload/signature/condition_report) collapse into a
                  // single tappable row, expanding to their full controls one at a time.
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <span className={`text-sm ${item.completed_at ? 'text-gray-400' : 'text-gray-700'}`}>
                        {item.completed_at ? '✓ ' : ''}{displayLabel}
                        {item.file_paths.length > 0 && ` (${item.file_paths.length} saved)`}
                      </span>
                      <span className="text-gray-300 text-xs">{expandedId === item.id ? '▾' : '▸'}</span>
                    </button>

                    {expandedId === item.id && (
                      <div className="mt-2">
                        {item.file_paths.length > 0 && item.item_type !== 'condition_report' && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {item.file_paths.map((path) => {
                              const isImage = /\.(jpe?g|png|gif|webp)$/i.test(path)
                              const url = fileUrls[path]
                              return (
                                <div key={path} className="relative">
                                  {isImage && url ? (
                                    <a href={url} target="_blank" rel="noopener noreferrer">
                                      <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                                    </a>
                                  ) : (
                                    <a
                                      href={url || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-14 h-14 rounded-lg border border-gray-200 flex items-center justify-center text-xs text-gray-500 bg-gray-50"
                                    >
                                      File
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => deleteFileFromItem(item, path)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#378ADD] text-white text-xs flex items-center justify-center hover:bg-red-600"
                                    title="Remove"
                                  >
                                    ✕
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {item.item_type === 'condition_report' && (
                          <div className="space-y-2">
                            <ConditionReportCard
                              data={item.condition_data ?? { markers: [], cleanliness: null, smell: '' }}
                              onChange={(d) => saveConditionData(item, d)}
                              notes={item.notes ?? ''}
                              onNotesBlur={(v) => saveNotesForItem(item, v)}
                              filePaths={item.file_paths}
                              fileUrls={fileUrls}
                              onUploadPhotos={(files) => uploadFilesForItem(item, files)}
                              onDeleteFile={(path) => deleteFileFromItem(item, path)}
                              uploading={uploadingItemId === item.id}
                            />
                            <button
                              type="button"
                              onClick={() => setExpandedId(null)}
                              className="text-xs text-gray-500 hover:text-gray-900 underline"
                            >
                              Done — collapse
                            </button>
                          </div>
                        )}

                        {item.item_type === 'signature' && (
                          <div className="space-y-2">
                            {(() => {
                              const pickupCondition = checklist.find((c) => c.item_type === 'condition_report')
                              if (!pickupCondition) return null
                              const cd = pickupCondition.condition_data
                              return (
                                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                  <p className="text-xs font-semibold text-gray-500 mb-1">Pickup condition report — please review with customer</p>
                                  {pickupCondition.notes && <p className="text-xs text-gray-600">{pickupCondition.notes}</p>}
                                  {cd && (cd.cleanliness || cd.smell) && (
                                    <p className="text-xs text-gray-600 mt-0.5">
                                      {cd.cleanliness && `Cleanliness: ${cd.cleanliness}/5`}
                                      {cd.cleanliness && cd.smell && ' · '}
                                      {cd.smell && `Smell: ${cd.smell}`}
                                    </p>
                                  )}
                                  {cd && cd.markers.length > 0 && (
                                    <ul className="text-xs text-gray-600 mt-0.5 list-disc list-inside">
                                      {cd.markers.map((m, i) => <li key={i}>{m.note}</li>)}
                                    </ul>
                                  )}
                                  <FilePreviewRow filePaths={pickupCondition.file_paths} fileUrls={fileUrls} />
                                </div>
                              )
                            })()}

                            {item.label === 'Delivery: Customer signs delivery disclosure' ? (
                              (() => {
                                const org = joinOrg(job.organizations)
                                const odometerItem = checklist.find((c) => c.label === 'Delivery: Enter the odometer reading')
                                const disclosureText = buildDeliveryDisclosureText({
                                  customerName: job.customer_full_name || job.recipient_name,
                                  customerAddress: job.customer_address,
                                  customerPhone: job.customer_phone,
                                  vehicleYear: job.vehicle_year,
                                  vehicleMake: job.vehicle_make,
                                  vehicleModel: job.vehicle_model,
                                  vin: job.vin,
                                  odometer: odometerItem?.notes ?? null,
                                  dealerName: org?.name,
                                  dealerAddress: org?.address,
                                  dealerPhone: org?.phone,
                                  deliveryDateTime: new Date().toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }),
                                  deliveryLat: job.delivery_gps_lat,
                                  deliveryLng: job.delivery_gps_lng,
                                })
                                return (
                                  <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-line max-h-64 overflow-y-auto">
                                    {disclosureText}
                                  </p>
                                )
                              })()
                            ) : (
                              getDocumentTextForLabel(item.label) && (
                                <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                  {getDocumentTextForLabel(item.label)}
                                </p>
                              )
                            )}

                            <ChecklistSignaturePad
                              saving={uploadingItemId === item.id}
                              onSave={(blob) => uploadSignatureForItem(item, blob)}
                            />
                          </div>
                        )}

                        {(item.item_type === 'photo' || item.item_type === 'video' || item.item_type === 'upload') && (
                          <label className="inline-block text-xs bg-[#378ADD] text-white px-3 py-1.5 rounded-lg hover:bg-[#2d6ead] cursor-pointer">
                            {uploadingItemId === item.id
                              ? 'Uploading...'
                              : item.item_type === 'video'
                              ? 'Record / upload video'
                              : item.item_type === 'photo'
                              ? 'Take / upload photo'
                              : 'Upload document'}
                            <input
                              type="file"
                              className="hidden"
                              disabled={uploadingItemId === item.id}
                              multiple={item.item_type === 'photo'}
                              accept={item.item_type === 'video' ? 'video/*' : item.item_type === 'photo' ? 'image/*' : 'image/*,.pdf'}
                              capture={item.item_type === 'video' || item.item_type === 'photo' ? 'environment' : undefined}
                              onChange={(e) => {
                                const files = e.target.files ? Array.from(e.target.files) : []
                                if (files.length > 0) uploadFilesForItem(item, files)
                                e.target.value = ''
                              }}
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </div>
        )
      })()}

      {isActive && canReleaseByStatus && (
        <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
          {canSelfRelease ? (
            <button
              onClick={releaseJob}
              disabled={loading}
              className="text-xs text-red-600 hover:text-red-700 underline disabled:opacity-50"
            >
              Release drive
            </button>
          ) : (
            <span className="text-[10px] text-amber-600 text-right leading-tight">
              Call dispatch to release — within 24 hrs of delivery
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function FilePreviewRow({ filePaths, fileUrls }: { filePaths: string[]; fileUrls: Record<string, string> }) {
  if (filePaths.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {filePaths.map((path) => {
        const url = fileUrls[path]
        const isImage = /\.(jpe?g|png|gif|webp)$/i.test(path)
        if (!isImage || !url) return null
        return (
          <a key={path} href={url} target="_blank" rel="noopener noreferrer">
            <img src={url} alt="" className="w-10 h-10 rounded object-cover border border-gray-200" />
          </a>
        )
      })}
    </div>
  )
}
