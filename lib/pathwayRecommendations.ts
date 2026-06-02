// lib/pathwayRecommendations.ts

import { calculateJuniorPathwayAffinity, formatSubjectName } from '@/lib/pathwayCalculator'

// ============================================
// TYPES (EXPORTED)
// ============================================

export interface SubjectScores {
  [key: string]: number
}

export type PathwayTier = 'excellence' | 'good' | 'moderate' | 'developing'

export type PathwayType = 'STEM' | 'Social Sciences' | 'Arts & Sports Science'

export interface ImprovementNeeded {
  subject: string
  current_score: number
  target_score: number
}

export interface PathwayRecommendation {
  recommended_pathway: PathwayType
  tier: PathwayTier
  average_score: number
  confidence_message: string
  encouraging_message: string
  alternative_pathway?: {
    pathway: PathwayType
    improvement_needed: ImprovementNeeded[]
    message: string
  }
  calculated_at: string
}

// ============================================
// MAIN EXPORTED FUNCTION
// ============================================

export function getPathwayRecommendation(scores: SubjectScores): PathwayRecommendation {
  const result     = calculateJuniorPathwayAffinity(scores)
  const allValues  = Object.values(scores)
  const averageScore = parseFloat(
    (allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(2)
  )

  const tier: PathwayTier =
    result.performance_tier === 'high'
      ? result.stem_score >= 90 ? 'excellence' : 'good'
      : result.performance_tier === 'mid'
        ? 'moderate'
        : 'developing'

  const confidence_message =
    result.confidence === 'high'
      ? '✅ High confidence recommendation'
      : '📊 Medium confidence recommendation'

  const alternative_pathway: PathwayRecommendation['alternative_pathway'] =
    result.stem_viable && result.stem_gap_subjects && result.stem_gap_subjects.length > 0
      ? {
          pathway: 'STEM',
          improvement_needed: result.stem_gap_subjects.map(s => ({
            subject:       formatSubjectName(s),
            current_score: scores[s] ?? 0,
            target_score:  3,
          })),
          message: `Improve ${result.stem_gap_subjects.map(formatSubjectName).join(' and ')} to Level 3 to qualify for STEM.`,
        }
      : undefined

  return {
    recommended_pathway: result.top_pathway as PathwayType,
    tier,
    average_score:       averageScore,
    confidence_message,
    encouraging_message: result.guidance_message,
    alternative_pathway,
    calculated_at:       result.calculated_at,
  }
}

// ============================================
// STYLING FUNCTIONS (EXPORTED)
// ============================================

export function getPathwayBadge(pathway: PathwayType): {
  bg: string
  border: string
  text: string
  icon: string
} {
  switch (pathway) {
    case 'STEM':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-500',
        text: 'text-blue-700',
        icon: '🔬'
      }
    case 'Social Sciences':
      return {
        bg: 'bg-green-50',
        border: 'border-green-500',
        text: 'text-green-700',
        icon: '📚'
      }
    case 'Arts & Sports Science':
      return {
        bg: 'bg-purple-50',
        border: 'border-purple-500',
        text: 'text-purple-700',
        icon: '🎨'
      }
  }
}

export function getTierBadge(tier: PathwayTier): {
  bg: string
  text: string
  label: string
} {
  switch (tier) {
    case 'excellence':
      return {
        bg: 'bg-gradient-to-r from-amber-500 to-yellow-500',
        text: 'text-white',
        label: 'EXCELLENCE ⭐'
      }
    case 'good':
      return {
        bg: 'bg-gradient-to-r from-green-500 to-emerald-500',
        text: 'text-white',
        label: 'GOOD ✅'
      }
    case 'moderate':
      return {
        bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
        text: 'text-white',
        label: 'MODERATE 📈'
      }
    case 'developing':
      return {
        bg: 'bg-gradient-to-r from-purple-500 to-pink-500',
        text: 'text-white',
        label: 'DEVELOPING 🌱'
      }
  }
}