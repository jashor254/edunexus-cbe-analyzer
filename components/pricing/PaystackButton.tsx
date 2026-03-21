'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface PaystackButtonProps {
  amount: number
  email: string
  productId: 'starter' | 'popular' | 'pro' | 'termly'
  productType: 'bundle' | 'subscription'
  tokenAmount?: number
  buttonText?: string
  className?: string
  phoneNumber?: string
}

export default function PaystackButton({ 
  amount, 
  email, 
  productId,
  productType,
  tokenAmount,
  buttonText,
  className = '',
  phoneNumber = ''
}: PaystackButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handlePayment = async () => {
    // Validate phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '')
    if (!cleanPhone || cleanPhone.length < 9) {
      setError('Please enter a valid M-PESA number')
      return
    }

    if (!email) {
      // Save pending payment info and redirect to login
      localStorage.setItem('pending_plan', productId)
      localStorage.setItem('pending_phone', cleanPhone)
      router.push(`/login?returnTo=/pricing&product=${productId}`)
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          phoneNumber: cleanPhone,
          amount,
          type: productType,
          email
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Payment initialization failed')
      }

      if (data.authorization_url) {
        // Clean up pending items
        localStorage.removeItem('pending_plan')
        localStorage.removeItem('pending_phone')
        window.location.href = data.authorization_url
      } else {
        throw new Error('No authorization URL received')
      }

    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const defaultText = `Pay KES ${amount.toLocaleString()}`

  return (
    <div>
      <button
        onClick={handlePayment}
        disabled={loading}
        className={`w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          buttonText || defaultText
        )}
      </button>
      
      {error && (
        <p className="text-red-500 text-sm mt-2 font-semibold">{error}</p>
      )}
    </div>
  )
}