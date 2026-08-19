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

// 6. LEARNER IDENTITY / TRANSFER CONTINUITY (Phase 2D)
// TTL for a transfer-continuity token (lib/core/transferTokens.ts). Chosen
// to match the closest existing canonical pattern in this codebase —
// core_guardian_invites.expires_at's 7-day window (supabase/migrations/
// 20260722_core_guardian_invites.sql) — widened to 14 days because an
// inter-school transfer is a slower, paperwork-bound process on the
// receiving school's side than a parent tapping one WhatsApp link.
export const TRANSFER_TOKEN_TTL_DAYS = 14;

// 6b. LEARNER ACCOUNT ACTIVATION (Phase 2B-RESUME)
// TTL for a `learner_account_invites` activation token
// (lib/core/learnerAccounts.ts). Matches core_guardian_invites.expires_at's
// 7-day window (supabase/migrations/20260722_core_guardian_invites.sql) —
// the closest existing analog: a school hands a learner/guardian a
// one-time code to redeem, same shape and same urgency as a guardian
// invite, unlike the slower 14-day inter-school transfer handshake above.
export const LEARNER_ACCOUNT_INVITE_TTL_DAYS = 7;

// The synthetic email domain used to bootstrap a real Supabase `auth.users`
// identity for a learner who has no personal email/phone on file (Phase
// 2B-RESUME Step 7/8 — verified against local Supabase: admin.createUser()
// with no password + admin.generateLink({type:'magiclink'}) +
// anon-client verifyOtp({token_hash}) establishes a real session with zero
// email ever sent). `.invalid` is the IANA-reserved TLD for addresses that
// are guaranteed never to resolve (RFC 2606) — deliberate, so this can
// never collide with, or be mistaken for, a real deliverable address. The
// local-part is always `learner-<learner_identity_id>`, so the email is
// fully deterministic from the durable identity and carries no PII.
export const LEARNER_SYNTHETIC_AUTH_EMAIL_DOMAIN = "learner.internal.edunexus.invalid";

// 7. SHARED INTERFACES (The Core Data Model)
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