// app/signup/page.tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Gift, Sparkles, Mail, Lock, User as UserIcon } from 'lucide-react'

// Separate component that uses useSearchParams
function SignupForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [hasReferral, setHasReferral] = useState(false)

  // Detect referral code from URL
  useEffect(() => {
    const refCode = searchParams.get('ref')
    if (refCode) {
      setReferralCode(refCode)
      setHasReferral(true)
    }
  }, [searchParams])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Step 1: Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      if (authData.user) {
        // Step 2: Create user record with referral tracking
        const userResponse = await fetch('/api/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            name: name || null,
            referralCode: referralCode || null,
          }),
        })

        const userData = await userResponse.json()

        if (!userData.success) {
          throw new Error(userData.error || 'Failed to create user profile')
        }

        // Success message
        const message = referralCode
          ? '🎉 Account created! You got 1 FREE analysis and your referrer got 2!'
          : '🎉 Account created! You have 1 FREE analysis waiting!'

        alert(message)
        router.push('/dashboard')
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Referral Bonus Banner */}
        {hasReferral && (
          <div className="mb-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-center shadow-lg animate-pulse">
            <div className="flex items-center justify-center gap-2 text-white">
              <Gift className="w-6 h-6" />
              <span className="font-bold text-lg">
                BONUS! You've Been Referred! 🎉
              </span>
            </div>
            <p className="text-white/90 text-sm mt-1">
              Get 1 FREE AI analysis + your friend gets 2!
            </p>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
            <p className="text-gray-600 mt-2">
              {hasReferral 
                ? 'Claim your FREE analysis now!' 
                : 'Start with 1 FREE AI scheme analysis'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
                <span className="text-red-600 text-xl">⚠️</span>
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Name Field */}
            <div>
              <label 
                htmlFor="name" 
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="teacher@example.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="At least 6 characters"
                />
              </div>
            </div>

            {/* Referral Code Field (if not from URL) */}
            {!hasReferral && (
              <div>
                <label 
                  htmlFor="referralCode" 
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Referral Code (Optional)
                </label>
                <div className="relative">
                  <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="referralCode"
                    name="referralCode"
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all uppercase"
                    placeholder="ABCD1234"
                    maxLength={8}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Have a friend's code? Both of you get bonus analyses! 🎁
                </p>
              </div>
            )}

            {/* Referral Code Display (if from URL) */}
            {hasReferral && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 mb-1">
                  <Gift className="w-5 h-5" />
                  <span className="font-semibold">Referral Code Applied:</span>
                </div>
                <p className="text-2xl font-mono font-bold text-green-600 ml-7">
                  {referralCode}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          {/* Benefits */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center mb-3 font-semibold">
              ✨ What you get for FREE:
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-green-600" />
                </div>
                <span>
                  {hasReferral ? '1 FREE analysis (+ 2 for your friend!)' : '1 FREE AI scheme analysis'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-green-600" />
                </div>
                <span>Full access to all features</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-green-600" />
                </div>
                <span>Earn more by referring friends</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center mt-6 text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// Main component with Suspense wrapper
export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}