'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, X, PartyPopper } from 'lucide-react'
import confetti from 'canvas-confetti' // Hakikisha umepiga: npm install canvas-confetti

export function SuccessHandler() {
  const searchParams = useSearchParams()
  const [showBanner, setShowBanner] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Paystack mara nyingi inarudisha 'reference' au 'trxref'
    const reference = searchParams.get('reference') || searchParams.get('trxref')
    const plan = searchParams.get('plan') || searchParams.get('product') // tunapitisha hii kwenye callback URL yetu

    if (reference) {
      // 1. Tambua ujumbe kulingana na plan
      if (plan === 'token' || plan === 'bundle' || plan === 'starter' || plan === 'popular' || plan === 'pro') {
        setMessage('Hongera! Tokeni zako zimeongezwa. Unaweza kuanza uchambuzi sasa.')
      } else if (plan === 'termly' || plan === 'single' || plan === 'subscription') {
        setMessage('Hongera! Plan ya Termly imewashwa. Furahia access ya muhula mzima.')
      } else {
        setMessage('Malipo yamefanikiwa! Akaunti yako imesasishwa kikamilifu.')
      }

      // 2. Washa Banner
      setShowBanner(true)

      // 3. Mlipuko wa Confetti (The Magic Touch)
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      // 4. Safisha URL ili mteja akirefresh asione tena banner
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)

      // 5. Jifunge baada ya sekunde 10
      const timer = setTimeout(() => setShowBanner(false), 10000)
      return () => {
        clearTimeout(timer)
        clearInterval(interval)
      }
    }
  }, [searchParams])

  if (!showBanner) return null

  return (
    <>
      {/* Backdrop iliyopambwa */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99] animate-in fade-in duration-500"
        onClick={() => setShowBanner(false)}
      />

      {/* Success Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[95%] max-w-md animate-in zoom-in duration-300">
        <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border-4 border-green-500 p-8 overflow-hidden relative">
          
          {/* Sherehe Background */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-400" />

          {/* Close button */}
          <button 
            onClick={() => setShowBanner(false)}
            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex flex-col items-center text-center">
            {/* Animated Icon */}
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 relative">
              <CheckCircle className="w-14 h-14 text-green-600 z-10" />
              <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-20" />
            </div>

            <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">
              MALIPO YAMEKUBALI!
            </h2>

            <p className="text-slate-600 font-bold text-lg leading-snug mb-8 px-2">
              {message}
            </p>

            <button
              onClick={() => setShowBanner(false)}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-5 rounded-2xl font-black text-lg uppercase tracking-wider transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-xl"
            >
              <PartyPopper className="w-6 h-6" /> Anza Sasa
            </button>
          </div>
        </div>
      </div>
    </>
  )
}