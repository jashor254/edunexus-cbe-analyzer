
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
  updated_at: string
}

// ✅ FIX: Added pathway_recommendations type
export type PathwayRecommendation = {
  stem_score: number
  arts_sports_score: number
  social_sciences_score: number
  top_pathway: string
  confidence: 'high' | 'medium' | 'low'
  strengths: string[]
  development_areas: string[]
  guidance_message: string
}

// ✅ FIX: Updated Assessment type to include pathway_recommendations
export type Assessment = {
  id: string
  student_id: string
  term: 1 | 2 | 3
  year: number
  grade_level: 'junior' | 'senior'
  subject_scores: Record<string, number>
  mathematics_type: 'core' | 'essential' | null
  pathway_electives: string[] | null
  pathway_recommendations: PathwayRecommendation | null  // ✅ ADDED THIS
  created_at: string
  updated_at: string
}

// ==================== JUNIOR SCHOOL (Grade 7-9) ====================

export const JUNIOR_SUBJECTS = [
  { key: 'mathematics', label: 'Mathematics', category: 'core' },
  { key: 'english', label: 'English', category: 'core' },
  { key: 'kiswahili', label: 'Kiswahili', category: 'core' },
  { key: 'social_studies', label: 'Social Studies', category: 'core' },
  { key: 'integrated_science', label: 'Integrated Science', category: 'core' },
  { key: 'pre_technical_studies', label: 'Pre-Technical Studies', category: 'core' },
  { key: 'creative_arts_sports', label: 'Creative Arts and Sports', category: 'core' },
  { key: 'agriculture_nutrition', label: 'Agriculture and Nutrition', category: 'core' },
  { key: 'christian_religious_education', label: 'Christian Religious Education', category: 'optional' },
  { key: 'islamic_religious_education', label: 'Islamic Religious Education', category: 'optional' },
] as const

// ==================== SENIOR SCHOOL (Grade 10-12) ====================

// CATEGORY 1: CORE/COMPULSORY (3 subjects - ALL students)
export const SENIOR_CORE_SUBJECTS = [
  { key: 'english', label: 'English', category: 'compulsory' },
  { key: 'kiswahili_ksl', label: 'Kiswahili/Kenya Sign Language (KSL)', category: 'compulsory' },
  { key: 'community_service_learning', label: 'Community Service Learning (CSL)', category: 'compulsory' },
] as const

// Mathematics (compulsory but different types)
export const MATHEMATICS_OPTIONS = [
  { key: 'core_mathematics', label: 'Core Mathematics', pathway: 'STEM', category: 'compulsory' },
  { key: 'essential_mathematics', label: 'Essential Mathematics', pathway: 'Arts & Sports, Social Sciences', category: 'compulsory' },
] as const

// CATEGORY 2: LIFE SKILLS (2 subjects - ALL students)
export const SENIOR_LIFE_SKILLS = [
  { key: 'physical_education', label: 'Physical Education (PE)', category: 'life_skills' },
  { key: 'ict', label: 'Information, Communication & Technology (ICT)', category: 'life_skills' },
] as const

// CATEGORY 3: PATHWAY ELECTIVES (3 subjects + 1 Religious Education = 4 total)
// BUT only 3 are chosen, with Religious Education being one of the options

// STEM Pathway Electives (INCLUDING Religious Education)
export const STEM_ELECTIVES = [
  { key: 'biology', label: 'Biology' },
  { key: 'chemistry', label: 'Chemistry' },
  { key: 'physics', label: 'Physics' },
  { key: 'general_science', label: 'General Science' },
  { key: 'computer_studies', label: 'Computer Studies' },
  { key: 'agriculture', label: 'Agriculture' },
  { key: 'home_science', label: 'Home Science' },
  { key: 'aviation', label: 'Aviation' },
  { key: 'building_construction', label: 'Building and Construction' },
  { key: 'electricity', label: 'Electricity' },
  { key: 'metalwork', label: 'Metalwork' },
  { key: 'power_mechanics', label: 'Power Mechanics' },
  { key: 'woodwork', label: 'Woodwork' },
  { key: 'media_technology', label: 'Media Technology' },
  { key: 'marine_fisheries', label: 'Marine and Fisheries Technology' },
  { key: 'geography', label: 'Geography' },
  { key: 'business_studies', label: 'Business Studies' },
  { key: 'christian_education', label: 'Christian Religious Education (CRE)' },
  { key: 'islamic_education', label: 'Islamic Religious Education (IRE)' },
  { key: 'hindu_education', label: 'Hindu Religious Education (HRE)' },
] as const

