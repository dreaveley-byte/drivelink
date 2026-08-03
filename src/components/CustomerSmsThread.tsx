'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { playChime } from '@/lib/chime'

type CustomerMessage = {
  id: string
  direction: 'to_customer' | 'from_customer'
  body: string
  created_at: string
}

export default function CustomerSmsThread({ jobId, hasCustomerPhone }: { jobId: string; hasCustomerPhone: boolean }) {
  const [messages, setMessages] = useState<CustomerMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    let active = true

    supabase
      .from('customer_messages')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (active && data) setMessages(data as CustomerMessage[])
      })

    const channel = supabase
      .channel(`customer-messages-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'customer_messages', filter: `job_id=eq.${jobId}` },
        (payload) => {
          const msg = payload.new as CustomerMessage
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
          if (msg.direction === 'from_customer') playChime()
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    const res = await fetch('/api/customer-sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, body }),
    })
    const resBody = await res.json().catch(() => ({}))
    if (res.ok) {
      setDraft('')
    } else if (res.status === 501) {
      setError('Texting isn\u2019t turned on yet.')
    } else {
      setError(resBody.error || 'Could not send the text.')
    }
    setSending(false)
  }

  if (!hasCustomerPhone) {
    return <p className="text-xs text-gray-400">No customer phone number on file for this job.</p>
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="max-h-72 overflow-y-auto p-3 space-y-2 bg-gray-50">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">No texts with the customer yet.</p>
        )}
        {messages.map((m) => {
          const isOutbound = m.direction === 'to_customer'
          return (
            <div key={m.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isOutbound ? 'bg-[#378ADD] text-white' : 'bg-white border border-gray-200 text-gray-900'}`}>
                {!isOutbound && <p className="text-[10px] uppercase tracking-wide opacity-60 mb-0.5">Customer</p>}
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 p-2 border-t border-gray-200 bg-white">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Text the customer…"
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="text-sm bg-[#378ADD] text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
        >
          Send
        </button>
      </div>
      {error && <p className="text-xs text-red-600 px-2 pb-2">{error}</p>}
    </div>
  )
}
