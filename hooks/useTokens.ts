// hooks/useTokens.ts
// Client-side hook for gated feature access.
// Sends only `feature` — userId comes from the server session, never from the client.

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { type FeatureKey, type UserTier } from '@/lib/payments/config'

export type { FeatureKey }

export interface TokenCheckResponse {
  allowed:      boolean
  tier:         UserTier
  deductTokens: boolean
  cost:         number
  error?:       string
}

export interface TokenDeductResponse {
  success:   boolean
  deducted?: boolean
  tier?:     UserTier
  cost?:     number
  error?:    string
}

export interface UseTokensReturn {
  checkAccess:    (feature: FeatureKey) => Promise<boolean>
  deductTokens:   (feature: FeatureKey) => Promise<boolean>
  withTokens:     <T>(feature: FeatureKey, action: () => Promise<T>) => Promise<T | null>
  tokensRemaining: number | 'unlimited'
  isChecking:     boolean
}

export function useTokens(): UseTokensReturn {
  const router = useRouter()
  const [isChecking, setIsChecking]         = useState(false)
  const [tokensRemaining, setTokensRemaining] = useState<number | 'unlimited'>(0)

  const checkAccess = useCallback(async (feature: FeatureKey): Promise<boolean> => {
    setIsChecking(true)
    try {
      const response = await fetch('/api/tokens/check', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ feature }),
      })

      const data: TokenCheckResponse = await response.json()

      if (!response.ok) {
        if (response.status === 403 && data.error === 'insufficient_tokens') {
          router.push('/pricing')
        }
        return false
      }

      // Track remaining balance for token users
      if (data.tier === 'token') {
        setTokensRemaining(prev =>
          typeof prev === 'number' ? Math.max(0, prev - (data.cost ?? 0)) : prev
        )
      } else {
        setTokensRemaining('unlimited')
      }

      return data.allowed
    } catch (error: unknown) {
      console.error('[useTokens] checkAccess error:', error)
      return false
    } finally {
      setIsChecking(false)
    }
  }, [router])

  const deductTokens = useCallback(async (feature: FeatureKey): Promise<boolean> => {
    try {
      const response = await fetch('/api/tokens/deduct', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ feature }),
      })

      const data: TokenDeductResponse = await response.json()

      if (!response.ok) {
        if (data.error === 'insufficient_tokens') {
          router.push('/pricing')
        }
        return false
      }

      if (data.deducted && data.cost) {
        setTokensRemaining(prev =>
          typeof prev === 'number' ? Math.max(0, prev - data.cost!) : prev
        )
      }

      return data.success
    } catch (error: unknown) {
      console.error('[useTokens] deductTokens error:', error)
      return false
    }
  }, [router])

  const withTokens = useCallback(async <T,>(
    feature: FeatureKey,
    action: () => Promise<T>
  ): Promise<T | null> => {
    const hasAccess = await checkAccess(feature)
    if (!hasAccess) return null

    try {
      const result = await action()
      await deductTokens(feature)
      return result
    } catch (error: unknown) {
      console.error('[useTokens] withTokens action error:', error)
      return null
    }
  }, [checkAccess, deductTokens])

  return { checkAccess, deductTokens, withTokens, tokensRemaining, isChecking }
}
