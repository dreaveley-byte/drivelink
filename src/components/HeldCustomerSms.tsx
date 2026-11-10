'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Held = { id: string; body: string; send_after: string }

// Shows automatic customer texts being held until the sending window opens,
// with an override for exceptional circumstances.
export default function HeldCustomerSms({ jobId }: { jobId: string }) {
  const [held, setHeld] = useState<Held[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data } = await createClient()
      .from('pending_customer_sms')
      .select('id, body, send_after')
      .eq('job_id', jobId)
      .is('sent_at', null)
      .is('superseded_at', null)
    setHeld((data ?? []) as Held[])
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  async function sendNow(id: string) {
    if (!confirm('Send this text to the customer now, outside the normal sending hours?')) return
    setBusy(id)
    setError(null)
    const res = await fetch('/api/customer-sms/send-held', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendingId: id }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) setError(json?.error ?? 'Could not send.')
    await load()
  }

  if (held.length === 0 && !error) return null
  return (
    <div className="border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 mt-2 space-y-2">
      {held.map((h) => (
        <div key={h.id}>
          <p className="text-xs text-amber-900">
            A text to the customer is on hold until{' '}
            {new Date(h.send_after).toLocaleString('en-CA', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Vancouver' })} (Pacific) so it doesn&apos;t arrive at night:
          </p>
          <p className="text-xs text-gray-700 italic mt-1">&ldquo;{h.body}&rdquo;</p>
          <button
            type="button"
            onClick={() => sendNow(h.id)}
            disabled={busy === h.id}
            className="text-xs mt-1 border border-amber-400 text-amber-900 rounded-lg px-3 py-1 hover:bg-amber-100 disabled:opacity-50"
          >
            {busy === h.id ? 'Sending…' : 'Send now anyway'}
          </button>
        </div>
      ))}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
