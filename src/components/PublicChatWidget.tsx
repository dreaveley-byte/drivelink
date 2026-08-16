'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Message = { id: string; direction: 'to_customer' | 'from_customer'; body: string; created_at: string }

export default function PublicChatWidget({ token, driverName }: { token: string; driverName: string | null }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  async function loadMessages() {
    const { data } = await supabase.rpc('get_tracking_messages', { p_token: token })
    if (data) setMessages(data as Message[])
  }

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 5000)
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
    setError('')
    const { error: sendError } = await supabase.rpc('send_tracking_message', { p_token: token, p_body: body })
    setSending(false)
    if (sendError) {
      setError(sendError.message)
      return
    }
    setDraft('')
    loadMessages()
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 mt-4">
      <p className="text-sm font-medium text-gray-900 mb-3">Chat with {driverName || 'your driver'}</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-2 max-h-56 overflow-y-auto mb-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400">No messages yet — send one below.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === 'from_customer' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                m.direction === 'from_customer' ? 'bg-[#378ADD] text-white' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {m.body}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="bg-[#378ADD] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
