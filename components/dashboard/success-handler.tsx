'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, X } from 'lucide-react'

export function SuccessHandler() {
  const searchParams = useSearchParams()
  const [showBanner, setShowBanner] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const status = searchParams.get('status')
    const reference = searchParams.get('reference')
    const plan = searchParams.get('plan') // token, single, or family

    if (status === 'success' || reference) {
      // Set appropriate message based on what they bought
      if (plan === 'token') {
        setMessage('Tokens added successfully! You can start analyzing now.')
      } else if (plan === 'single') {
        setMessage('Unlimited plan activated! Enjoy unlimited access.')
      } else if (plan === 'family') {
        setMessage('Family plan activated! Track up to 3 children.')
      } else {
        setMessage('Payment successful! Your account has been updated.')
      }

      // Show banner
      setShowBanner(true)

      // Clean up URL immediately
      window.history.replaceState({}, '', '/dashboard')

      // Optional: Confetti effect (if you have a library)
      // triggerConfetti()

      // Hide banner after 8 seconds
      const timer = setTimeout(() => setShowBanner(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  if (!showBanner) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-[99] animate-in fade-in duration-300"
        onClick={() => setShowBanner(false)}
      />

      {/* Success Banner */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[90%] max-w-md animate-in zoom-in duration-300">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-3xl shadow-2xl border-4 border-white p-8 relative">
          {/* Close button */}
          <button 
            onClick={() => setShowBanner(false)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="flex flex-col items-center text-center">
            {/* Success icon with animation */}
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>

            {/* Title */}
            <h2 className="text-3xl font-black mb-3 uppercase tracking-tight">
              Payment Success!
            </h2>

            {/* Message */}
            <p className="text-lg font-semibold mb-6 leading-relaxed opacity-90">
              {message}
            </p>

            {/* CTA */}
            <button
              onClick={() => setShowBanner(false)}
              className="bg-white text-green-600 px-8 py-3 rounded-xl font-black uppercase tracking-wide hover:bg-green-50 transition-all"
            >
              Get Started
            </button>
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-2 -left-2 w-8 h-8 bg-yellow-400 rounded-full animate-pulse" />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full animate-pulse delay-75" />
        </div>
      </div>
    </>
  )
}