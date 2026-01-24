// lib/payments/config.ts

export const PAYMENT_PLANS = {
  free: {
    name: 'Free Plan',
    price: 0,
    currency: 'KES',
    tokens: 3,
    features: [
      '3 AI generations',
      'Basic scheme of work',
      'Limited reports',
      'Community support',
    ],
    duration: 'Forever',
  },
  termly: {
    name: 'Termly Plan',
    price: 300,
    currency: 'KES',
    tokens: 50,
    features: [
      '50 AI generations per term',
      'Full scheme of work generator',
      'Unlimited reports & lesson plans',
      'Progress tracking',
      'Priority support',
      'Export to PDF/Word',
    ],
    duration: '4 months (1 term)',
  },
  lifetime: {
    name: 'Lifetime Plan',
    price: 1500,
    currency: 'KES',
    tokens: 999999,
    features: [
      'Unlimited AI generations',
      'All features unlocked',
      'Lifetime access',
      'Priority support',
      'Early access to new features',
      'No recurring payments',
    ],
    duration: 'Lifetime',
  },
} as const;

export type PlanType = keyof typeof PAYMENT_PLANS;
export type PaymentMethod = 'mpesa_stk' | 'mpesa_paybill' | 'card';
export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'cancelled';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: PlanType;
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

export function getPlanDetails(planType: PlanType) {
  return PAYMENT_PLANS[planType];
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