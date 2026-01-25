// lib/payments/config.ts

export const PAYMENT_PLANS = {
  termly: {
    name: 'Termly Subscription',
    price: 350,
    currency: 'KES',
    tokens: 50,
    features: [
      '50 AI scheme analyses',
      'Valid for one term (4 months)',
      'Unlimited lesson plans & reports',
      'Progress tracking',
      'Priority support',
      'Export to PDF/Word',
      'Only KES 7 per analysis!',
    ],
    duration: '4 months (1 term)',
    savings: 650, // vs buying tokens individually
  },
} as const;

export const TOKEN_BUNDLES = {
  starter: {
    name: 'Starter Pack',
    tokens: 5,
    price: 100,
    currency: 'KES',
    pricePerToken: 20,
    savings: 0,
    popular: false,
  },
  popular: {
    name: 'Popular Pack',
    tokens: 15,
    price: 250,
    currency: 'KES',
    pricePerToken: 16.67,
    savings: 50,
    popular: true, // Mark as most popular
  },
  value: {
    name: 'Best Value Pack',
    tokens: 30,
    price: 400,
    currency: 'KES',
    pricePerToken: 13.33,
    savings: 200,
    popular: false,
  },
} as const;

export type PlanType = keyof typeof PAYMENT_PLANS;
export type TokenBundleType = keyof typeof TOKEN_BUNDLES;
export type PaymentMethod = 'mpesa_stk' | 'mpesa_paybill' | 'card';
export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'cancelled';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: PlanType | 'token_bundle';
  status: SubscriptionStatus;
  ai_tokens_remaining: number;
  ai_tokens_total: number;
  term_year?: number;
  term_number?: number;
  started_at: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  transaction_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  phone_number?: string;
  status: PaymentStatus;
  plan_type: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  created_at: string;
  last_active_at: string;
  free_analysis_used: boolean;
  free_analysis_expires_at?: string;
  referred_by?: string;
  referral_code: string;
  referral_count: number;
}

export function getPlanDetails(planType: PlanType) {
  return PAYMENT_PLANS[planType];
}

export function getTokenBundleDetails(bundleType: TokenBundleType) {
  return TOKEN_BUNDLES[bundleType];
}

export function formatCurrency(amount: number, currency: string = 'KES'): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.startsWith('0')) cleaned = '254' + cleaned.substring(1);
  if (!cleaned.startsWith('254')) cleaned = '254' + cleaned;
  return cleaned;
}

export function isSubscriptionActive(subscription: Subscription): boolean {
  if (subscription.status !== 'active') return false;
  
  if (subscription.expires_at) {
    return new Date(subscription.expires_at) > new Date();
  }
  
  return true;
}

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}