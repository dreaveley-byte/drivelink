'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { playChime } from '@/lib/chime'

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
  const [counterpartReadAt, setCounterpartReadAt] = useState<string | null>(null)
  const [typingName, setTypingName] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function markRead() {
    await supabase.from('job_chat_reads').upsert({ job_id: jobId, user_id: currentUserId, last_read_at: new Date().toISOString() })
  }

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

    markRead()

    // Track the "other side"'s read state to show a Read receipt on my own messages.
    // If I'm the driver, that's the dealer's admin(s); if I'm on the dealer side, it's the driver.
    async function loadCounterpartRead() {
      const { data: job } = await supabase.from('jobs').select('driver_id, organization_id').eq('id', jobId).single()
      if (!job) return
      if (currentUserRole === 'driver') {
        if (!job.organization_id) return
        const { data } = await supabase
          .from('job_chat_reads')
          .select('last_read_at, user_id, profiles!inner(role)')
          .eq('job_id', jobId)
          .eq('profiles.organization_id', job.organization_id)
          .order('last_read_at', { ascending: false })
          .limit(1)
        setCounterpartReadAt(data?.[0]?.last_read_at ?? null)
      } else {
        if (!job.driver_id) return
        const { data } = await supabase
          .from('job_chat_reads')
          .select('last_read_at')
          .eq('job_id', jobId)
          .eq('user_id', job.driver_id)
          .maybeSingle()
        setCounterpartReadAt(data?.last_read_at ?? null)
      }
    }
    loadCounterpartRead()

    const channel = supabase
      .channel(`job-messages-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_messages', filter: `job_id=eq.${jobId}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
          if (msg.sender_id !== currentUserId) {
            playChime()
            markRead()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_chat_reads', filter: `job_id=eq.${jobId}` },
        () => {
          loadCounterpartRead()
        }
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === currentUserId) return
        setTypingName(payload.name)
        if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current)
        stopTypingTimeoutRef.current = setTimeout(() => setTypingName(null), 3000)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function handleDraftChange(value: string) {
    setDraft(value)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, name: currentUserName },
    })
  }

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
    if (error) {
      setDraft(body)
    } else {
      fetch('/api/job-chat/notify-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, senderRole: currentUserRole, senderName: currentUserName, body }),
      }).catch(() => {})
    }
    setSending(false)
  }

  // Find my most recent message so we can show a Read tag under it
  const myLastMessage = [...messages].reverse().find((m) => m.sender_id === currentUserId)
  const myLastMessageRead = !!(
    myLastMessage && counterpartReadAt && new Date(counterpartReadAt) >= new Date(myLastMessage.created_at)
  )

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
        {myLastMessage && (
          <p className="text-[10px] text-gray-400 text-right pr-1">{myLastMessageRead ? 'Read' : 'Delivered'}</p>
        )}
        {typingName && (
          <p className="text-xs text-gray-400 italic">{typingName} is typing…</p>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 p-2 border-t border-gray-200 bg-white">
        <input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
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
