'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, ArrowLeft, Home, Sparkles } from 'lucide-react'
import Link from 'next/link'

type PaymentStatus = 'processing' | 'success' | 'failed' | null

export default function PaymentFeedback() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<PaymentStatus>(null)
  const [message, setMessage] = useState('')

  const reference = searchParams.get('reference')
  const trxref = searchParams.get('trxref')
  const txRef = reference || trxref

  useEffect(() => {
    if (!txRef) {
      setStatus('failed')
      setMessage('Hakuna reference ya malipo. Tafadhali jaribu tena.')
      return
    }

    const verifyPayment = async () => {
      setStatus('processing')
      
      try {
        const response = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: txRef })
        })

        const data = await response.json()

        if (response.ok && data.success) {
          setStatus('success')
          setMessage('Malipo yamekamilika kikamilifu! Tokens zimeongezwa kwenye akaunti yako.')
          
          // Auto redirect after 3 seconds
          setTimeout(() => {
            router.push('/dashboard/clinic')
          }, 3000)
        } else {
          setStatus('failed')
          setMessage(data.error || 'Malipo yameshindwa. Tafadhali jaribu tena.')
        }
      } catch (error) {
        setStatus('failed')
        setMessage('Kuna tatizo la kiufundi. Tafadhali jaribu tena baadaye.')
      }
    }

    verifyPayment()
  }, [txRef, router])

  // If no transaction reference, show error
  if (!txRef) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/30 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border-2 border-red-200 shadow-xl text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3">Payment Error</h2>
          <p className="text-gray-600 mb-8">Hakuna reference ya malipo. Tafadhali jaribu tena.</p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Pricing
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border-2 border-slate-100 shadow-xl text-center">
        
        {/* Status Icon */}
        <div className="mb-6">
          {status === 'processing' && (
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-50 animate-pulse" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-white animate-spin" />
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-green-400 rounded-full blur-xl opacity-50 animate-pulse" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
            </div>
          )}

          {status === 'failed' && (
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-red-400 rounded-full blur-xl opacity-50" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center">
                <XCircle className="w-12 h-12 text-white" />
              </div>
            </div>
          )}

          {!status && (
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-amber-400 rounded-full blur-xl opacity-50" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-gray-900 mb-3">
          {status === 'processing' && 'Verifying Payment...'}
          {status === 'success' && 'Payment Successful! 🎉'}
          {status === 'failed' && 'Payment Failed'}
          {!status && 'Payment Received'}
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          {message || 'Processing your payment. Please wait...'}
        </p>

        {/* Reference */}
        <div className="bg-slate-50 rounded-xl p-4 mb-8 font-mono text-sm text-slate-600 border border-slate-200">
          Reference: {txRef}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {status === 'success' && (
            <>
              <Link
                href="/dashboard/clinic"
                className="block w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg"
              >
                Go to Clinic Dashboard
              </Link>
              <Link
                href="/dashboard"
                className="block w-full py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
              >
                <Home className="w-4 h-4 inline mr-2" />
                Back to Dashboard
              </Link>
            </>
          )}

          {status === 'failed' && (
            <>
              <Link
                href="/pricing"
                className="block w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
              >
                Try Again
              </Link>
              <Link
                href="/dashboard"
                className="block w-full py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
              >
                Back to Dashboard
              </Link>
            </>
          )}

          {status === 'processing' && (
            <p className="text-sm text-slate-500">
              Usifunge ukurasa huu. Tunaverify malipo yako...
            </p>
          )}

          {!status && (
            <Link
              href="/dashboard"
              className="block w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
            >
              Go to Dashboard
            </Link>
          )}
        </div>

        {/* Note */}
        {status === 'processing' && (
          <p className="text-xs text-slate-400 mt-6">
            Hii inachukua sekunde chache. Asubiri...
          </p>
        )}
      </div>
    </div>
  )
}