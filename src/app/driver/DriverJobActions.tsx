'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import { formatCents, type AdditionalCharge } from '@/lib/pricing'
import { getDefaultChecklist, getDocumentTextForLabel, buildDeliveryDisclosureText, type ChecklistItemType, type IncludedItems } from '@/lib/checklist'
import ChecklistSignaturePad from '@/components/ChecklistSignaturePad'
import ConditionReportCard, { type ConditionData } from '@/components/ConditionReportCard'
import ConditionReportView from '@/components/ConditionReportView'
import GuidedCaptureModal from '@/components/GuidedCaptureModal'

type Job = {
  id: string
  status: string
  scheduled_for: string | null
  delivery_deadline?: string | null
  estimated_duration_minutes: number | null
  pickup_address: string
  dropoff_address: string
  recipient_name: string | null
  customer_full_name: string | null
  estimated_driver_pay_cents: number | null
  admin_pay_override_cents?: number | null
  estimated_driver_reimbursement_cents?: number | null
  additional_charges?: AdditionalCharge[] | null
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
  pickup_gps_lat: number | null
  pickup_gps_lng: number | null
  pickup_gps_at: string | null
  id_verification_completed_at: string | null
  id_verification_sent_at: string | null
  id_verification_approved_at: string | null
  id_verification_failed_attempts: number
  id_verification_manual_override: boolean
  wait_time_started_at: string | null
  total_wait_minutes: number
  idle_fee_cents: number
  job_types: { name: string }[] | { name: string } | null
  organizations: { name: string; address: string | null; phone: string | null }[] | { name: string; address: string | null; phone: string | null } | null
}

// Pulls a city out of a full address string like "123 Main St, Coquitlam, BC, Canada".
// Falls back to the full address if it doesn't look like a standard formatted address.
const PROVINCE_CODES = ['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU']

