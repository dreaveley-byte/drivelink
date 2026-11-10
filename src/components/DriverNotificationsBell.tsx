'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { playChime } from '@/lib/chime'

export type DriverNotification = {
  id: string
  kind: string
  title: string
  body: string | null
  job_id: string | null
  read_at: string | null
  created_at: string
}

// In-app notification list (new jobs, chat messages, customer texts). New ones
// arrive live and ring the bell badge; opening the list marks them read.
export default function DriverNotificationsBell({ driverId, initial }: { driverId: string; initial: DriverNotification[] }) {
  const router = useRouter()
  const [items, setItems] = useState<DriverNotification[]>(initial)
  const [open, setOpen] = useState(false)
  const unread = items.filter((n) => !n.read_at).length

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`driver-notifications-${driverId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'driver_notifications', filter: `driver_id=eq.${driverId}` },
        (payload) => {
          setItems((prev) => [payload.new as DriverNotification, ...prev].slice(0, 30))
          playChime()
          router.refresh()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      const now = new Date().toISOString()
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
      await createClient().from('driver_notifications').update({ read_at: now }).eq('driver_id', driverId).is('read_at', null)
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={toggle} aria-label="Notifications" className="relative text-gray-600 hover:text-gray-900 p-1">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4 text-center">{unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[85vw] bg-white border border-gray-200 rounded-xl shadow-lg z-40 max-h-96 overflow-y-auto">
          {items.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No notifications yet.</p>}
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.kind === 'new_job' ? '/driver?tab=available' : '/driver?tab=claimed'}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50"
            >
              <p className="text-sm font-medium text-gray-900">{n.title}</p>
              {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
              <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
