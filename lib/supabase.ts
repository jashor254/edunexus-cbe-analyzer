import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==================== TYPES ====================

export type Student = {
  id: string
  user_id: string
  name: string
  grade: number
  date_of_birth: string
  current_pathway: 'STEM' | 'Arts & Sports' | 'Social Sciences' | null
  created_at: string
}

export type SubjectMark = {
  rating: number // 1-4
  marks?: number // 0-100
  total?: number // Default 100
}

export type Assessment = {
  id: string
  student_id: string
  term: number
  year: number
  grade: number // Which grade the assessment was taken in
  grade_level: string
  subject_scores: Record<string, number> // Legacy: just ratings
  subject_marks?: Record<string, SubjectMark> // New: detailed marks
  mathematics_type: 'core' | 'essential' | null
  pathway_electives: string[] | null
  created_at: string
}

export type StrandAssessment = {
  id: string
  assessment_id: string
  student_id: string
  subject: string
  strand: string
  topic: string
  rating: number // 1-4
  marks?: number
  total_marks?: number
  teacher_notes?: string
  learner_notes?: string
  created_at: string
  updated_at: string
}

export type LearningInsight = {
  id: string
  student_id: string
  subject: string
  insight_type: 'strength' | 'weakness' | 'learning_style' | 'observation'
  content: string
  source: 'teacher' | 'learner' | 'parent' | 'ai_detected'
  confidence_score?: number
  created_at: string
  updated_at: string
}

export type UserTokens = {
  id: string
  user_id: string
  tokens_purchased: number
  tokens_used: number
  tokens_remaining: number
  purchase_date: string
  expiry_date?: string
  created_at: string
}

export type TokenUsageLog = {
  id: string
  user_id: string
  action: string
  tokens_consumed: number
  metadata?: Record<string, any>
  created_at: string
}

export type Subscription = {
  id: string
  user_id: string
  plan_type: '1_student' | '2_students' | '3_students' | 'school'
  billing_cycle: 'termly' | 'yearly'
  amount_paid: number
  start_date: string
  end_date: string
  status: 'active' | 'expired' | 'cancelled'
  payment_reference?: string
  created_at: string
  updated_at: string
}

export type FeatureRequest = {
  id: string
  user_id?: string
  feature_title: string
  description?: string
  category: 'marks_tracking' | 'bulk_upload' | 'ai_features' | 'reports' | 'other'
  votes: number
  status: 'pending' | 'reviewing' | 'planned' | 'in_progress' | 'completed' | 'rejected'
  admin_notes?: string
  created_at: string
  updated_at: string
}

export type FeatureVote = {
  id: string
  feature_id: string
  user_id: string
  created_at: string
}

// ==================== PRICING CONSTANTS ====================

export const PRICING = {
  TERMLY: {
    '1_student': 500,
    '2_students': 800,
    '3_students': 1200,
  },
  YEARLY: {
    '1_student': 1500, // 3 terms
    '2_students': 2400,
    '3_students': 3600,
  },
  TOKENS: {
    starter: { tokens: 5, price: 200 },
    basic: { tokens: 15, price: 500 },
    premium: { tokens: 30, price: 800 },
  },
  TOKEN_COSTS: {
    add_assessment_basic: 1,
    add_assessment_detailed: 2,
    generate_pdf: 3,
    ai_career_analysis: 5,
    ai_chat_session: 2, // 10 messages
    download_clinic: 3,
  }
} as const;

// ==================== JUNIOR SCHOOL (Grade 7-9) ====================
// Rationalized to 8 Core + 1 Religious subject [cite: 2026-01-31]
export const JUNIOR_SUBJECTS = [
  { key: 'mathematics', label: 'Mathematics' },
  { key: 'english', label: 'English' },
  { key: 'kiswahili', label: 'Kiswahili' },
  { key: 'integrated_science', label: 'Integrated Science' },
  { key: 'social_studies', label: 'Social Studies' },
  { key: 'creative_arts_sports', label: 'Creative Arts and Sports' },
  { key: 'agriculture_nutrition', label: 'Agriculture and Nutrition' },
  { key: 'pre_technical_studies', label: 'Pre-Technical Studies' },
] as const;

export const JUNIOR_RELIGION = [
  { key: 'cre', label: 'Christian Religious Education' },
  { key: 'ire', label: 'Islamic Religious Education' },
  { key: 'hre', label: 'Hindu Religious Education' },
] as const;

