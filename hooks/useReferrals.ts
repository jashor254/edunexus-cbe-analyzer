// hooks/useReferrals.ts
'use client';

import { useState, useEffect } from 'react';

interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  tokensEarned: number;
  pendingReferrals: number;
  completedReferrals: number;
  recentReferrals: Array<{
    email: string;
    created_at: string;
    tokens_earned: number;
  }>;
}

interface UseReferralsReturn {
  stats: ReferralStats | null;
  isLoading: boolean;
  error: string | null;
  refreshStats: () => Promise<void>;
  getReferralLink: () => string;
  copyReferralLink: () => Promise<boolean>;
}

export function useReferrals(userId: string): UseReferralsReturn {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/referrals/stats?userId=${userId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch referral stats');
      }

      setStats(data.stats);
    } catch (err: any) {
      console.error('Error fetching referral stats:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchStats();
    }
  }, [userId]);

  const getReferralLink = (): string => {
    if (!stats?.referralCode) return '';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    return `${baseUrl}/signup?ref=${stats.referralCode}`;
  };

  const copyReferralLink = async (): Promise<boolean> => {
    try {
      const link = getReferralLink();
      await navigator.clipboard.writeText(link);
      return true;
    } catch (err) {
      console.error('Copy failed:', err);
      return false;
    }
  };

  return {
    stats,
    isLoading,
    error,
    refreshStats: fetchStats,
    getReferralLink,
    copyReferralLink,
  };
}