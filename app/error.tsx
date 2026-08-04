'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/observability/logger'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Unhandled render error', { operation: 'app.error_boundary', digest: error.digest }, error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 p-6 text-center">
      <div className="bg-red-50 p-4 rounded-full">
        <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-slate-800">Kuna kitu kimeenda mrama!</h2>
      <p className="text-slate-600 max-w-md">
        Samahani, imetokea hitilafu isiyotarajiwa. Jaribu tena, na kama tatizo litaendelea, tafadhali tujulishe.
      </p>

      <button
        onClick={() => reset()}
        className="px-6 py-2 bg-trustblue-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
      >
        Jaribu Tena
      </button>
    </div>
  )
}
