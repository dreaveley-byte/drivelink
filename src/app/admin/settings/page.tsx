'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
import SettingsGearLink from '@/components/SettingsGearLink'
import Logo from '@/components/Logo'

type Settings = {
  hourly_rate_cents: number
  fuel_price_cents_per_litre: number
  fuel_economy_driven_l_per_100km: number
  fuel_economy_towed_l_per_100km: number
  hotel_rate_cents: number
  overnight_fee_cents: number
  wear_and_tear_cents_per_km: number
  trailer_fee_cents_per_day: number
  meal_allowance_cents: number
  meal_allowance_every_hours: number
  meal_allowance_max_count: number
  dealer_markup_percent: number
  minimum_driver_pay_cents: number
  out_of_province_inspection_min_hours: number
  out_of_province_inspection_fee_cents: number
  registry_visit_min_hours: number
  registry_visit_fee_cents: number
  return_ground_transport_hours: number
  return_ground_transport_fee_cents: number
  uber_base_fare_cents: number
  uber_per_km_cents: number
  uber_minimum_fare_cents: number
  flight_airport_buffer_hours: number
  break_duration_minutes: number
  ferry_fare_cents: number
  ferry_wait_hours: number
  bus_base_fare_cents: number
  bus_per_km_cents: number
  max_driving_hours_before_overnight: number
}

function dollars(cents: number) {
  return (cents / 100).toFixed(2)
}

