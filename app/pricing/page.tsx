// app/pricing/page.tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { CheckCircle2, Loader2, Smartphone, Sparkles, ChevronRight, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const PRODUCTS = [
  { id: 'starter', name: 'Starter Pack', price: 100, tokens: 10, features: ['10 Tokens', 'Full Academic Clinic report', 'Valid 30 days'], badge: '🎯 Try First' },
  { id: 'popular', name: 'Popular Pack', price: 300, tokens: 35, features: ['35 Tokens', 'Multiple Reports', 'Best Value'], badge: '⭐ Most Popular' },
  { id: 'termly', name: 'Termly Plan', price: 1500, tokens: 'Unlimited', features: ['Unlimited Reports', 'AI Tutor 24/7', 'Full Term Access'], badge: '💎 Best Value' },
]

function PricingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [selected, setSelected] = useState<any>(null)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [autoTriggered, setAutoTriggered] = useState(false)

  useEffect(() => {
    const sync = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const productId = searchParams.get('product') || localStorage.getItem('pending_plan')
      const savedPhone = localStorage.getItem('pending_phone')

      if (savedPhone && savedPhone.length > 0 && phone.length === 0) {
        setPhone(savedPhone)
      }

      if (productId) {
        const found = PRODUCTS.find(p => p.id === productId)
        if (found) {
          setSelected(found)
          
          if (user && savedPhone && searchParams.get('product') && !autoTriggered && savedPhone.length >= 9) {
            setAutoTriggered(true)
            handlePayNow(found, savedPhone, user.email!)
          }
        }
      }
    }
    sync()
  }, [supabase, searchParams, user, autoTriggered])

  const handlePayNow = async (product: any, phoneNum: string, email: string) => {
    if (loading) return
    setLoading(true)
    
    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          phoneNumber: phoneNum,
          amount: product.price,
          email: email
        })
      })

      const data = await res.json()
      if (data.authorization_url) {
        localStorage.removeItem('pending_plan')
        localStorage.removeItem('pending_phone')
        window.location.href = data.authorization_url
      } else {
        alert(data.error || 'Payment failed')
        setLoading(false)
      }
    } catch (e) {
      console.error(e)
      alert('Network error')
      setLoading(false)
    }
  }

  const handleAction = () => {
    if (!selected) return
    
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 9) {
      alert("Enter valid M-PESA number (10 digits)")
      return
    }
    
    if (!user) {
      localStorage.setItem('pending_plan', selected.id)
      localStorage.setItem('pending_phone', cleanPhone)
      router.push(`/login?returnTo=/pricing&product=${selected.id}`)
      return
    }

    handlePayNow(selected, cleanPhone, user.email!)
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-xl px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-black">EduNexus<span className="text-purple-500">.</span></Link>
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white">← Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black mb-4">Simple, Honest Pricing</h1>
          <p className="text-slate-400">Choose the plan that works for you</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PRODUCTS.map((item) => (
            <div 
              key={item.id} 
              onClick={() => setSelected(item)}
              className={`p-8 rounded-2xl border-2 cursor-pointer transition-all ${
                selected?.id === item.id 
                ? 'bg-white text-black border-purple-500' 
                : 'bg-slate-900/50 border-white/10 hover:border-purple-500/50'
              }`}
            >
              <span className="text-sm font-bold text-purple-500">{item.badge}</span>
              <h3 className="text-2xl font-bold mt-2">{item.name}</h3>
              <div className="mt-4">
                <span className="text-4xl font-black">KES {item.price}</span>
                {item.tokens !== 'Unlimited' && <span className="text-sm ml-1">/{item.tokens} tokens</span>}
              </div>
              <ul className="mt-6 space-y-2">
                {item.features.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Checkout Bar */}
      {selected && (
        <div className="fixed bottom-0 inset-x-0 bg-white p-6 border-t-4 border-purple-500 z-50">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 items-center text-black">
            <div className="flex-1">
              <p className="text-sm font-bold">{selected.name} — KES {selected.price}</p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <input 
                type="tel"
                placeholder="07XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0,10))}
                className="border p-4 rounded-xl w-full md:w-64 text-black"
              />
              <button 
                onClick={handleAction}
                disabled={loading || (phone.length > 0 && phone.length !== 10)}
                className="bg-black text-white px-8 py-4 rounded-xl font-bold disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : (user ? 'Pay Now' : 'Login to Pay')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center">Loading...</div>}>
      <PricingContent />
    </Suspense>
  )
}