// lib/academicClinic/dynamicCareerGenerator.ts

import { DEEPSEEK_CONFIG } from '@/lib/config/api';
import type { CareerData } from './careerDatabase';

/**
 * Generate career data dynamically
 */
export async function generateDynamicCareer(
  careerName: string,
  pathway?: string
): Promise<CareerData> {
  
  const prompt = `You are an expert Kenyan career counselor and CBC education specialist.

TASK: Research and provide comprehensive information about the career: "${careerName}"

Return ONLY valid JSON (no markdown):

{
  "id": "career_name_in_snake_case",
  "name": "${careerName}",
  "pathway": "STEM" OR "Arts & Sports" OR "Social Sciences",
  "matchRequirements": {
    "primarySubjects": ["subject1", "subject2"],
    "minimumLevels": { "subject1": 3, "subject2": 3 }
  },
  "marketReality": {
    "earningPotential": "exceptional" OR "very_lucrative" OR "lucrative" OR "moderate" OR "lower_but_stable",
    "jobSecurity": "very_high" OR "high" OR "moderate" OR "low",
    "demandLevel": "very_high" OR "high" OR "moderate" OR "low",
    "kenyanContext": "2-3 sentences about Kenya's job market for this career"
  },
  "cbeReadiness": {
    "coreCompetencies": ["Competency1", "Competency2"],
    "recommendedSeniorPath": "CBC pathway",
    "universities": ["University1", "University2", "University3"],
    "tvetOptions": ["TVET1", "TVET2"]
  },
  "aiImpact": {
    "disruptionRisk": "very_low" OR "low" OR "moderate" OR "high" OR "very_high",
    "disruptionPercentage": 0-100,
    "growthOutlook": "declining" OR "stable" OR "growing" OR "booming",
    "growthPercentage": 0-300,
    "timeline": {
      "shortTerm": "2026-2028",
      "midTerm": "2028-2035",
      "longTerm": "2035-2045"
    },
    "survivalStrategy": ["Strategy1", "Strategy2", "Strategy3"]
  },
  "realityCheck": {
    "pros": ["Benefit1", "Benefit2", "Benefit3"],
    "challenges": ["Challenge1", "Challenge2", "Challenge3"],
    "typicalDay": "Description of typical workday"
  }
}

CRITICAL: Be honest about Kenyan job market. Use real universities. Return ONLY JSON.`;

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
            content: 'You are a career research expert. Return ONLY valid JSON, no markdown.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from AI response');
    }

    const careerData: CareerData = JSON.parse(jsonMatch[0]);
    
    // Validate
    if (!careerData.name || !careerData.pathway || !careerData.marketReality) {
      throw new Error('Invalid career data structure from AI');
    }

    return careerData;
    
  } catch (error) {
    console.error('Dynamic career generation error:', error);
    throw error;
  }
}

/**
 * Get career with fallback to dynamic generation
 */
export async function getCareerWithFallback(
  careerName: string,
  staticCareer?: CareerData | null
): Promise<{ career: CareerData; source: 'static' | 'dynamic' }> {
  
  if (staticCareer) {
    return { career: staticCareer, source: 'static' };
  }

  const dynamicCareer = await generateDynamicCareer(careerName);
  return { career: dynamicCareer, source: 'dynamic' };
}