export default function PricingSettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [notAdmin, setNotAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'platform_admin') {
        setNotAdmin(true)
        setLoading(false)
        return
      }
      const { data } = await supabase.from('pricing_settings').select('*').eq('id', 1).single()
      setSettings(data)
      setLoading(false)
    })
  }, [router])

  function updateDollarField(key: keyof Settings, value: string) {
    if (!settings) return
    const cents = Math.round(parseFloat(value || '0') * 100)
    setSettings({ ...settings, [key]: cents })
  }

  function updateNumberField(key: keyof Settings, value: string) {
    if (!settings) return
    setSettings({ ...settings, [key]: parseFloat(value || '0') })
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setSaved(false)
    setSaveError('')
    const supabase = createClient()
    // Chaining .select().single() forces this to error if 0 rows were actually
    // updated (e.g. an RLS policy silently blocking it) instead of reporting
    // false success.
    const { data: updated, error } = await supabase
      .from('pricing_settings')
      .update(settings)
      .eq('id', 1)
      .select()
      .single()
    if (error || !updated) {
      setSaving(false)
      setSaveError(error?.message || 'Update did not return the saved row — it may not have been applied.')
      return
    }
    setSettings(updated)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return null

  if (notAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <p className="text-sm text-gray-500">You don&apos;t have access to this page.</p>
      </div>
    )
  }

  if (!settings) return null

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin"><Logo height={22} /></Link>
            <span className="text-sm text-gray-400">— Pricing Settings</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">These rates drive every job&apos;s cost and pay estimate</p>
        </div>
        <div className="flex items-center gap-4">
          <SignOutButton />
          <SettingsGearLink href="/admin/account" />
        </div>
      </header>

      <div className="border-b border-gray-100 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-4 flex-wrap">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
          <Link href="/admin/drivers" className="text-sm text-gray-600 hover:text-gray-900">
            Drivers
          </Link>
          <Link href="/admin/dealers" className="text-sm text-gray-600 hover:text-gray-900">
            Dealers
          </Link>
          <Link href="/admin/applications" className="text-sm text-gray-600 hover:text-gray-900">
            Applications
          </Link>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Driver Pay</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Hourly rate ($/hr)</label>
              <input type="number" step="0.01" value={dollars(settings.hourly_rate_cents)}
                onChange={(e) => updateDollarField('hourly_rate_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Overnight fee ($/driver/night)</label>
              <input type="number" step="0.01" value={dollars(settings.overnight_fee_cents)}
                onChange={(e) => updateDollarField('overnight_fee_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Meal allowance ($ per break)</label>
              <input type="number" step="0.01" value={dollars(settings.meal_allowance_cents)}
                onChange={(e) => updateDollarField('meal_allowance_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Meal break every (hours)</label>
              <input type="number" step="0.5" value={settings.meal_allowance_every_hours}
                onChange={(e) => updateNumberField('meal_allowance_every_hours', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Max meal breaks counted</label>
              <input type="number" value={settings.meal_allowance_max_count}
                onChange={(e) => updateNumberField('meal_allowance_max_count', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Break duration (minutes)</label>
              <p className="text-xs text-gray-400 mb-1">Added to total job hours for each meal break — bathroom/gas/food stop time, not just the allowance dollars</p>
              <input type="number" step="5" value={settings.break_duration_minutes}
                onChange={(e) => updateNumberField('break_duration_minutes', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Minimum pay per job ($)</label>
              <input type="number" step="0.01" value={dollars(settings.minimum_driver_pay_cents)}
                onChange={(e) => updateDollarField('minimum_driver_pay_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Fuel</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Fuel price ($/litre)</label>
              <input type="number" step="0.01" value={dollars(settings.fuel_price_cents_per_litre)}
                onChange={(e) => updateDollarField('fuel_price_cents_per_litre', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div></div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Fuel economy — driven (L/100km)</label>
              <input type="number" step="0.1" value={settings.fuel_economy_driven_l_per_100km}
                onChange={(e) => updateNumberField('fuel_economy_driven_l_per_100km', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Fuel economy — towed (L/100km)</label>
              <input type="number" step="0.1" value={settings.fuel_economy_towed_l_per_100km}
                onChange={(e) => updateNumberField('fuel_economy_towed_l_per_100km', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Vehicle & Equipment</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Own vehicle wear & tear (¢/km)</label>
              <input type="number" step="1" value={settings.wear_and_tear_cents_per_km}
                onChange={(e) => updateNumberField('wear_and_tear_cents_per_km', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Trailer fee ($/day)</label>
              <input type="number" step="0.01" value={dollars(settings.trailer_fee_cents_per_day)}
                onChange={(e) => updateDollarField('trailer_fee_cents_per_day', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Hotel & Overnight</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Hotel rate ($/night, combined)</label>
              <input type="number" step="0.01" value={dollars(settings.hotel_rate_cents)}
                onChange={(e) => updateDollarField('hotel_rate_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Max driving hours before overnight</label>
              <input type="number" step="0.5" value={settings.max_driving_hours_before_overnight}
                onChange={(e) => updateNumberField('max_driving_hours_before_overnight', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Fixed Fees (billed to dealer)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Out-of-province inspection minimum (hrs)</label>
              <input type="number" step="0.5" value={settings.out_of_province_inspection_min_hours}
                onChange={(e) => updateNumberField('out_of_province_inspection_min_hours', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Out-of-province inspection fee ($)</label>
              <input type="number" step="0.01" value={dollars(settings.out_of_province_inspection_fee_cents)}
                onChange={(e) => updateDollarField('out_of_province_inspection_fee_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Registry visit minimum (hrs)</label>
              <input type="number" step="0.5" value={settings.registry_visit_min_hours}
                onChange={(e) => updateNumberField('registry_visit_min_hours', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Registry visit fee ($)</label>
              <input type="number" step="0.01" value={dollars(settings.registry_visit_fee_cents)}
                onChange={(e) => updateDollarField('registry_visit_fee_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Ferry fare ($)</label>
              <p className="text-xs text-gray-400 mb-1">Typical BC Ferries vehicle fare — varies by route/vehicle size, so this is an average estimate</p>
              <input type="number" step="0.01" value={dollars(settings.ferry_fare_cents)}
                onChange={(e) => updateDollarField('ferry_fare_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Ferry wait buffer (hrs)</label>
              <p className="text-xs text-gray-400 mb-1">Time to arrive before sailing + crossing time not already reflected in drive time</p>
              <input type="number" step="0.5" value={settings.ferry_wait_hours}
                onChange={(e) => updateNumberField('ferry_wait_hours', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Bus base fare ($)</label>
              <p className="text-xs text-gray-400 mb-1">Estimate only — no live bus pricing source exists. Used to compare against flying/driving back on long hauls.</p>
              <input type="number" step="0.01" value={dollars(settings.bus_base_fare_cents)}
                onChange={(e) => updateDollarField('bus_base_fare_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Bus rate per km ($)</label>
              <input type="number" step="0.01" value={dollars(settings.bus_per_km_cents)}
                onChange={(e) => updateDollarField('bus_per_km_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Uber/taxi base fare ($)</label>
              <p className="text-xs text-gray-400 mb-1">Used to estimate the ride from the delivery location to the departure airport (actual distance is calculated automatically)</p>
              <input type="number" step="0.01" value={dollars(settings.uber_base_fare_cents)}
                onChange={(e) => updateDollarField('uber_base_fare_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Uber/taxi rate per km ($)</label>
              <input type="number" step="0.01" value={dollars(settings.uber_per_km_cents)}
                onChange={(e) => updateDollarField('uber_per_km_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Uber/taxi minimum fare ($)</label>
              <p className="text-xs text-gray-400 mb-1">Floor for short trips — real rides never cost less than this, regardless of distance</p>
              <input type="number" step="0.01" value={dollars(settings.uber_minimum_fare_cents)}
                onChange={(e) => updateDollarField('uber_minimum_fare_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Airport buffer time (hrs)</label>
              <p className="text-xs text-gray-400 mb-1">Added on top of actual flight time for check-in, security, and deplaning</p>
              <input type="number" step="0.5" value={settings.flight_airport_buffer_hours}
                onChange={(e) => updateNumberField('flight_airport_buffer_hours', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Ground transport home time (hrs)</label>
              <p className="text-xs text-gray-400 mb-1">Arrival airport → dealership (to drop paperwork) → home, when the driver flies back</p>
              <input type="number" step="0.5" value={settings.return_ground_transport_hours}
                onChange={(e) => updateNumberField('return_ground_transport_hours', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Ground transport home cost ($)</label>
              <p className="text-xs text-gray-400 mb-1">Covers Uber, bus, or a combination — reimbursed to the driver</p>
              <input type="number" step="0.01" value={dollars(settings.return_ground_transport_fee_cents)}
                onChange={(e) => updateDollarField('return_ground_transport_fee_cents', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Markup</h2>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Dealer bill = driver pay × this % </label>
            <input type="number" step="1" value={settings.dealer_markup_percent}
              onChange={(e) => updateNumberField('dealer_markup_percent', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#378ADD] text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Settings'}
        </button>
        {saveError && <p className="text-sm text-red-600">Save failed: {saveError}</p>}
      </main>
    </div>
  )
}
