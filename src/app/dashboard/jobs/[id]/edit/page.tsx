'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculatePricing, formatCents, type PricingSettings, type AdditionalCharge, type PricingResult } from '@/lib/pricing'

type JobType = { id: string; name: string }

export default function EditJobPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string

  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [jobTypeId, setJobTypeId] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const [stops, setStops] = useState<string[]>(['', ''])

  const [vehicleYear, setVehicleYear] = useState('')
  const [vehicleMake, setVehicleMake] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [stockNumber, setStockNumber] = useState('')
  const [vin, setVin] = useState('')
  const [mileage, setMileage] = useState('')
  const [customerFullName, setCustomerFullName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')

  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [secondDriver, setSecondDriver] = useState(false)
  const [chaseVehicle, setChaseVehicle] = useState(false)
  const [isTradeIn, setIsTradeIn] = useState(false)
  const [isFirstNationsDelivery, setIsFirstNationsDelivery] = useState(false)
  const [vehicleMode, setVehicleMode] = useState<'driven' | 'towed'>('driven')
  const [outOfProvinceInspection, setOutOfProvinceInspection] = useState(false)
  const [registryVisit, setRegistryVisit] = useState(false)
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([])
  const [notes, setNotes] = useState('')

  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null)
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [pricing, setPricing] = useState<PricingResult | null>(null)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [notEditable, setNotEditable] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase.from('job_types').select('id, name').eq('active', true).then(({ data }) => {
      setJobTypes(data ?? [])
    })

    supabase.from('pricing_settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setPricingSettings(data)
    })

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'platform_admin') setIsAdmin(true)

      const { data: job } = await supabase
        .from('jobs')
        .select('*, job_stops(address, stop_order)')
        .eq('id', jobId)
        .single()

      if (!job) {
        setError('Job not found.')
        setPageLoading(false)
        return
      }
      if (job.status !== 'awaiting_driver') {
        setNotEditable(true)
        setPageLoading(false)
        return
      }

      setJobTypeId(job.job_type_id ?? '')

      const stopRows = (job.job_stops ?? []).slice().sort((a: { stop_order: number }, b: { stop_order: number }) => a.stop_order - b.stop_order)
      setStops(stopRows.length >= 2 ? stopRows.map((s: { address: string }) => s.address) : [job.pickup_address, job.dropoff_address])

      setVehicleYear(job.vehicle_year?.toString() ?? '')
      setVehicleMake(job.vehicle_make ?? '')
      setVehicleModel(job.vehicle_model ?? '')
      setStockNumber(job.stock_number ?? '')
      setVin(job.vin ?? '')
      setMileage(job.mileage?.toString() ?? '')
      setCustomerFullName(job.customer_full_name ?? '')
      setCustomerPhone(job.customer_phone ?? '')
      setCustomerAddress(job.customer_address ?? '')
      setRecipientName(job.recipient_name ?? '')
      setRecipientPhone(job.recipient_phone ?? '')
      setScheduledFor(job.scheduled_for ? job.scheduled_for.slice(0, 16) : '')
      setSecondDriver(job.second_driver_required ?? false)
      setChaseVehicle(job.chase_vehicle_required ?? false)
      setIsTradeIn(job.is_trade_in_pickup ?? false)
      setIsFirstNationsDelivery(job.is_first_nations_delivery ?? false)
      setVehicleMode(job.vehicle_mode ?? 'driven')
      setOutOfProvinceInspection(job.out_of_province_inspection ?? false)
      setRegistryVisit(job.registry_visit ?? false)
      setAdditionalCharges(job.additional_charges ?? [])
      setNotes(job.notes ?? '')

      setPageLoading(false)
    })
  }, [jobId, router])

  function updateStop(index: number, value: string) {
    setStops((prev) => prev.map((s, i) => (i === index ? value : s)))
  }

  function addStop() {
    setStops((prev) => [...prev.slice(0, -1), '', prev[prev.length - 1]])
  }

  function removeStop(index: number) {
    setStops((prev) => prev.filter((_, i) => i !== index))
  }

  function addCharge() {
    setAdditionalCharges((prev) => [...prev, { description: '', dealerAmountCents: 0, hoursAdded: 0, paidToDriver: false }])
  }

  function updateCharge(index: number, patch: Partial<AdditionalCharge>) {
    setAdditionalCharges((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function removeCharge(index: number) {
    setAdditionalCharges((prev) => prev.filter((_, i) => i !== index))
  }

  const runCalculation = useCallback(async () => {
    setCalcError('')
    const filledStops = stops.map((s) => s.trim()).filter(Boolean)
    if (filledStops.length < 2) {
      setCalcError('Enter at least a pickup and dropoff address.')
      return
    }
    if (!pricingSettings) {
      setCalcError('Pricing settings not loaded yet.')
      return
    }

    setCalculating(true)
    try {
      const res = await fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: filledStops }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCalcError(data.error || 'Could not calculate distance.')
        setCalculating(false)
        return
      }

      setDurationMinutes(data.durationMinutes)

      const result = calculatePricing(
        {
          distanceKm: data.distanceKm,
          durationMinutes: data.durationMinutes,
          vehicleMode,
          numDrivers: secondDriver ? 2 : 1,
          outOfProvinceInspection,
          registryVisit,
          additionalCharges,
        },
        pricingSettings
      )
      setPricing(result)
    } catch {
      setCalcError('Something went wrong reaching the mapping service.')
    }
    setCalculating(false)
  }, [stops, vehicleMode, secondDriver, outOfProvinceInspection, registryVisit, additionalCharges, pricingSettings])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const filledStops = stops.map((s) => s.trim()).filter(Boolean)
    if (filledStops.length < 2) {
      setError('Enter at least a pickup and dropoff address.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: jobError } = await supabase.from('jobs').update({
      job_type_id: jobTypeId,
      pickup_address: filledStops[0],
      dropoff_address: filledStops[filledStops.length - 1],
      recipient_name: recipientName || null,
      recipient_phone: recipientPhone || null,
      vehicle_year: vehicleYear ? parseInt(vehicleYear) : null,
      vehicle_make: vehicleMake || null,
      vehicle_model: vehicleModel || null,
      stock_number: stockNumber || null,
      vin: vin || null,
      mileage: mileage ? parseInt(mileage) : null,
      customer_full_name: customerFullName || null,
      customer_phone: customerPhone || null,
      customer_address: customerAddress || null,
      scheduled_for: scheduledFor || null,
      second_driver_required: secondDriver,
      chase_vehicle_required: chaseVehicle,
      is_trade_in_pickup: isTradeIn,
      is_first_nations_delivery: isFirstNationsDelivery,
      vehicle_mode: vehicleMode,
      out_of_province_inspection: outOfProvinceInspection,
      registry_visit: registryVisit,
      additional_charges: additionalCharges,
      overnight_required: pricing?.overnightRequired ?? false,
      estimated_distance_km: pricing?.tripDistanceKm ?? null,
      estimated_duration_minutes: durationMinutes,
      estimated_dealer_cost_cents: pricing?.estimatedDealerCostCents ?? null,
      estimated_driver_pay_cents: pricing?.estimatedDriverPayCents ?? null,
      notes: notes || null,
    }).eq('id', jobId)

    if (jobError) {
      setError(jobError.message)
      setLoading(false)
      return
    }

    // Replace the stop rows with the current set
    await supabase.from('job_stops').delete().eq('job_id', jobId)
    const stopRows = filledStops.map((address, i) => ({
      job_id: jobId,
      stop_order: i,
      address,
      stop_type: i === 0 ? 'pickup' : i === filledStops.length - 1 ? 'dropoff' : 'waypoint',
    }))
    await supabase.from('job_stops').insert(stopRows)

    router.push('/dashboard')
    router.refresh()
  }

  if (pageLoading) return null

  if (notEditable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">This job can no longer be edited</h1>
          <p className="text-sm text-gray-500 mb-6">
            Once a driver has been assigned, the job details are locked. You can still cancel it from the dashboard if needed.
          </p>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-600 hover:text-gray-900 underline">
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Edit job</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Job type</label>
            <select
              value={jobTypeId}
              onChange={(e) => setJobTypeId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {jobTypes.map((jt) => (
                <option key={jt.id} value={jt.id}>{jt.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {stops.map((stop, i) => (
              <div key={i}>
                <label className="block text-sm text-gray-700 mb-1">
                  {i === 0 ? 'Pickup address' : i === stops.length - 1 ? 'Dropoff address' : `Stop ${i}`}
                </label>
                <div className="flex gap-2">
                  <input
                    required={i === 0 || i === stops.length - 1}
                    value={stop}
                    onChange={(e) => updateStop(i, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  {i !== 0 && i !== stops.length - 1 && (
                    <button type="button" onClick={() => removeStop(i)} className="text-xs text-gray-400 hover:text-red-600 px-2">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={addStop} className="text-xs text-gray-600 hover:text-gray-900 underline">
              + Add a stop
            </button>
          </div>

          <div className="space-y-3 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900">Vehicle</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Year</label>
                <input value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Make</label>
                <input value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stock number</label>
                <input value={stockNumber} onChange={(e) => setStockNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mileage</label>
                <input value={mileage} onChange={(e) => setMileage(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">VIN</label>
              <input value={vin} onChange={(e) => setVin(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="space-y-3 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900">Customer</p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Full name</label>
              <input value={customerFullName} onChange={(e) => setCustomerFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Address</label>
                <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Recipient name</label>
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Recipient phone</label>
              <input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Scheduled for</label>
            <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Is the vehicle driven or towed?</label>
            <select
              value={vehicleMode}
              onChange={(e) => setVehicleMode(e.target.value as 'driven' | 'towed')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="driven">Driven</option>
              <option value="towed">Towed (trailer)</option>
            </select>
          </div>

          <div className="space-y-2 border border-gray-200 rounded-lg p-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isTradeIn} onChange={(e) => setIsTradeIn(e.target.checked)} />
              This includes a trade-in pickup (same driver, same trip — no extra charge)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={secondDriver}
                onChange={(e) => {
                  const checked = e.target.checked
                  setSecondDriver(checked)
                  if (checked) setChaseVehicle(true)
                }}
              />
              Second driver required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={chaseVehicle} onChange={(e) => setChaseVehicle(e.target.checked)} />
              Chase vehicle required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={outOfProvinceInspection} onChange={(e) => setOutOfProvinceInspection(e.target.checked)} />
              Out-of-province inspection required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={registryVisit} onChange={(e) => setRegistryVisit(e.target.checked)} />
              Registry visit required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={isFirstNationsDelivery} onChange={(e) => setIsFirstNationsDelivery(e.target.checked)} />
              Delivery is to a First Nations reserve
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Additional time & charges</label>
              <button type="button" onClick={addCharge} className="text-xs text-gray-600 hover:text-gray-900 underline">
                + Add
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Use this for flights, ferries, Ubers, or anything else that adds cost or time.
            </p>
            {additionalCharges.map((charge, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    placeholder="Description (e.g. Flight home)"
                    value={charge.description}
                    onChange={(e) => updateCharge(i, { description: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={() => removeCharge(i)} className="text-xs text-gray-400 hover:text-red-600 px-2">
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cost to bill dealer ($)</label>
                    <input
                      type="number" step="0.01"
                      value={charge.dealerAmountCents / 100}
                      onChange={(e) => updateCharge(i, { dealerAmountCents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Hours to add</label>
                    <input
                      type="number" step="0.5"
                      value={charge.hoursAdded}
                      onChange={(e) => updateCharge(i, { hoursAdded: parseFloat(e.target.value || '0') })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={charge.paidToDriver} onChange={(e) => updateCharge(i, { paidToDriver: e.target.checked })} />
                  Pay this to the driver too (e.g. reimbursed fare)
                </label>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          <button
            type="button"
            onClick={runCalculation}
            disabled={calculating}
            className="w-full border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {calculating ? 'Calculating...' : 'Recalculate distance & cost'}
          </button>
          {calcError && <p className="text-sm text-red-600">{calcError}</p>}

          {pricing && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-2 bg-gray-50">
              <p className="text-xs text-gray-500">
                {pricing.tripDistanceKm} km round trip {durationMinutes ? '· ' + (Math.round(pricing.baseDrivingHours * 10) / 10) + ' hrs drive time' : ''}
                {pricing.overnightRequired && <span className="text-amber-600"> · Overnight stay required</span>}
              </p>

              {isAdmin && (
                <>
                  <div className="space-y-1 pt-2 border-t border-gray-200">
                    <BreakdownRow label="Driving pay" cents={pricing.hourlyDealerCents} />
                    <BreakdownRow label="Fuel" cents={pricing.gasCostCents} />
                    <BreakdownRow label="Meals" cents={pricing.mealCostCents} />
                    <BreakdownRow label="Wear & tear" cents={pricing.wearAndTearCents} />
                    <BreakdownRow label="Trailer fee" cents={pricing.trailerFeeCents} />
                    <BreakdownRow label="Hotel" cents={pricing.hotelCents} />
                    <BreakdownRow label="Overnight fee" cents={pricing.overnightFeeCents} />
                    <BreakdownRow label="Out-of-province inspection" cents={pricing.inspectionFeeCents} />
                    <BreakdownRow label="Registry visit" cents={pricing.registryFeeCents} />
                    <BreakdownRow label="Additional charges" cents={pricing.extrasDealerCents} />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-xs text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatCents(pricing.costBasisCents)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Markup{pricingSettings ? ` (${pricingSettings.dealer_markup_percent}%)` : ''}</span>
                    <span>{formatCents(pricing.estimatedDealerCostCents - pricing.costBasisCents)}</span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-700">Estimated dealer cost</span>
                <span className="text-base font-semibold text-gray-900">{formatCents(pricing.estimatedDealerCostCents)}</span>
              </div>
              <p className="text-xs text-gray-400 pt-1">
                Final actual charges may vary slightly. Additional charges may apply for anything not listed above.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save changes'}
            </button>
            <button type="button" onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 px-3 py-2.5">
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

function BreakdownRow({ label, cents }: { label: string; cents: number }) {
  if (!cents) return null
  return (
    <div className="flex items-center justify-between text-xs text-gray-600">
      <span>{label}</span>
      <span>{formatCents(cents)}</span>
    </div>
  )
}
