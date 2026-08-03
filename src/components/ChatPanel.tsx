'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Message = {
  id: string
  sender_id: string | null
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
  customer: 'Customer',
}

export default function ChatPanel({ jobId, currentUserId, currentUserName, currentUserRole }: {
  jobId: string
  currentUserId: string
  currentUserName: string
  currentUserRole: string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    let active = true

    supabase
      .from('job_messages')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (active && data) setMessages(data as Message[])
      })

    const channel = supabase
      .channel(`job-messages-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_messages', filter: `job_id=eq.${jobId}` },
        (payload) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new as Message]))
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
    setDraft('')
    const { error } = await supabase.from('job_messages').insert({
      job_id: jobId,
      sender_id: currentUserId,
      sender_role: currentUserRole,
      sender_name: currentUserName,
      body,
    })
    if (error) setDraft(body)
    setSending(false)
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="max-h-72 overflow-y-auto p-3 space-y-2 bg-gray-50">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">No messages yet. Say hello 👋</p>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === currentUserId
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isMine ? 'bg-[#378ADD] text-white' : 'bg-white border border-gray-200 text-gray-900'}`}>
                {!isMine && (
                  <p className="text-[10px] uppercase tracking-wide opacity-60 mb-0.5">
                    {m.sender_name} · {roleLabels[m.sender_role] ?? m.sender_role}
                  </p>
                )}
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
