'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

// Handles both formats Supabase's confirmation link can arrive in - this
// has to be a client page, not a server route, because one of the two
// formats (the older hash-fragment style, #access_token=...) is never
// sent to the server at all; only client-side JS can ever see it. A
// server route can only ever see the ?code= (PKCE) format, which turned
// out not to be the one actually in use here - that's why the previous
// server-only version always fell through to its error case and sent
// people to /login instead.
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <AuthCallbackInner />
    </Suspense>
  )
}

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const next = searchParams.get('next') || '/dashboard'
    const code = searchParams.get('code')
    let settled = false

    function goNext() {
      if (settled) return
      settled = true
      router.replace(next)
    }

    // The hash-fragment format (#access_token=...&refresh_token=...) is
    // picked up automatically by the browser client the moment it
    // initializes (detectSessionInUrl is on by default) - this just
    // listens for that to actually happen rather than assuming it already
    // has by the time this effect runs.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) goNext()
        })
      }
    })

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) goNext()
      })
    } else {
      // No ?code= - check whether a session already got picked up from a
      // hash fragment (it can happen before this effect even runs).
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) goNext()
      })
    }

    // If neither path produces a session within a few seconds, this link
    // genuinely isn't valid (expired, already used, or malformed) - show
    // an error instead of hanging on a blank page forever.
    const timeout = setTimeout(() => {
      if (!settled) setFailed(true)
    }, 6000)

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router, searchParams])

  if (failed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <Logo height={22} className="mx-auto mb-6" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">This link didn&apos;t work</h1>
          <p className="text-sm text-gray-500 mb-6">
            It may have expired or already been used. Try starting your application again, or log in if you&apos;ve already set a password.
          </p>
          <a href="/login" className="text-sm text-[#378ADD] hover:underline">Go to login →</a>
        </div>
      </div>
    )
  }

  return <div className="min-h-screen bg-white" />
}
