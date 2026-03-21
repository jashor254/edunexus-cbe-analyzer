/**
 * EDUNEXUS GLOBAL CONSTANTS (2026)
 * "Asteaste" - Reliable, Scalable, Tested.
 */

// 1. CBC SUBJECTS (Standardized Names)
export const CBC_SUBJECTS = {
  MATH: "Mathematics",
  ENGLISH: "English Language",
  KISWAHILI: "Kiswahili Language",
  SCIENCE: "Integrated Science",
  SOCIAL: "Social Studies",
  CREATIVE: "Creative Arts",
  PRE_TECH: "Pre-Technical Studies",
  AGRICULTURE: "Agriculture & Nutrition",
  HEALTH: "Health Education",
} as const;

export type SubjectKey = keyof typeof CBC_SUBJECTS;

// 2. SUBSCRIPTION TIERS & TOKENS
export const SUBSCRIPTION_PLANS = {
  FREE: {
    id: "free",
    name: "Standard",
    tokens: 3, // Initial gift tokens
    features: ["Single Career Match", "Basic Stats"],
    price: 0
  },
  PREMIUM: {
    id: "premium",
    name: "Elite Parent",
    tokens: 50,
    features: ["Unlimited Matches", "AI Hidden Gems", "Psychometric Sync", "M-Pesa Support"],
    price: 999 // KES
  }
} as const;

// 3. CAREER PATHWAYS (CBC Senior School)
export const CAREER_PATHWAYS = [
  "STEM",
  "Arts & Sports",
  "Social Sciences",
  "Technical & Vocational"
] as const;

// 4. AI MARKET REALITY LABELS
export const MARKET_LABELS = {
  POTENTIAL: {
    EXCEPTIONAL: "exceptional",
    LUCRATIVE: "lucrative",
    STABLE: "stable"
  },
  RISK: {
    VERY_LOW: "very_low",
    LOW: "low",
    MODERATE: "moderate",
    HIGH: "high"
  }
} as const;

// 5. API ROUTES (Centralized for easy refactoring)
export const API_ROUTES = {
  CAREER_SEARCH: "/api/careers/search",
  CAREER_MATCH: "/api/careers/match",
  TOKEN_DEDUCT: "/api/tokens/deduct",
  MPESA_STK: "/api/payments/mpesa/stk"
} as const;

// 6. SHARED INTERFACES (The Core Data Model)
// Hii inasaidia kuzuia "Property does not exist" errors
export interface CareerData {
  id: string;
  name: string;
  pathway: string;
  matchRequirements: {
    primarySubjects: string[];
    minimumLevels: Record<string, number>;
  };
  marketReality: {
    earningPotential: string;
    jobSecurity: string;
    demandLevel: string;
    kenyanContext: string;
  };
  aiImpact: {
    disruptionRisk: string;
    disruptionPercentage: number;
    growthOutlook: string;
    growthPercentage: number;
    survivalStrategy: string[];
  };
  cbeReadiness: {
    coreCompetencies: string[];
    recommendedSeniorPath: string;
    universities: string[];
    tvetOptions: string[];
  };
  realityCheck: {
    pros: string[];
    challenges: string[];
    typicalDay: string;
  };
}