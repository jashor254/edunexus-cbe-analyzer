// lib/academicClinic/dynamicCareerGenerator.ts

import { DEEPSEEK_CONFIG } from '@/lib/config/api';
import { findCareerByName, CareerData } from './careerDatabase';

export interface DynamicCareer {
  name: string
  description: string
  match_percentage?: number
  salary_range: string
  education_path: string
  education_duration: string
  why_matched?: string
  required_subjects: string[]
  required_subjects_display?: string[]
  current_gaps?: any[]
  outlook: 'excellent' | 'good' | 'moderate' | 'emerging' | 'stable'
  demand_in_kenya: 'very_high' | 'high' | 'moderate' | 'low'
  ai_disruption_risk: 'very_low' | 'low' | 'moderate' | 'high'
  universities_in_kenya?: string[]
  tvet_options?: string[]
  career_path?: string[]
  is_ai_generated?: boolean
}

/**
 * Convert CareerData (static DB format) to DynamicCareer format
 * so both code paths return a consistent shape.
 */
export function convertCareerDataToDynamic(career: CareerData): DynamicCareer {
  const outlookMap: Record<string, DynamicCareer['outlook']> = {
    booming: 'excellent',
    growing: 'good',
    stable: 'stable',
    declining: 'moderate',
  };

  return {
    name: career.name,
    description: career.realityCheck.typicalDay,
    salary_range: `See Kenyan market rates for ${career.name}`,
    education_path: career.cbeReadiness.recommendedSeniorPath,
    education_duration: '3-4 years',
    outlook: outlookMap[career.aiImpact.growthOutlook] ?? 'good',
    demand_in_kenya: career.marketReality.demandLevel as DynamicCareer['demand_in_kenya'],
    ai_disruption_risk: career.aiImpact.disruptionRisk as DynamicCareer['ai_disruption_risk'],
    required_subjects: career.matchRequirements.primarySubjects,
    required_subjects_display: career.matchRequirements.primarySubjects.map(
      s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    ),
    universities_in_kenya: career.cbeReadiness.universities,
    tvet_options: career.cbeReadiness.tvetOptions,
    career_path: career.aiImpact.survivalStrategy,
    is_ai_generated: false,
  };
}

/**
 * Generate career dynamically using DeepSeek AI.
 * First checks static database; falls back to AI if not found.
 */
export async function generateDynamicCareer(careerName: string): Promise<DynamicCareer> {
  console.log(`🔍 Researching career: ${careerName}`);

  // 1. Check static database first (zero cost)
  const staticCareer = findCareerByName(careerName);
  if (staticCareer) {
    return convertCareerDataToDynamic(staticCareer);
  }

  // 2. Call DeepSeek AI
  const prompt = `Research career: "${careerName}" for Kenyan CBC student.
Return JSON only:
{
  "name": "exact career name",
  "description": "day-to-day reality in Kenya",
  "salary_range": "KES X - Y/month",
  "education_path": "degree/diploma needed",
  "education_duration": "X years",
  "outlook": "excellent|good|moderate|emerging|stable",
  "demand_in_kenya": "very_high|high|moderate|low",
  "ai_disruption_risk": "very_low|low|moderate|high",
  "required_subjects": ["cbc_subject_key"],
  "required_subjects_display": ["Subject Name"],
  "universities_in_kenya": ["Real Kenyan University"],
  "tvet_options": ["TVET option or empty array"],
  "career_path": ["Step 1", "Step 2", "Step 3", "Step 4"]
}
Rules: Use real Kenyan companies and universities. Be honest about Kenyan job market realities. Consider CBC curriculum structure.`;

  try {
    const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_CONFIG.getKeyOrThrow()}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: 'You are a Kenyan career intelligence expert. Return ONLY valid JSON with no extra text.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in DeepSeek response');

    const aiData = JSON.parse(jsonMatch[0]);

    return {
      name: aiData.name || careerName,
      description: aiData.description || `A career in ${careerName} in Kenya.`,
      salary_range: aiData.salary_range || 'KES 50,000 - 250,000/month',
      education_path: aiData.education_path || "Bachelor's degree in relevant field",
      education_duration: aiData.education_duration || '3-4 years',
      outlook: aiData.outlook || 'good',
      demand_in_kenya: aiData.demand_in_kenya || 'moderate',
      ai_disruption_risk: aiData.ai_disruption_risk || 'moderate',
      required_subjects: Array.isArray(aiData.required_subjects) ? aiData.required_subjects : ['mathematics', 'english'],
      required_subjects_display: Array.isArray(aiData.required_subjects_display) ? aiData.required_subjects_display : ['Mathematics', 'English'],
      universities_in_kenya: Array.isArray(aiData.universities_in_kenya) ? aiData.universities_in_kenya : ['University of Nairobi', 'Kenyatta University'],
      tvet_options: Array.isArray(aiData.tvet_options) ? aiData.tvet_options : [],
      career_path: Array.isArray(aiData.career_path) ? aiData.career_path : ['Entry Level', 'Mid Level', 'Senior Level', 'Expert'],
      is_ai_generated: true,
    };
  } catch (err) {
    console.error('DeepSeek career generation failed:', err);
    // Fallback: return generic structure
    return {
      name: careerName,
      description: `A career path in ${careerName} offering opportunities for growth and development in Kenya.`,
      salary_range: 'KES 50,000 - 250,000/month (varies by experience)',
      education_path: "Bachelor's degree or diploma in relevant field",
      education_duration: '3-4 years',
      outlook: 'good',
      demand_in_kenya: 'moderate',
      ai_disruption_risk: 'moderate',
      required_subjects: ['mathematics', 'english', 'kiswahili'],
      required_subjects_display: ['Mathematics', 'English', 'Kiswahili'],
      universities_in_kenya: ['University of Nairobi', 'Kenyatta University', 'Moi University'],
      tvet_options: [],
      career_path: ['Entry Level', 'Mid Level', 'Senior Level', 'Expert / Consultant'],
      is_ai_generated: true,
    };
  }
}

/**
 * Enhance existing career with AI-generated insights via DeepSeek.
 */
export async function enhanceCareerWithAI(baseCareer: DynamicCareer): Promise<DynamicCareer> {
  const prompt = `Add insights about "${baseCareer.name}" career in Kenya.
Return JSON only:
{
  "market_insight": "Current market trend in Kenya 2024-2025",
  "top_employers": ["Real Kenyan company 1", "Real Kenyan company 2", "Real Kenyan company 3"],
  "salary_trend": "rising|stable|declining",
  "key_skill_2025": "The single most important skill to develop"
}`;

  try {
    const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_CONFIG.getKeyOrThrow()}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.model,
        messages: [
          { role: 'system', content: 'You are a Kenyan career intelligence expert. Return ONLY valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 500,
      }),
    });

    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);

    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const insights = JSON.parse(jsonMatch[0]);

    return {
      ...baseCareer,
      description: insights.market_insight
        ? `${baseCareer.description} ${insights.market_insight}`
        : baseCareer.description,
    };
  } catch (err) {
    console.error('Career enhancement failed:', err);
    return baseCareer;
  }
}
