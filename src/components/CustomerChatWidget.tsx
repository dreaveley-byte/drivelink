'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Message = {
  id: string
  sender_role: string
  sender_name: string
  body: string
  created_at: string
}

const roleLabels: Record<string, string> = {
  driver: 'Driver',
  org_member: 'Dealer',
  org_admin: 'Dealer',
  platform_admin: 'Drivflo',
  customer: 'You',
}

export default function CustomerChatWidget({ token }: { token: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.rpc('get_tracking_messages', { p_token: token })
    if (data) setMessages(data as Message[])
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 8000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setDraft('')
    const { error } = await supabase.rpc('send_tracking_message', { p_token: token, p_body: body })
    if (!error) {
      await load()
      fetch('/api/job-chat/notify-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senderRole: 'customer', body }),
      }).catch(() => {})
    } else {
      setDraft(body)
    }
    setSending(false)
  }

  return (
    <div className="mt-6 border border-gray-200 rounded-xl overflow-hidden">
      <p className="text-xs text-gray-400 uppercase tracking-wide px-3 pt-3">Message your driver</p>
      <div className="max-h-56 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No messages yet.</p>
        )}
        {messages.map((m) => {
          const isMine = m.sender_role === 'customer'
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isMine ? 'bg-[#378ADD] text-white' : 'bg-gray-100 text-gray-900'}`}>
                {!isMine && (
                  <p className="text-[10px] uppercase tracking-wide opacity-60 mb-0.5">
                    {roleLabels[m.sender_role] ?? m.sender_role}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 p-2 border-t border-gray-200">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Type a message…"
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
    </div>
  )
}
