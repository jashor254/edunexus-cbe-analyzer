'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function TestCallback() {
  const [status, setStatus] = useState('Testing...')
  const router = useRouter()

  useEffect(() => {
    const test = async () => {
      console.log('Test callback hit')
      setStatus('Callback working! Redirecting...')
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    }
    test()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Callback Test Page</h1>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  )
}