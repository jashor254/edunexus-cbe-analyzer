// components/PaystackMobileButton.tsx
'use client'

import { useState } from 'react'
import { Smartphone, Loader2 } from 'lucide-react'

// Define the props type
interface PaystackMobileProps {
  amount: number
  email: string
  productId: string
  buttonText: string
}

export default function PaystackMobileButton({ 
  amount, 
  email, 
  productId,
  buttonText 
}: PaystackMobileProps) {
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState('')

  const handlePayment = async () => {
    if (!phone) {
      alert('Tafadhali weka nambari ya simu')
      return
    }

    setLoading(true)

    try {
      // Call your API endpoint
      const response = await fetch('/api/payments/mobile-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || 'test@example.com',
          amount: amount,
          phone: phone,
          productId: productId,
          channels: ['mpesa'] // Force M-PESA only
        })
      })

      const data = await response.json()
      
      if (data.authorization_url) {
        // Redirect to Paystack M-PESA page
        window.location.href = data.authorization_url
      } else {
        alert('Payment failed. Jaribu tena.')
        setLoading(false)
      }
    } catch (error) {
      console.error('Payment error:', error)
      alert('Payment error. Jaribu tena.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Nambari ya M-PESA (e.g., 0712345678)"
        className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
      />
      
      <button
        onClick={handlePayment}
        disabled={loading}
        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Inachakata...
          </>
        ) : (
          <>
            <Smartphone className="w-5 h-5" />
            {buttonText}
          </>
        )}
      </button>
      
      <p className="text-xs text-center text-gray-500">
        🔒 Utapokea STK Push kwenye simu yako
      </p>
    </div>
  )
}