// ============================================
// USE TOKENS HOOK (Client-side helper)
// File: hooks/useTokens.ts
// ============================================

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// Type definitions
export type TokenFeature = 
  | 'add_assessment_basic'
  | 'add_assessment_detailed'
  | 'generate_pdf'
  | 'ai_career_analysis'
  | 'ai_chat_session'
  | 'download_clinic'

export interface TokenCheckResponse {
  canProceed: boolean
  method: 'subscription' | 'tokens'
  tokensRequired: number
  tokensAvailable: number | 'unlimited'
  needToPurchase?: boolean
  subscription?: {
    plan_type: string
    end_date: string
  }
}

export interface TokenDeductResponse {
  success: boolean
  method?: 'subscription' | 'tokens'
  tokensDeducted?: number
  tokensRemaining?: number | 'unlimited'
  error?: string
  tokensRequired?: number
  tokensAvailable?: number
  message?: string
}

export interface UseTokensReturn {
  checkAccess: (feature: TokenFeature) => Promise<boolean>
  deductTokens: (feature: TokenFeature) => Promise<boolean>
  withTokens: <T>(feature: TokenFeature, action: () => Promise<T>) => Promise<T | null>
  tokensRemaining: number | 'unlimited'
  isChecking: boolean
}

// Main hook
export function useTokens(userId: string): UseTokensReturn {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)
  const [tokensRemaining, setTokensRemaining] = useState<number | 'unlimited'>(0)

  /**
   * Check if user can perform action (has subscription or tokens)
   */
  const checkAccess = useCallback(async (feature: TokenFeature): Promise<boolean> => {
    setIsChecking(true)
    
    try {
      const response = await fetch('/api/tokens/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, feature })
      })

      const data: TokenCheckResponse = await response.json()

      if (!response.ok) {
        throw new Error('Failed to check access')
      }

      setTokensRemaining(data.tokensAvailable)

      if (!data.canProceed) {
        // Show insufficient tokens notification
        // You can replace this with your toast system
        console.warn(`Insufficient tokens: need ${data.tokensRequired}, have ${data.tokensAvailable}`)
        
        // Optionally redirect to pricing
        if (typeof window !== 'undefined' && data.needToPurchase) {
          const shouldRedirect = confirm(
            `You need ${data.tokensRequired} tokens but only have ${data.tokensAvailable}. Go to pricing?`
          )
          if (shouldRedirect) {
            router.push('/pricing')
          }
        }
        
        return false
      }

      return true

    } catch (error: any) {
      console.error('Access check error:', error)
      return false
    } finally {
      setIsChecking(false)
    }
  }, [userId, router])

  /**
   * Deduct tokens after performing action
   */
  const deductTokens = useCallback(async (feature: TokenFeature): Promise<boolean> => {
    try {
      const response = await fetch('/api/tokens/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, feature })
      })

      const data: TokenDeductResponse = await response.json()

      if (!response.ok) {
        if (data.error === 'insufficient_tokens') {
          console.warn(`Insufficient tokens: need ${data.tokensRequired}, have ${data.tokensAvailable}`)
          router.push('/pricing')
        } else {
          console.error('Failed to deduct tokens:', data.error)
        }
        return false
      }

      // Update remaining tokens
      if (data.tokensRemaining !== undefined) {
        setTokensRemaining(data.tokensRemaining)
      }

      // Log success
      if (data.method === 'tokens' && data.tokensDeducted) {
        console.log(`${data.tokensDeducted} token(s) used. ${data.tokensRemaining} remaining`)
      }

      return true

    } catch (error: any) {
      console.error('Token deduction error:', error)
      return false
    }
  }, [userId, router])

  /**
   * Complete workflow: Check access → Perform action → Deduct tokens
   */
  const withTokens = useCallback(async <T,>(
    feature: TokenFeature,
    action: () => Promise<T>
  ): Promise<T | null> => {
    // Check access first
    const hasAccess = await checkAccess(feature)
    if (!hasAccess) {
      return null
    }

    // Perform the action
    try {
      const result = await action()

      // Deduct tokens after success
      await deductTokens(feature)

      return result
    } catch (error: any) {
      console.error('Action error:', error)
      return null
    }
  }, [checkAccess, deductTokens])

  return {
    checkAccess,
    deductTokens,
    withTokens,
    tokensRemaining,
    isChecking
  }
}

// Export type for convenience
export type { UseTokensReturn as UseTokens }