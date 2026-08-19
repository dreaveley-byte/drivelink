'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DiscountCodeRedeemer({ orgId }: { orgId: string }) {
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [existing, setExisting] = useState<{ code: string; percent: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('organizations')
      .select('discount_code_id, discount_codes(code, discount_percent)')
      .eq('id', orgId)
      .single()
      .then(({ data }) => {
        const dc = data?.discount_codes
        const discountInfo = Array.isArray(dc) ? dc[0] : dc
        if (discountInfo) {
          setExisting({ code: discountInfo.code, percent: discountInfo.discount_percent })
        }
        setLoading(false)
      })
  }, [orgId])

  async function redeem() {
    if (!code.trim()) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('redeem_discount_code', { p_org_id: orgId, p_code: code.trim() })
    setSaving(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setSuccess(true)
  }

  if (loading) return null

  if (existing || success) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-3 mt-4">
        <p className="text-sm text-green-700">
          Discount code applied{existing && ` (${existing.code})`} — {existing?.percent ?? ''}% off your delivery pricing.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 mt-4">
      <p className="text-sm font-medium text-gray-900 mb-1">Have a discount code?</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter code"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase"
        />
        <button
          onClick={redeem}
          disabled={saving || !code.trim()}
          className="bg-[#378ADD] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
        >
          {saving ? 'Applying…' : 'Apply'}
        </button>
      </div>
    </div>
  )
}
