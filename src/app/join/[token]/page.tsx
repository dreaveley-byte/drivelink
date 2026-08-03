'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

export default function JoinInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [orgName, setOrgName] = useState<string | null>(null)
  const [alreadyAccepted, setAlreadyAccepted] = useState(false)
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [inviteError, setInviteError] = useState('')

  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    params.then(({ token }) => setToken(token))
  }, [params])

  useEffect(() => {
    if (!token) return
    const supabase = createClient()

    supabase.rpc('get_invite_info', { p_token: token }).then(({ data, error }) => {
      setLoadingInvite(false)
      if (error || !data || data.length === 0) {
        setInviteError('This invite link is invalid.')
        return
      }
      const info = Array.isArray(data) ? data[0] : data
      setOrgName(info.organization_name)
      setAlreadyAccepted(info.already_accepted)
    })

    supabase.auth.getUser().then(({ data: { user } }) => setLoggedIn(!!user))
  }, [token])

  async function acceptInvite() {
    const supabase = createClient()
    const { error } = await supabase.rpc('accept_org_invite', { p_token: token })
    if (error) {
      setError(error.message)
      return false
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      if (!data.session) {
        setError('Account created — check your email to confirm, then come back to this link to finish joining.')
        setLoading(false)
        return
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
    }

    const ok = await acceptInvite()
    setLoading(false)
    if (ok) {
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    }
  }

  async function handleAcceptAsLoggedInUser() {
    setLoading(true)
    const ok = await acceptInvite()
    setLoading(false)
    if (ok) {
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    }
  }

  if (loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <p className="text-sm text-gray-400">Loading invite…</p>
      </div>
    )
  }

  if (inviteError || alreadyAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="max-w-sm text-center">
          <Logo height={28} />
          <p className="text-sm text-gray-500 mt-6">
            {inviteError || 'This invite has already been used.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Logo height={32} />
        </div>

        {done ? (
          <p className="text-sm text-gray-700">You're in! Taking you to your dashboard…</p>
        ) : loggedIn ? (
          <div>
            <p className="text-sm text-gray-700 mb-6">
              Join <span className="font-medium">{orgName}</span> with your current account?
            </p>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <button
              onClick={handleAcceptAsLoggedInUser}
              disabled={loading}
              className="w-full bg-[#378ADD] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
            >
              {loading ? 'Joining…' : `Join ${orgName}`}
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">
              You've been invited to join <span className="font-medium text-gray-700">{orgName}</span> on Drivflo.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Full name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#378ADD] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#2d6ead] disabled:opacity-50"
              >
                {loading ? 'Please wait…' : mode === 'signup' ? 'Create account & join' : 'Sign in & join'}
              </button>
            </form>
            <button
              onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
              className="w-full text-center text-sm text-gray-500 mt-4 hover:text-gray-900"
            >
              {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
