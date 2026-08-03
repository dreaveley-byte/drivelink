'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [intendedRole, setIntendedRole] = useState<'driver' | 'dealer' | ''>('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const [resetSent, setResetSent] = useState(false)

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first, then click "Forgot password?"')
      return
    }
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError(error.message)
      return
    }
    setResetSent(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    if (mode === 'signup') {
      if (!intendedRole) {
        setError('Please choose whether you want to become a driver or a dealer.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { intended_role: intendedRole } },
      })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // If email confirmation isn't required, Supabase signs the user in immediately —
      // in that case, send them straight to the right application instead of making
      // them log in again.
      if (data.session) {
        router.push(intendedRole === 'driver' ? '/driver/apply' : '/dashboard/apply')
        router.refresh()
        return
      }

      setError('Account created. Check your email to confirm, then log in to start your application.')
      setMode('login')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-sm px-6">
        <div className="mb-6">
          <Logo height={36} />
        </div>
        <p className="text-sm text-gray-500 mb-8">
          {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm text-gray-700 mb-1">What are you looking for?</label>
              <select
                required
                value={intendedRole}
                onChange={(e) => setIntendedRole(e.target.value as 'driver' | 'dealer' | '')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                <option value="" disabled>Select one...</option>
                <option value="driver">Become a driver</option>
                <option value="dealer">Become a dealer</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {resetSent && <p className="text-sm text-green-700">Reset email sent — check your inbox.</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        {mode === 'login' && (
          <button
            onClick={handleForgotPassword}
            className="w-full text-center text-xs text-gray-400 mt-3 hover:text-gray-700"
          >
            Forgot password?
          </button>
        )}

        <button
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="w-full text-center text-sm text-gray-500 mt-4 hover:text-gray-900"
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
