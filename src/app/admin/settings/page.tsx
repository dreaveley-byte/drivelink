'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
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
            <Logo height={22} />
            <span className="text-sm text-gray-400">— Pricing Settings</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">These rates drive every job&apos;s cost and pay estimate</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Admin
          </Link>
          <Link href="/admin/drivers" className="text-sm text-gray-600 hover:text-gray-900">
            Drivers
          </Link>
          <Link href="/admin/applications" className="text-sm text-gray-600 hover:text-gray-900">
            Applications
          </Link>
          <SignOutButton />
        </div>
      </header>

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
          className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Settings'}
        </button>
        {saveError && <p className="text-sm text-red-600">Save failed: {saveError}</p>}
      </main>
    </div>
  )
}
