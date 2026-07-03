// lib/access.ts
import { ADMIN_CONFIG } from '@/lib/config/api'

export type UserRole = 'parent' | 'school_admin';
export type PlanType = 'free' | 'token' | 'term';

interface AccessConfig {
  email: string | undefined;
  role: UserRole | undefined;
  planType: PlanType | undefined;
  tokens: number;
}

export function canAccessPremiumFeatures(config: AccessConfig): boolean {
  const { email, role, planType, tokens } = config;

  // 1. Founder/Admin Always has access
  if (role === 'school_admin' || (email && ADMIN_CONFIG.isAdmin(email))) {
    return true;
  }

  // 2. Term/Unlimited Plan has access
  if (planType === 'term') {
    return true;
  }

  // 3. Token users must have at least 1 token
  if (planType === 'token' && tokens > 0) {
    return true;
  }

  return false;
}