// app/dashboard/learning-compass/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Compass, Sparkles } from 'lucide-react'

export default function LearningCompassPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect after 1.5 seconds
    const timer = setTimeout(() => {
      router.push('/learn')
    }, 1500)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md mx-auto p-8">
        {/* Animated Icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 bg-indigo-400 rounded-full blur-xl opacity-50 animate-pulse" />
          <div className="relative w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl animate-bounce-slow">
            <Compass className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-black text-gray-900">
          Learning <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Compass</span>
        </h1>
        
        <p className="text-lg text-gray-600">
          Preparing your Learning Compass...
        </p>

        {/* Loading Spinner */}
        <div className="flex justify-center gap-2 pt-4">
          <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
          <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 mt-8 text-sm">
          <div className="bg-white/50 backdrop-blur rounded-xl p-3 border border-indigo-100">
            <Sparkles className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
            <p className="font-medium text-gray-700">Adaptive Learning</p>
          </div>
          <div className="bg-white/50 backdrop-blur rounded-xl p-3 border border-purple-100">
            <Sparkles className="w-4 h-4 text-purple-600 mx-auto mb-1" />
            <p className="font-medium text-gray-700">Real-time AI</p>
          </div>
        </div>

        {/* Note */}
        <p className="text-xs text-gray-400 mt-6">
          Redirecting you to your learning session...
        </p>
      </div>

      <style jsx>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}