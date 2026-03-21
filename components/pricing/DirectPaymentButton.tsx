// components/pricing/DirectPaymentButton.tsx
'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface DirectPaymentButtonProps {
  amount: number
  email: string
  productId: string
  buttonText: string
  className?: string
}

export default function DirectPaymentButton({ 
  amount, 
  email, 
  productId,
  buttonText,
  className = '' 
}: DirectPaymentButtonProps) {
  const [loading, setLoading] = useState(false)

  const handlePayment = async () => {
    if (!email) {
      window.location.href = `/login?returnTo=/pricing&product=${productId}`
      return
    }

    setLoading(true)
    
    try {
      // For testing - direct to Paystack
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          type: productId === 'termly' ? 'subscription' : 'bundle',
          email,
        })
      })

      const data = await response.json()
      
      if (data.authorization_url) {
        window.location.href = data.authorization_url
      } else {
        alert('Payment failed. Please try again.')
        setLoading(false)
      }
    } catch (error) {
      console.error('Payment error:', error)
      alert('Payment failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className={`w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Processing...
        </>
      ) : (
        buttonText
      )}
    </button>
  )
}