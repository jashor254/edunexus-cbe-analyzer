// lib/payments/config.ts

// ===== TOKEN COSTS (per action) =====
export const TOKEN_COSTS = {
  add_assessment_basic:    1,
  add_assessment_detailed: 2,
  generate_pdf:            3,
  ai_career_analysis:      5,
  ai_chat_session:         2,
  download_clinic:         3,
} as const

export type TokenFeature = keyof typeof TOKEN_COSTS

// ===== PLAN TYPES =====
export type PlanType = 'termly' | 'annual' | 'none';
export type TokenBundleType = 'starter' | 'popular' | 'pro';
export type PaymentMethod = 'mpesa_stk' | 'mpesa_b2c' | 'card' | 'bank';

// ===== PAYMENT PLANS =====
export const PAYMENT_PLANS = {
  termly: {
    id: 'termly',
    name: 'Termly Subscription',
    price: 1500,
    currency: 'KES',
    period: 'term',
    features: [
      'Unlimited Academic Clinic reports',
      'Unlimited AI tutoring sessions',
      'All subjects (Junior & Senior)',
      'Parent insights dashboard',
      'Progress tracking over time',
      'Downloadable PDF reports',
      'Priority email support'
    ],
    limits: {
      reportsPerMonth: 'unlimited',
      studentsPerAccount: 3,
      aiSessionsPerDay: 'unlimited'
    }
  },
  annual: {
    id: 'annual',
    name: 'Annual Subscription',
    price: 4000,
    currency: 'KES',
    period: 'year',
    features: [
      'Everything in Termly, PLUS:',
      '2 months FREE (save KES 500)',
      'Advanced career predictions',
      'Comparison with CBC benchmarks',
      'WhatsApp support group access',
      'Early access to new features'
    ],
    limits: {
      reportsPerMonth: 'unlimited',
      studentsPerAccount: 5,
      aiSessionsPerDay: 'unlimited'
    }
  }
} as const;

// ===== TOKEN BUNDLES =====
export const TOKEN_BUNDLES = {
  starter: {
    id: 'starter',
    name: 'Starter Pack',
    tokens: 3,
    price: 300,
    currency: 'KES',
    pricePerToken: 100,
    popular: false,
    features: [
      '3 full Academic Clinic reports',
      'Valid forever (no expiry)',
      'All subjects included',
      'Downloadable PDFs',
      'Perfect for trying it out'
    ]
  },
  popular: {
    id: 'popular',
    name: 'Popular Pack',
    tokens: 10,
    price: 850,
    currency: 'KES',
    pricePerToken: 85,
    popular: true,
    features: [
      '10 full Academic Clinic reports',
      'Save 15% vs Starter Pack',
      'Valid forever (no expiry)',
      'All subjects included',
      'Most popular choice'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro Pack',
    tokens: 25,
    price: 1875,
    currency: 'KES',
    pricePerToken: 75,
    popular: false,
    features: [
      '25 full Academic Clinic reports',
      'Save 25% vs Starter Pack',
      'Valid forever (no expiry)',
      'All subjects included',
      'Best value for schools'
    ]
  }
} as const;

// ===== COMBINED PRODUCTS =====
export const ALL_PRODUCTS = {
  // Subscriptions
  ...PAYMENT_PLANS,
  // Token Bundles
  ...TOKEN_BUNDLES
} as const;

// ===== TYPES =====
export type ProductId = keyof typeof ALL_PRODUCTS;
export type Product = typeof ALL_PRODUCTS[ProductId];

// ===== HELPER FUNCTIONS =====

export function getPlanDetails(planType: PlanType) {
  if (planType === 'none') {
    return {
      name: 'Free Tier',
      price: 0,
      features: ['1 free analysis', 'Basic subject tracking'],
      limits: { reportsPerMonth: 1, studentsPerAccount: 1 }
    };
  }
  return PAYMENT_PLANS[planType];
}

export function getTokenBundleDetails(bundleType: TokenBundleType) {
  return TOKEN_BUNDLES[bundleType];
}

export function formatCurrency(amount: number, currency: string = 'KES'): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatPhoneNumber(phone: string): string {
  // Convert 0712345678 to 254712345678
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    return '254' + cleaned.slice(1);
  }
  if (cleaned.startsWith('7')) {
    return '254' + cleaned;
  }
  return cleaned;
}

export function calculateTokensNeeded(reportCount: number): TokenBundleType | null {
  if (reportCount <= 3) return 'starter';
  if (reportCount <= 10) return 'popular';
  if (reportCount <= 25) return 'pro';
  return null; // Recommend subscription instead
}

export function isSubscriptionActive(subscription: any): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;
  
  const now = new Date();
  const endDate = new Date(subscription.end_date);
  return endDate > now;
}

export function getPaymentRecommendation(
  hasSubscription: boolean,
  tokenBalance: number,
  neededReports: number
): {
  recommendation: 'subscribe' | 'buy_tokens' | 'use_tokens' | 'free_trial';
  message: string;
} {
  if (!hasSubscription && tokenBalance < neededReports) {
    const tokensNeeded = neededReports - tokenBalance;
    if (tokensNeeded <= 3) {
      return {
        recommendation: 'buy_tokens',
        message: `Buy a Starter Pack (${tokensNeeded} tokens) to continue`
      };
    } else if (tokensNeeded <= 10) {
      return {
        recommendation: 'buy_tokens',
        message: 'Buy the Popular Pack for best value'
      };
    } else {
      return {
        recommendation: 'subscribe',
        message: 'Subscribe termly for unlimited reports (cheaper than tokens)'
      };
    }
  }
  
  if (hasSubscription) {
    return {
      recommendation: 'use_tokens',
      message: 'You have unlimited access!'
    };
  }
  
  if (tokenBalance >= neededReports) {
    return {
      recommendation: 'use_tokens',
      message: `You have ${tokenBalance} tokens remaining`
    };
  }
  
  return {
    recommendation: 'free_trial',
    message: 'Use your free analysis first!'
  };
}