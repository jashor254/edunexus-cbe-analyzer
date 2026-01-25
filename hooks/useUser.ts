// hooks/useUser.ts
'use client';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name?: string;
  referralCode: string;
  hasFreeAnalysis: boolean;
  freeAnalysisExpiresAt?: string;
}

interface UseUserReturn {
  user: User | null;
  isLoading: boolean;
  createUser: (email: string, name?: string, referralCode?: string) => Promise<boolean>;
  useFreeAnalysis: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async (email: string) => {
    // TODO: Implement based on your auth system
    // For now, return null
    setIsLoading(false);
  };

  const createUser = async (
    email: string,
    name?: string,
    referralCode?: string
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, referralCode }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setUser({
        id: data.user.id,
        email: data.user.email,
        name: name,
        referralCode: data.user.referralCode,
        hasFreeAnalysis: data.user.freeAnalyses > 0,
      });

      return true;
    } catch (error) {
      console.error('Create user error:', error);
      return false;
    }
  };

  const useFreeAnalysis = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const response = await fetch('/api/users/use-free-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (!data.success) {
        return false;
      }

      // Update user state
      setUser(prev => prev ? { ...prev, hasFreeAnalysis: false } : null);
      return true;
    } catch (error) {
      console.error('Use free analysis error:', error);
      return false;
    }
  };

  return {
    user,
    isLoading,
    createUser,
    useFreeAnalysis,
    refreshUser: () => fetchUser(user?.email || ''),
  };
}