function extractCity(address: string): string {
  const commaParts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (commaParts.length >= 3) return commaParts[commaParts.length - 3]
  if (commaParts.length === 2) return commaParts[0]

  // No (or one) commas — strip postal code and province off the end, then take
  // the last couple words as the best guess at the city name.
  const stripped = address
    .replace(/[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d\s*$/, '')
    .replace(/\b\d{5}(-\d{4})?\s*$/, '')
    .trim()

  const words = stripped.split(/\s+/).filter(Boolean)
  const last = words[words.length - 1]?.toUpperCase().replace(/[^A-Z]/g, '')
  if (last && PROVINCE_CODES.includes(last)) words.pop()

  if (words.length >= 2) return words.slice(-2).join(' ')
  if (words.length === 1) return words[0]
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
  approvedReimbursementCents = 0,
}: {
  job: Job
  isActive: boolean
  disabled?: boolean
  // Real, admin-approved total of 'return_transport' receipts submitted for
  // this job — separate from job.estimated_driver_reimbursement_cents, which
  // is just the pricing-time guess. See src/app/driver/page.tsx.
  approvedReimbursementCents?: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [confirmingIdMatch, setConfirmingIdMatch] = useState(false)
  const [manualIdConfirmChecked, setManualIdConfirmChecked] = useState(false)
  const [guidedCaptureItem, setGuidedCaptureItem] = useState<{ item: ChecklistItem; mode: 'walkaround' | 'dash' | 'windshield' } | null>(null)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [justSubmittedExpense, setJustSubmittedExpense] = useState(false)
  const [expenseCategory, setExpenseCategory] = useState('wait_time')
  const [expenseCustomCategory, setExpenseCustomCategory] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseReceiptFile, setExpenseReceiptFile] = useState<File | null>(null)
  const [scanningReceipt, setScanningReceipt] = useState(false)
  const [receiptScanNote, setReceiptScanNote] = useState('')
  const [submittingExpense, setSubmittingExpense] = useState(false)
  const [expenseError, setExpenseError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(interval)
  }, [])
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
        if (job.status === 'assigned') {
          const conditionItem = data.find((i) => i.item_type === 'condition_report')
          if (conditionItem) setExpandedId(conditionItem.id)
        }
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
      if (created) {
        setChecklist(created)
        if (job.status === 'assigned') {
          const conditionItem = created.find((i) => i.item_type === 'condition_report')
          if (conditionItem) setExpandedId(conditionItem.id)
        }
      }
    }

    loadChecklist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, job.id])

  // Separate, more robust auto-expand: fires whenever the job is in
  // "assigned" status and the checklist has actually loaded, rather than
  // only at the single moment the initial fetch completes — this covers
  // cases like the driver claiming the job while already on this page,
  // where the original load-time check could be missed.
  useEffect(() => {
    if (job.status !== 'assigned' || checklist.length === 0) return
    const conditionItem = checklist.find((i) => i.item_type === 'condition_report')
    if (conditionItem) setExpandedId(conditionItem.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.status, checklist.length])

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
      let settled = false
      // Belt-and-suspenders timeout independent of the geolocation API's own
      // `timeout` option below — inside the native app's webview, that option
      // wasn't reliably being honored, leaving this permanently unresolved and
      // the whole calling function stuck forever on this await with no error
      // ever thrown (so no amount of try/catch around the caller could help).
      const hardTimeout = setTimeout(() => {
        if (!settled) {
          settled = true
          resolve(null)
        }
      }, 9000)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (settled) return
          settled = true
          clearTimeout(hardTimeout)
          resolve(pos)
        },
        () => {
          if (settled) return
          settled = true
          clearTimeout(hardTimeout)
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      )
    })
  }

  async function advanceStatus() {
    const newStatus = nextStatus[job.status]
    if (!newStatus) return
    setLoading(true)
    try {
      await Promise.race([
        advanceStatusInner(newStatus),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out — check your connection and try again.')), 20000)),
      ])
    } catch (e) {
      // Final safety net: no matter what hangs or throws anywhere above (a
      // known geolocation quirk, or anything else we haven't hit yet), this
      // guarantees the button can never get stuck forever again with the
      // status silently never having been saved.
      console.error('advanceStatus failed:', e)
      alert(`Something went wrong updating this job: ${e instanceof Error ? e.message : String(e)}. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  async function advanceStatusInner(newStatus: string) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (newStatus === 'picked_up') {
        // The condition report was auto-expanded for the whole "assigned" phase
        // so it's front-and-center while the driver documents the vehicle —
        // once pickup is actually confirmed, collapse it back down.
        setExpandedId(null)
        // Tapping this main button IS confirming pickup — auto-check the
        // matching checklist item too, so the driver doesn't have to do the
        // same confirmation twice in two different places.
        const pickupCheckItem = checklist.find((i) => i.label === 'Pickup: Mark vehicle picked up')
        if (pickupCheckItem && !pickupCheckItem.completed_at) {
          toggleChecklistItem(pickupCheckItem)
        }
      }

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

      // "Delivered" means the vehicle reached the customer — it doesn't mean the
      // driver's day is done necessarily, so we still capture when/where they
      // actually wrap up for real hours tracking. This is informational only —
      // it does NOT block marking the job complete regardless of location.
      if (newStatus === 'completed') {
        const pos = await getCurrentPositionSafe()
        if (pos) {
          jobUpdate.return_gps_lat = pos.coords.latitude
          jobUpdate.return_gps_lng = pos.coords.longitude
          jobUpdate.return_gps_at = new Date().toISOString()
          if (job.pickup_gps_at) {
            const actualHours = (Date.now() - new Date(job.pickup_gps_at).getTime()) / (60 * 60 * 1000)
            jobUpdate.actual_driver_hours = Math.round(actualHours * 100) / 100
          }
        }
      }

      const { error: updateError } = await supabase.from('jobs').update(jobUpdate).eq('id', job.id)
      if (updateError) {
        console.error('Status update failed:', updateError)
        alert(`Could not update the job status: ${updateError.message}. Please try again or contact support.`)
        return
      }
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

      if (newStatus === 'delivered') {
        fetch('/api/customer-sms/notify-arrived', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id }),
        }).catch(() => {})
      }

      router.refresh()
  }

  async function goBackStatus() {
    const prevStatus = previousStatus[job.status]
    if (!prevStatus) return
    if (!confirm(`Go back to "${statusLabels[prevStatus]}"? This won't delete anything you've already filled in.`)) return

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      await supabase.from('jobs').update({ status: prevStatus }).eq('id', job.id)
      await supabase.from('job_status_events').insert({
        job_id: job.id,
        status: prevStatus,
        changed_by: user?.id,
      })

      router.refresh()
    } catch (e) {
      console.error('goBackStatus failed:', e)
      alert(`Something went wrong: ${e instanceof Error ? e.message : String(e)}. Please try again.`)
    } finally {
      setLoading(false)
    }
  }

  async function toggleWaitTimer() {
    const supabase = createClient()
    if (job.wait_time_started_at) {
      const elapsedMinutes = (Date.now() - new Date(job.wait_time_started_at).getTime()) / 60000
      const newTotal = Math.round((job.total_wait_minutes + elapsedMinutes) * 10) / 10
      const { data: settings } = await supabase
        .from('pricing_settings')
        .select('idle_fee_grace_minutes, idle_fee_per_minute_cents')
        .eq('id', 1)
        .single()
      const grace = settings?.idle_fee_grace_minutes ?? 15
      const rate = settings?.idle_fee_per_minute_cents ?? 100
      const newFeeCents = Math.round(Math.max(0, newTotal - grace) * rate)
      await supabase
        .from('jobs')
        .update({ wait_time_started_at: null, total_wait_minutes: newTotal, idle_fee_cents: newFeeCents })
        .eq('id', job.id)
    } else {
      await supabase.from('jobs').update({ wait_time_started_at: new Date().toISOString() }).eq('id', job.id)
    }
    router.refresh()
  }

  async function sendIdVerificationLink() {
    setSendingVerification(true)
    try {
      await fetch('/api/customer-sms/notify-arrived', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })
      router.refresh()
    } catch {
      // Best-effort — the driver can just tap it again if it didn't go through.
    }
    setSendingVerification(false)
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleReceiptFileSelected(file: File | null) {
    setExpenseReceiptFile(file)
    setReceiptScanNote('')
    if (!file) return
    setScanningReceipt(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/expense-receipt-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: base64 }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.amount) setExpenseAmount(String(data.amount))
        if (data.category) setExpenseCategory(data.category)
        if (data.description || data.vendor) {
          setExpenseDescription([data.vendor, data.description].filter(Boolean).join(' — '))
        }
        setReceiptScanNote('Filled in from the receipt — double check before submitting.')
      } else {
        setReceiptScanNote('Could not read the receipt automatically — enter the details yourself.')
      }
    } catch {
      setReceiptScanNote('Could not read the receipt automatically — enter the details yourself.')
    }
    setScanningReceipt(false)
  }

  async function submitExpense() {
    setExpenseError('')
    const amountCents = Math.round(parseFloat(expenseAmount || '0') * 100)
    if (!amountCents || amountCents <= 0) {
      setExpenseError('Enter a valid amount.')
      return
    }
    if (!expenseReceiptFile) {
      setExpenseError('A photo of the receipt is required.')
      return
    }
    if (expenseCategory === 'other' && !expenseCustomCategory.trim()) {
      setExpenseError('Enter what kind of expense this is.')
      return
    }
    setSubmittingExpense(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Generate the ID client-side so the storage path can be scoped to it
    // before the row exists — the storage policy checks the folder name
    // against this same expense ID.
    const expenseId = crypto.randomUUID()
    const ext = expenseReceiptFile.name.split('.').pop() || 'jpg'
    const path = `${expenseId}/receipt.${ext}`

    const { error: uploadError } = await supabase.storage.from('expense-receipts').upload(path, expenseReceiptFile)
    if (uploadError) {
      setExpenseError(`Could not upload the receipt photo: ${uploadError.message}`)
      setSubmittingExpense(false)
      return
    }

    const { error: insertError } = await supabase.from('job_expenses').insert({
      id: expenseId,
      job_id: job.id,
      submitted_by: user?.id,
      category: expenseCategory,
      custom_category: expenseCategory === 'other' ? expenseCustomCategory.trim() : null,
      description: expenseDescription || null,
      amount_cents: amountCents,
      receipt_photo_path: path,
    })

    setSubmittingExpense(false)
    if (insertError) {
      setExpenseError(`Could not submit the expense: ${insertError.message}`)
      return
    }

    setShowExpenseForm(false)
    setJustSubmittedExpense(true)
    setExpenseCategory('wait_time')
    setExpenseCustomCategory('')
    setExpenseDescription('')
    setExpenseAmount('')
    setExpenseReceiptFile(null)
    setReceiptScanNote('')
    router.refresh()
  }

  async function confirmIdMatchManually() {
    setConfirmingIdMatch(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('jobs')
      .update({
        id_verification_manual_override: true,
        id_verification_manual_override_by: user?.id ?? null,
        id_verification_manual_override_at: new Date().toISOString(),
      })
      .eq('id', job.id)
    if (!error) {
      await supabase
        .from('job_checklist_items')
        .update({ completed_at: new Date().toISOString() })
        .eq('job_id', job.id)
        .eq('item_type', 'customer_id_verification')
    }
    setConfirmingIdMatch(false)
    if (error) {
      alert(`Could not save this: ${error.message}`)
      return
    }
    router.refresh()
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
    const deadlineText = job.delivery_deadline
      ? `\\nCustomer needs vehicle by: ${new Date(job.delivery_deadline).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}`
      : ''
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Drivflo//EN',
      'BEGIN:VEVENT',
      `UID:${job.id}@drivflo`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:Pick up vehicle — ${title}`,
      `LOCATION:${job.pickup_address}`,
      `DESCRIPTION:Pickup: ${job.pickup_address}\\nDropoff: ${job.dropoff_address}${deadlineText}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder — pick up the vehicle',
      'TRIGGER:-PT30M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    // Safari blocks top-level navigation to data: URLs as an anti-phishing
    // measure, and window.open() calls are prone to mobile popup blockers.
    // A blob: URL with a direct same-tab navigation is the most reliable
    // combination across iOS Safari and Android Chrome for handing an .ics
    // file off to the device's calendar app.
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  return (
    <div className="border border-gray-200 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between mb-1">
        <div>
          {job.scheduled_for && (
            <p className="text-xs font-semibold text-blue-700">
              Leave by {new Date(job.scheduled_for).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
          <p className="text-xs text-blue-600">To: {job.dropoff_address}</p>
          {job.delivery_deadline && (
            <p className="text-xs text-amber-600 mt-0.5">
              Deliver by {new Date(job.delivery_deadline).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
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
        {(job.stock_number || job.vin) && (
          <p className="text-xs text-gray-600 mt-0.5">
            {job.stock_number && `Stk# ${job.stock_number}`}
            {job.stock_number && job.vin && ' · '}
            {job.vin && `VIN ...${job.vin.slice(-8)}`}
          </p>
        )}
        {(job.vehicle_year || job.vehicle_make || job.vehicle_model) && (
          <p className="text-xs text-gray-600 mt-0.5">
            {[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ')}
          </p>
        )}
        {joinName(job.organizations) && (
          <p className="text-xs text-gray-600 mt-0.5">{joinName(job.organizations)}</p>
        )}
        <p className="text-xs text-gray-500 mt-1.5">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.pickup_address)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[#378ADD] hover:underline font-medium"
          >
            🧭 Pick-up Navigate
          </a>
          <br />
          <span className="text-gray-500">{job.pickup_address}</span>
        </p>
        <p className="text-xs text-gray-500 mt-1.5">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.dropoff_address)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[#378ADD] hover:underline font-medium"
          >
            🧭 Drop-Off Navigate
          </a>
          <br />
          <span className="text-gray-500">{job.dropoff_address}</span>
        </p>
        {(job.estimated_distance_km != null || job.estimated_duration_minutes != null) && (
          <p className="text-xs text-gray-400 mt-2">
            {job.estimated_distance_km != null && `${Math.round(job.estimated_distance_km)} km round trip`}
            {job.estimated_distance_km != null && job.estimated_duration_minutes != null && ' · '}
            {job.estimated_duration_minutes != null && `~${Math.round((job.estimated_duration_minutes / 60) * 10) / 10} hrs`}
          </p>
        )}
        {(job.customer_full_name || job.recipient_name) && (
          <p className="text-xs text-gray-400 mt-0.5">
            Customer: {job.customer_full_name || job.recipient_name}
            {job.customer_phone && (
              <>
                {' · '}
                <a href={`tel:${job.customer_phone}`} onClick={(e) => e.stopPropagation()} className="text-[#378ADD] hover:underline">
                  📞 {job.customer_phone}
                </a>
              </>
            )}
          </p>
        )}
        {(job.admin_pay_override_cents ?? job.estimated_driver_pay_cents) != null && (
          <p className="text-xs text-green-700 font-medium mt-0.5">
            Est. pay: {formatCents(job.admin_pay_override_cents ?? job.estimated_driver_pay_cents!)}
            {/* The pricing-time reimbursement figure (e.g. "Bus back" estimate) is just a
                guess — only show it once the driver has submitted a 'return_transport'
                receipt and admin has approved it, and show the real approved amount
                rather than the estimate. See src/app/driver/page.tsx for how
                approvedReimbursementCents is computed. */}
            {approvedReimbursementCents > 0 && (
              <span className="text-gray-500 font-normal"> + {formatCents(approvedReimbursementCents)} reimbursement</span>
            )}
          </p>
        )}
        {!['completed', 'cancelled', 'awaiting_driver'].includes(job.status) && (
          <div className="mt-1.5">
            <div className="mt-2">
              {justSubmittedExpense ? (
                <div className="border border-green-200 bg-green-50 rounded-xl p-4 text-center space-y-2">
                  <p className="text-sm text-green-700 font-medium">✓ Expense submitted for approval</p>
                  <div className="flex gap-2 justify-center pt-1">
                    <button
                      type="button"
                      onClick={() => { setJustSubmittedExpense(false); setShowExpenseForm(true) }}
                      className="text-sm bg-[#378ADD] text-white px-4 py-2 rounded-lg hover:bg-[#2d6ead] font-medium"
                    >
                      + Add another
                    </button>
                    <button
                      type="button"
                      onClick={() => setJustSubmittedExpense(false)}
                      className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 font-medium"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : !showExpenseForm ? (
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(true)}
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium bg-[#378ADD] text-white px-4 py-3 rounded-xl hover:bg-[#2d6ead]"
                >
                  💵 Submit an expense
                </button>
              ) : (
                <div className="border-2 border-[#378ADD] rounded-xl p-4 space-y-2.5 bg-blue-50/40">
                  <p className="text-sm font-semibold text-gray-900">Submit expense for reimbursement</p>
                  {expenseError && <p className="text-xs text-red-600">{expenseError}</p>}

                  <div className="bg-white border-2 border-dashed border-[#378ADD] rounded-lg p-3 text-center">
                    <p className="text-2xl mb-1">📸</p>
                    <label className="block cursor-pointer">
                      <span className="text-sm font-semibold text-[#378ADD]">Take a photo of the receipt</span>
                      <p className="text-xs text-gray-500 mt-0.5">We'll read it and fill in the amount, category, and details for you automatically</p>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleReceiptFileSelected(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm mt-2"
                      />
                    </label>
                  </div>
                  {scanningReceipt && <p className="text-xs text-gray-500 text-center">🔎 Reading the receipt…</p>}
                  {receiptScanNote && !scanningReceipt && <p className="text-xs text-amber-600 text-center">{receiptScanNote}</p>}

                  <p className="text-xs text-gray-500 font-medium pt-1">Details</p>

                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="wait_time">Wait time</option>
                    <option value="fuel">Fuel</option>
                    <option value="food">Food</option>
                    <option value="repairs">Repairs</option>
                    <option value="inspection">Inspection</option>
                    <option value="tolls">Tolls</option>
                    <option value="parking">Parking</option>
                    <option value="storage">Storage</option>
                    <option value="additional_mileage">Additional mileage</option>
                    <option value="return_transport">Return transport (Uber/bus back)</option>
                    <option value="other">Other</option>
                  </select>
                  {expenseCategory === 'other' && (
                    <input
                      value={expenseCustomCategory}
                      onChange={(e) => setExpenseCustomCategory(e.target.value)}
                      placeholder="What kind of expense is this?"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"
                    />
                  )}
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="Amount ($)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"
                  />
                  <input
                    value={expenseDescription}
                    onChange={(e) => setExpenseDescription(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={submitExpense}
                      disabled={submittingExpense}
                      className="flex-1 text-sm font-medium bg-[#378ADD] text-white px-4 py-2.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
                    >
                      {submittingExpense ? 'Submitting…' : 'Submit for approval'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowExpenseForm(false); setExpenseError('') }}
                      className="text-sm text-gray-500 hover:text-gray-700 px-3"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
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

      {!['completed', 'cancelled', 'awaiting_driver'].includes(job.status) && (
        <div className="mt-1.5">
          {job.wait_time_started_at ? (
            <button
              type="button"
              onClick={toggleWaitTimer}
              className="text-xs bg-amber-100 text-amber-800 border border-amber-300 rounded-lg px-2.5 py-1 hover:bg-amber-200"
            >
              ⏱ Waiting since {new Date(job.wait_time_started_at).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })} — tap to stop
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleWaitTimer}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Start wait timer (pick up/drop off not ready)
            </button>
          )}
          {job.total_wait_minutes > 0 && !job.wait_time_started_at && (
            <p className="text-xs text-gray-400 mt-0.5">
              Total wait so far: {job.total_wait_minutes} min{job.idle_fee_cents > 0 && ` — idle fee: ${formatCents(job.idle_fee_cents)}`}
            </p>
          )}
        </div>
      )}

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
                ) : item.item_type === 'customer_id_verification' ? (
                  <div>
                    <p className={`text-sm mb-1 ${job.id_verification_completed_at || job.id_verification_manual_override ? 'text-gray-400' : 'text-gray-700'}`}>
                      {job.id_verification_completed_at || job.id_verification_manual_override ? '✓ ' : ''}{displayLabel}
                    </p>
                    {job.id_verification_manual_override ? (
                      <p className="text-xs text-green-600">✓ Manually confirmed by driver</p>
                    ) : job.id_verification_completed_at ? (() => {
                      const waitMs = 5 * 60 * 1000
                      const elapsedMs = now - new Date(job.id_verification_completed_at).getTime()
                      const approved = !!job.id_verification_approved_at
                      const waitOver = elapsedMs >= waitMs
                      if (approved || waitOver) {
                        return (
                          <p className="text-xs text-green-600">
                            Verified {new Date(job.id_verification_completed_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}
                            {approved ? ' — approved by dealer' : ' — you can proceed'}
                          </p>
                        )
                      }
                      const remainingMin = Math.max(0, Math.ceil((waitMs - elapsedMs) / 60000))
                      return (
                        <p className="text-xs text-amber-600">
                          Verified — waiting for dealer approval (auto-continues in ~{remainingMin} min)
                        </p>
                      )
                    })() : job.id_verification_failed_attempts >= 2 ? (
                      <div>
                        <p className="text-xs text-amber-600 mb-1">
                          The customer&apos;s photos couldn&apos;t be auto-verified after {job.id_verification_failed_attempts} tries.
                          Please check their photo ID in person before handing over the keys.
                        </p>
                        <label className="flex items-center gap-2 text-xs text-gray-700 mb-1">
                          <input type="checkbox" checked={manualIdConfirmChecked} onChange={(e) => setManualIdConfirmChecked(e.target.checked)} />
                          I&apos;ve confirmed in person that this customer&apos;s photo ID matches the delivery recipient
                        </label>
                        <button
                          type="button"
                          onClick={confirmIdMatchManually}
                          disabled={!manualIdConfirmChecked || confirmingIdMatch}
                          className="text-xs text-white bg-gray-900 rounded px-2 py-1 hover:bg-gray-800 disabled:opacity-50"
                        >
                          {confirmingIdMatch ? 'Saving…' : 'Confirm'}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">
                          {job.id_verification_sent_at
                            ? `Link sent ${new Date(job.id_verification_sent_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })} — waiting for the customer to complete it.`
                            : 'The customer verifies their own identity via a text link — no action needed from you here.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => sendIdVerificationLink()}
                          disabled={sendingVerification}
                          className="text-xs text-[#378ADD] hover:underline disabled:opacity-50"
                        >
                          {sendingVerification ? 'Sending…' : job.id_verification_sent_at ? 'Resend verification link' : 'Send verification link'}
                        </button>
                      </div>
                    )}
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
                                  {cd && cd.markers.length > 0 && <ConditionReportView data={cd} />}
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

                        {item.label.includes('Photograph windshield') && (
                          <div className="mb-2">
                            <p className="text-xs text-gray-500 mb-1">Windshield condition</p>
                            <div className="flex gap-2">
                              {['Good', 'Chipped', 'Cracked'].map((opt) => (
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
                        )}

                        {(item.item_type === 'photo' || item.item_type === 'video' || item.item_type === 'upload') && (
                          item.label.includes('360° walkaround video') ? (
                            <button
                              type="button"
                              onClick={() => setGuidedCaptureItem({ item, mode: 'walkaround' })}
                              disabled={uploadingItemId === item.id}
                              className="text-xs bg-[#378ADD] text-white px-3 py-1.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
                            >
                              {uploadingItemId === item.id ? 'Uploading...' : '🎥 Record guided walkaround'}
                            </button>
                          ) : item.label.includes('Photograph windshield') ? (
                            <button
                              type="button"
                              onClick={() => setGuidedCaptureItem({ item, mode: 'windshield' })}
                              disabled={uploadingItemId === item.id}
                              className="text-xs bg-[#378ADD] text-white px-3 py-1.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
                            >
                              {uploadingItemId === item.id ? 'Uploading...' : '📷 Take guided photo'}
                            </button>
                          ) : item.label.startsWith('Delivery: Photograph dash') || item.label.includes('Photograph odometer') ? (
                            <button
                              type="button"
                              onClick={() => setGuidedCaptureItem({ item, mode: 'dash' })}
                              disabled={uploadingItemId === item.id}
                              className="text-xs bg-[#378ADD] text-white px-3 py-1.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
                            >
                              {uploadingItemId === item.id ? 'Uploading...' : '📷 Take guided photo'}
                            </button>
                          ) : (
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
                          )
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

      {guidedCaptureItem && (
        <GuidedCaptureModal
          mode={guidedCaptureItem.mode}
          onClose={() => setGuidedCaptureItem(null)}
          onCapture={(file) => {
            const item = guidedCaptureItem.item
            setGuidedCaptureItem(null)
            uploadFilesForItem(item, [file])
          }}
        />
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