// ==================== SENIOR SCHOOL (Grade 10-12) ====================
// Based on KICD Lesson Distribution

export const SENIOR_CORE_SUBJECTS = [
  { key: 'english', label: 'English' },
  { key: 'kiswahili_ksl', label: 'Kiswahili/KSL' },
  { key: 'community_service_learning', label: 'Community Service Learning (CSL)' },
] as const;

export function getPathwayElectives(pathway: string) {
  const mapping: Record<string, { key: string; label: string }[]> = {
    'STEM': [
      { key: 'biology', label: 'Biology' },
      { key: 'chemistry', label: 'Chemistry' },
      { key: 'physics', label: 'Physics' },
      { key: 'general_science', label: 'General Science' },
      { key: 'agriculture', label: 'Agriculture' },
      { key: 'computer_studies', label: 'Computer Studies' },
      { key: 'home_science', label: 'Home Science' },
      { key: 'aviation', label: 'Aviation' },
    ],
    'Social Sciences': [
      { key: 'literature_english', label: 'Literature in English' },
      { key: 'history_citizenship', label: 'History and Citizenship' },
      { key: 'geography', label: 'Geography' },
      { key: 'business_studies', label: 'Business Studies' },
      { key: 'cre', label: 'Christian Religious Ed' },
      { key: 'ire', label: 'Islamic Religious Ed' },
    ],
    'Arts & Sports': [
      { key: 'sports_recreation', label: 'Sports and Recreation' },
      { key: 'music_dance', label: 'Music and Dance' },
      { key: 'theatre_film', label: 'Theatre and Film' },
      { key: 'fine_arts', label: 'Fine Arts' },
    ]
  };
  return mapping[pathway] || [];
}

export const COMPETENCY_LEVELS = [
  { value: 1, label: 'Below Expectations', short: 'BE', bgColor: 'bg-red-50', borderColor: 'border-red-500', textColor: 'text-red-700' },
  { value: 2, label: 'Approaching Expectations', short: 'AE', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-500', textColor: 'text-yellow-700' },
  { value: 3, label: 'Meeting Expectations', short: 'ME', bgColor: 'bg-green-50', borderColor: 'border-green-500', textColor: 'text-green-700' },
  { value: 4, label: 'Exceeding Expectations', short: 'EE', bgColor: 'bg-blue-50', borderColor: 'border-blue-500', textColor: 'text-blue-700' },
] as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('end_date', new Date().toISOString())
    .single();

  return !error && !!data;
}

/**
 * Get user's available tokens
 */
export async function getAvailableTokens(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('user_tokens')
    .select('tokens_remaining')
    .eq('user_id', userId)
    .or(`expiry_date.is.null,expiry_date.gte.${new Date().toISOString()}`);

  if (error || !data) return 0;

  return data.reduce((sum, row) => sum + row.tokens_remaining, 0);
}

/**
 * Deduct tokens from user account
 */
export async function deductTokens(
  userId: string,
  action: keyof typeof PRICING.TOKEN_COSTS,
  metadata?: Record<string, any>
): Promise<{ success: boolean; message: string }> {
  const tokenCost = PRICING.TOKEN_COSTS[action];

  const { data, error } = await supabase.rpc('deduct_tokens', {
    p_user_id: userId,
    p_action: action,
    p_tokens: tokenCost,
    p_metadata: metadata || {}
  });

  if (error) {
    return { success: false, message: error.message };
  }

  if (!data) {
    return { success: false, message: 'Insufficient tokens' };
  }

  return { success: true, message: 'Tokens deducted successfully' };
}

/**
 * Check if user can perform action (has subscription OR tokens)
 */
export async function canPerformAction(
  userId: string,
  action: keyof typeof PRICING.TOKEN_COSTS
): Promise<{ allowed: boolean; method: 'subscription' | 'tokens' | null; message: string }> {
  // Check subscription first
  const hasSub = await hasActiveSubscription(userId);
  if (hasSub) {
    return { allowed: true, method: 'subscription', message: 'Access via subscription' };
  }

  // Check tokens
  const availableTokens = await getAvailableTokens(userId);
  const requiredTokens = PRICING.TOKEN_COSTS[action];

  if (availableTokens >= requiredTokens) {
    return { allowed: true, method: 'tokens', message: `Will use ${requiredTokens} tokens` };
  }

  return { 
    allowed: false, 
    method: null, 
    message: `Need ${requiredTokens} tokens or active subscription` 
  };
}