// Arts & Sports Pathway Electives (INCLUDING Religious Education)
export const ARTS_SPORTS_ELECTIVES = [
  { key: 'sports_recreation', label: 'Sports and Recreation' },
  { key: 'music_dance', label: 'Music and Dance' },
  { key: 'theatre_film', label: 'Theatre and Film' },
  { key: 'fine_arts', label: 'Fine Arts' },
  { key: 'biology', label: 'Biology' },
  { key: 'general_science', label: 'General Science' },
  { key: 'media_technology', label: 'Media Technology' },
  { key: 'literature_english', label: 'Literature in English' },
  { key: 'fasihi_kiswahili', label: 'Fasihi ya Kiswahili' },
  { key: 'history_citizenship', label: 'History and Citizenship' },
  { key: 'geography', label: 'Geography' },
  { key: 'business_studies', label: 'Business Studies' },
  { key: 'computer_studies', label: 'Computer Studies' },
  { key: 'french', label: 'French' },
  { key: 'german', label: 'German' },
  { key: 'arabic', label: 'Arabic' },
  { key: 'mandarin', label: 'Mandarin Chinese' },
  { key: 'christian_education', label: 'Christian Religious Education (CRE)' },
  { key: 'islamic_education', label: 'Islamic Religious Education (IRE)' },
  { key: 'hindu_education', label: 'Hindu Religious Education (HRE)' },
] as const

// Social Sciences Pathway Electives (INCLUDING Religious Education)
export const SOCIAL_SCIENCES_ELECTIVES = [
  { key: 'literature_english', label: 'Literature in English' },
  { key: 'indigenous_languages', label: 'Indigenous Languages' },
  { key: 'fasihi_kiswahili', label: 'Fasihi ya Kiswahili' },
  { key: 'sign_language', label: 'Sign Language' },
  { key: 'arabic', label: 'Arabic' },
  { key: 'french', label: 'French' },
  { key: 'german', label: 'German' },
  { key: 'mandarin', label: 'Mandarin Chinese' },
  { key: 'christian_education', label: 'Christian Religious Education (CRE)' },
  { key: 'islamic_education', label: 'Islamic Religious Education (IRE)' },
  { key: 'hindu_education', label: 'Hindu Religious Education (HRE)' },
  { key: 'business_studies', label: 'Business Studies' },
  { key: 'history_citizenship', label: 'History and Citizenship' },
  { key: 'geography', label: 'Geography' },
  { key: 'general_science', label: 'General Science' },
  { key: 'computer_studies', label: 'Computer Studies' },
] as const

// Helper to get electives based on pathway
export function getPathwayElectives(pathway: string) {
  switch (pathway) {
    case 'STEM':
      return STEM_ELECTIVES
    case 'Arts & Sports':
      return ARTS_SPORTS_ELECTIVES
    case 'Social Sciences':
      return SOCIAL_SCIENCES_ELECTIVES
    default:
      return []
  }
}

// CBC Competency Levels
export const COMPETENCY_LEVELS = [
  { value: 1, label: 'Below Expectations', short: 'Below', color: 'red', bgColor: 'bg-red-50', borderColor: 'border-red-500', textColor: 'text-red-700' },
  { value: 2, label: 'Approaching Expectations', short: 'Approaching', color: 'yellow', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-500', textColor: 'text-yellow-700' },
  { value: 3, label: 'Meeting Expectations', short: 'Meeting', color: 'green', bgColor: 'bg-green-50', borderColor: 'border-green-500', textColor: 'text-green-700' },
  { value: 4, label: 'Exceeding Expectations', short: 'Exceeding', color: 'blue', bgColor: 'bg-blue-50', borderColor: 'border-blue-500', textColor: 'text-blue-700' },
] as const