// hooks/useSubscription.ts
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Subscription, isSubscriptionActive } from '@/lib/payments/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  isLoading: boolean;
  isActive: boolean;
  tokensRemaining: number;
  canUseFeature: boolean;
  refreshSubscription: () => Promise<void>;
  deductToken: (feature: string) => Promise<boolean>;
}

export function useSubscription(userId: string): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .rpc('get_active_subscription', { p_user_id: userId });

      if (error) throw error;

      if (data && data.length > 0) {
        setSubscription(data[0] as Subscription);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchSubscription();
    }
  }, [userId]);

  // ✅ SECURE: Call server API
  const deductToken = async (feature: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/tokens/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, feature }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error('Token deduction failed:', data.error);
        return false;
      }

      await fetchSubscription();
      return true;
    } catch (error) {
      console.error('Error deducting token:', error);
      return false;
    }
  };

  const isActive = subscription ? isSubscriptionActive(subscription) : false;
  const tokensRemaining = subscription?.ai_tokens_remaining || 0;
  const canUseFeature = isActive && tokensRemaining > 0;

  return {
    subscription,
    isLoading,
    isActive,
    tokensRemaining,
    canUseFeature,
    refreshSubscription: fetchSubscription,
    deductToken,
  };
}