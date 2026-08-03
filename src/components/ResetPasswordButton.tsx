'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordButton({ email }: { email: string | null }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleClick() {
    if (!email) return
    setStatus('sending')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setStatus(error ? 'error' : 'sent')
  }

  if (!email) {
    return <span className="text-xs text-gray-300">No email on file</span>
  }

  if (status === 'sent') {
    return <span className="text-xs text-green-700">Reset email sent to {email}</span>
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'sending'}
      className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
    >
      {status === 'sending' ? 'Sending…' : status === 'error' ? 'Failed — try again' : 'Send password reset email'}
    </button>
  )
}
