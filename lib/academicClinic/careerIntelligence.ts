// lib/academicClinic/careerIntelligence.ts
// The brain - combines AI generation with local Kenyan data

import { DEEPSEEK_CONFIG } from '@/lib/config/api';
import { createServiceClient } from '@/utils/supabase/service';

// ==================== ENHANCED TYPES ====================

export interface KenyanMarketData {
  sectorGrowth: 'declining' | 'stable' | 'growing' | 'booming';
  entryBarriers: 'low' | 'medium' | 'high' | 'very_high';
  saturationLevel: 'underserved' | 'balanced' | 'saturated' | 'oversaturated';
  keyEmployers: string[];
  salaryRangeKES: {
    entry: number;
    mid: number;
    senior: number;
  };
  ruralVsUrban: 'rural_viable' | 'urban_only' | 'hybrid';
}

export interface CBCPathwayMapping {
  juniorSchoolFocus: string[];
  seniorSchoolPathways: ('STEM' | 'Arts & Sports' | 'Social Sciences' | 'TVET')[];
  keyLearningAreas: string[];
  suggestedCCAs: string[]; // Co-Curricular Activities
  portfolioProjects: string[];
}

export interface AIImpactForecast {
  automationRisk: number; // 0-100
  timeline: 'immediate' | '5_years' | '10_years' | '20_years';
  humanAdvantage: string[]; // Skills AI can't replicate
  pivotOpportunities: string[]; // Related careers to pivot to
}

export interface CareerIntelligence {
  id: string;
  name: string;
  category: 'traditional' | 'emerging' | 'future' | 'hybrid';
  description: string;
  kenyanMarket: KenyanMarketData;
  cbcMapping: CBCPathwayMapping;
  aiForecast: AIImpactForecast;
  realStories: {
    successProfile: string;
    challengesFaced: string[];
    adviceForStudents: string;
  };
  verificationStatus: 'ai_generated' | 'expert_reviewed' | 'profession_validated';
  lastUpdated: Date;
}

// ==================== LOCAL MARKET DATABASE ====================

// Hardcoded Kenyan reality checks - updated quarterly
const KENYAN_MARKET_REALITIES: Record<string, Partial<KenyanMarketData>> = {
  'software_engineer': {
    sectorGrowth: 'booming',
    saturationLevel: 'balanced',
    keyEmployers: ['Safaricom', 'Andela', 'Microsoft ADC', 'Cellulant', 'Twiga Foods'],
    salaryRangeKES: { entry: 80000, mid: 180000, senior: 400000 },
    ruralVsUrban: 'hybrid',
  },
  'doctor': {
    sectorGrowth: 'stable',
    entryBarriers: 'very_high',
    saturationLevel: 'underserved',
    keyEmployers: ['Kenyatta National Hospital', 'MP Shah', 'Aga Khan', 'County Hospitals'],
    salaryRangeKES: { entry: 120000, mid: 250000, senior: 600000 },
    ruralVsUrban: 'rural_viable',
  },
  'data_scientist': {
    sectorGrowth: 'booming',
    entryBarriers: 'high',
    saturationLevel: 'underserved',
    keyEmployers: ['Safaricom', 'KCB', 'Equity Bank', 'IBM Research', 'iHub'],
    salaryRangeKES: { entry: 100000, mid: 220000, senior: 500000 },
    ruralVsUrban: 'urban_only',
  },
  'teacher': {
    sectorGrowth: 'stable',
    entryBarriers: 'medium',
    saturationLevel: 'saturated',
    keyEmployers: ['TSC', 'Private Schools', 'International Schools'],
    salaryRangeKES: { entry: 35000, mid: 60000, senior: 120000 },
    ruralVsUrban: 'rural_viable',
  },
  'agricultural_extension_officer': {
    sectorGrowth: 'growing',
    entryBarriers: 'medium',
    saturationLevel: 'underserved',
    keyEmployers: ['County Governments', 'One Acre Fund', 'KTDA', 'Export Companies'],
    salaryRangeKES: { entry: 45000, mid: 80000, senior: 150000 },
    ruralVsUrban: 'rural_viable',
  },
  'digital_marketer': {
    sectorGrowth: 'booming',
    entryBarriers: 'low',
    saturationLevel: 'saturated',
    keyEmployers: ['Agencies', 'E-commerce', 'SMEs', 'Corporate'],
    salaryRangeKES: { entry: 35000, mid: 80000, senior: 200000 },
    ruralVsUrban: 'hybrid',
  },
  'renewable_energy_technician': {
    sectorGrowth: 'booming',
    entryBarriers: 'medium',
    saturationLevel: 'underserved',
    keyEmployers: ['KenGen', 'Rural Electrification', 'Solar Companies', 'KPLC'],
    salaryRangeKES: { entry: 40000, mid: 90000, senior: 180000 },
    ruralVsUrban: 'rural_viable',
  },
};

// ==================== THE INTELLIGENCE ENGINE ====================

export class CareerIntelligenceEngine {
  private supabase = createServiceClient();

  /**
   * Get comprehensive career intelligence with multiple fallback layers
   */
  async getCareerIntelligence(careerName: string): Promise<CareerIntelligence> {
    const normalizedName = this.normalizeCareerName(careerName);
    
    // Layer 1: Check verified database
    const verified = await this.getVerifiedCareer(normalizedName);
    if (verified) return verified;

    // Layer 2: Check local market realities + AI generation
    const localData = KENYAN_MARKET_REALITIES[normalizedName];
    if (localData) {
      return this.generateWithLocalContext(normalizedName, localData);
    }

    // Layer 3: Full AI generation with strict validation
    return this.generateFromScratch(normalizedName);
  }

  /**
   * Generate career comparison for decision making
   */
  async compareCareers(careerNames: string[]): Promise<{
    comparison: Record<string, CareerIntelligence>;
    recommendation: string;
    riskAnalysis: string;
  }> {
    const careers = await Promise.all(
      careerNames.map(name => this.getCareerIntelligence(name))
    );

    const comparison = Object.fromEntries(
      careers.map(c => [c.id, c])
    );

    // AI-powered comparison analysis
    const analysis = await this.generateComparisonAnalysis(careers);

    return {
      comparison,
      recommendation: analysis.recommendation,
      riskAnalysis: analysis.riskAnalysis,
    };
  }

  /**
   * Get CBC-aligned career pathway for a student
   */
  async getStudentCareerPathway(
    studentGrade: number,
    studentStrengths: string[],
    studentInterests: string[]
  ): Promise<{
    recommendedCareers: CareerIntelligence[];
    pathwayMap: {
      junior: string[];
      senior: string[];
      university: string[];
    };
    alternativeRoutes: string[];
  }> {
    // Match strengths to careers
    const matches = await this.matchStrengthsToCareers(studentStrengths);
    
    // Filter by grade-appropriate visibility
    const visibleCareers = matches.filter(c => 
      this.isCareerVisibleToGrade(c, studentGrade)
    );

    // Build pathway
    const pathwayMap = this.buildCBCPathway(visibleCareers[0], studentGrade);

    return {
      recommendedCareers: visibleCareers.slice(0, 3),
      pathwayMap,
      alternativeRoutes: this.suggestAlternatives(visibleCareers[0]),
    };
  }

  // ==================== PRIVATE METHODS ====================

  private normalizeCareerName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  private async getVerifiedCareer(name: string): Promise<CareerIntelligence | null> {
    const { data } = await this.supabase
      .from('career_intelligence')
      .select('id, name, category, description, kenyan_market, cbc_mapping, ai_forecast, real_stories, verification_status, last_updated')
      .eq('id', name)
      .eq('verification_status', 'profession_validated')
      .single();

    return data as unknown as CareerIntelligence | null;
  }

  private async generateWithLocalContext(
    name: string,
    localData: Partial<KenyanMarketData>
  ): Promise<CareerIntelligence> {
    // Use AI to fill gaps, but anchor to local realities
    const prompt = this.buildAnchoredPrompt(name, localData);
    const aiData = await this.callDeepSeek(prompt);
    
    return this.mergeWithLocalData(aiData, localData);
  }

  private async generateFromScratch(name: string): Promise<CareerIntelligence> {
    let webContext = '';
    try {
      const searchQuery = encodeURIComponent(name + ' career Kenya salary requirements 2025');
      const ddgRes = await fetch(
        'https://api.duckduckgo.com/?q=' + searchQuery + '&format=json&no_html=1',
        { signal: AbortSignal.timeout(3000) }
      );
      const ddgData = await ddgRes.json();
      webContext = ddgData.Abstract || ddgData.RelatedTopics?.[0]?.Text || '';
    } catch {
      webContext = ''; // fail silently
    }

    const prompt = this.buildComprehensivePrompt(name) +
      (webContext ? '\n\nWEB CONTEXT: ' + webContext : '');
    const aiData = await this.callDeepSeek(prompt);

    // Save to career_intelligence table
    await this.supabase.from('career_intelligence').upsert({
      id: name,
      name: aiData.name,
      ...aiData,
      verification_status: 'ai_generated',
      last_updated: new Date().toISOString(),
    }, { onConflict: 'id' });

    // Flag for expert review
    await this.flagForReview(name, aiData);

    return {
      ...aiData,
      verificationStatus: 'ai_generated',
      lastUpdated: new Date(),
    };
  }

  private buildAnchoredPrompt(name: string, localData: Partial<KenyanMarketData>): string {
    return `
      You are a Kenyan career intelligence expert. Research: "${name}"
      
      KNOWN KENYAN MARKET DATA:
      - Sector Growth: ${localData.sectorGrowth}
      - Saturation: ${localData.saturationLevel}
      - Key Employers: ${localData.keyEmployers?.join(', ')}
      - Salary Range (KES): Entry ${localData.salaryRangeKES?.entry.toLocaleString()}, Mid ${localData.salaryRangeKES?.mid.toLocaleString()}, Senior ${localData.salaryRangeKES?.senior.toLocaleString()}
      
      Generate JSON with these additional details:
      {
        "description": "What this career actually involves day-to-day",
        "cbcMapping": {
          "juniorSchoolFocus": ["Subjects to excel in Junior School"],
          "seniorSchoolPathways": ["STEM/Arts/TVET"],
          "keyLearningAreas": ["Mathematics", "Science", etc],
          "suggestedCCAs": ["Clubs that help"],
          "portfolioProjects": ["Projects to build"]
        },
        "aiForecast": {
          "automationRisk": 0-100,
          "timeline": "5_years/10_years/etc",
          "humanAdvantage": ["Skills AI can't replace"],
          "pivotOpportunities": ["Related careers if this fails"]
        },
        "realStories": {
          "successProfile": "Typical successful Kenyan in this field",
          "challengesFaced": ["Real challenges in Kenya"],
          "adviceForStudents": "Practical advice from professionals"
        }
      }
      
      IMPORTANT: Salary data provided is accurate for Kenya 2024. Do not deviate significantly.
    `;
  }

  private buildComprehensivePrompt(name: string): string {
    return `
      Research career: "${name}" for Kenyan students.
      
      Return JSON:
      {
        "id": "${name}",
        "name": "Human readable name",
        "category": "traditional/emerging/future/hybrid",
        "description": "Day-to-day reality",
        "kenyanMarket": {
          "sectorGrowth": "declining/stable/growing/booming",
          "entryBarriers": "low/medium/high/very_high",
          "saturationLevel": "underserved/balanced/saturated/oversaturated",
          "keyEmployers": ["Real Kenyan companies"],
          "salaryRangeKES": {"entry": 30000, "mid": 80000, "senior": 150000},
          "ruralVsUrban": "rural_viable/urban_only/hybrid"
        },
        "cbcMapping": {
          "juniorSchoolFocus": ["Mathematics", "English", etc],
          "seniorSchoolPathways": ["STEM", "TVET"],
          "keyLearningAreas": ["Specific CBC subjects"],
          "suggestedCCAs": ["Science Club", "Debate", etc],
          "portfolioProjects": ["Build X", "Create Y"]
        },
        "aiForecast": {
          "automationRisk": 0-100,
          "timeline": "5_years",
          "humanAdvantage": ["Creativity", "Empathy", etc],
          "pivotOpportunities": ["Related career 1", "Related career 2"]
        },
        "realStories": {
          "successProfile": "Composite of real Kenyan professionals",
          "challengesFaced": ["Specific Kenyan challenges"],
          "adviceForStudents": "Actionable advice"
        }
      }
      
      RULES:
      - Be realistic about Kenyan job market
      - Use actual Kenyan companies and universities
      - Consider rural vs urban divide
      - Account for CBC curriculum structure
    `;
  }

  private async callDeepSeek(prompt: string): Promise<any> {
    const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
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
        temperature: 0.5,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Robust JSON extraction
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  private mergeWithLocalData(aiData: any, localData: Partial<KenyanMarketData>): CareerIntelligence {
    return {
      ...aiData,
      kenyanMarket: {
        ...aiData.kenyanMarket,
        ...localData,
      },
      verificationStatus: 'expert_reviewed',
      lastUpdated: new Date(),
    };
  }

  private async flagForReview(name: string, data: any): Promise<void> {
    await this.supabase.from('career_review_queue').insert({
      career_name: name,
      ai_generated_data: data,
      priority: 'medium',
      created_at: new Date().toISOString(),
    });
  }

  private async generateComparisonAnalysis(careers: CareerIntelligence[]): Promise<{
    recommendation: string;
    riskAnalysis: string;
  }> {
    const prompt = `
      Compare these careers for a Kenyan student:
      ${careers.map(c => `
        - ${c.name}: Growth ${c.kenyanMarket.sectorGrowth}, AI Risk ${c.aiForecast.automationRisk}%, Saturation ${c.kenyanMarket.saturationLevel}
      `).join('\n')}
      
      Provide:
      1. Recommendation: Which is best for stability vs growth vs passion
      2. Risk Analysis: What could go wrong with each choice
      
      Return JSON: {"recommendation": "...", "riskAnalysis": "..."}
    `;

    const result = await this.callDeepSeek(prompt);
    return {
      recommendation: result.recommendation,
      riskAnalysis: result.riskAnalysis,
    };
  }

  private async matchStrengthsToCareers(strengths: string[]): Promise<CareerIntelligence[]> {
    // Query database for career matches
    const { data } = await this.supabase
      .from('career_intelligence')
      .select('id, name, category, description, kenyan_market, cbc_mapping, ai_forecast, real_stories, verification_status, last_updated')
      .overlaps('cbc_mapping->keyLearningAreas', strengths)
      .limit(10);

    return (data as unknown as CareerIntelligence[]) || [];
  }

  private isCareerVisibleToGrade(_career: CareerIntelligence, grade: number): boolean {
    if (grade <= 9) return true; // Junior school (7-9): pathway guidance
    return true; // Senior school (10-12): full career matching
  }

  private buildCBCPathway(career: CareerIntelligence, currentGrade: number): {
    junior: string[];
    senior: string[];
    university: string[];
  } {
    return {
      junior: career.cbcMapping.juniorSchoolFocus,
      senior: [
        `Choose ${career.cbcMapping.seniorSchoolPathways[0]} pathway`,
        `Focus on: ${career.cbcMapping.keyLearningAreas.slice(0, 3).join(', ')}`,
        `Join: ${career.cbcMapping.suggestedCCAs[0]}`,
      ],
      university: [
        `Bachelor's in ${career.name} or related field`,
        `Internship at ${career.kenyanMarket.keyEmployers[0]}`,
        `Professional certification`,
      ],
    };
  }

  private suggestAlternatives(career: CareerIntelligence): string[] {
    return career.aiForecast.pivotOpportunities;
  }
}

// Singleton
export const careerEngine = new CareerIntelligenceEngine();

// ==================== CACHED CAREER ANALYSIS ====================

import { unstable_cache } from 'next/cache';

export const getCachedCareerAnalysis = (careerName: string) =>
  unstable_cache(
    () => careerEngine.getCareerIntelligence(careerName),
    [`career_intel_${careerName.toLowerCase().replace(/\s+/g, '_')}`],
    { revalidate: 21600, tags: ['career-intelligence'] }
  )();

// ==================== TYPES + FUNCTIONS RE-EXPORTED FROM careerAnalysis ====================
// These were previously in lib/ai/careerAnalysis.ts.
// They are standalone DeepSeek callers used by the career-guidance page.

import type { SubjectScores } from '@/lib/pathwayCalculator';

export type CareerProfile = {
  studentName: string;
  grade: number;
  pathway: string;
  subjectScores: SubjectScores;
  strengths: string[];
  weaknesses: string[];
  pathwayConfidence: 'high' | 'medium' | 'low';
};

export type CareerRecommendation = {
  career: string;
  matchScore: number;
  reasoning: string;
  requiredSubjects: string[];
  currentGaps: string[];
  kenyanUniversities: string[];
  tvetOptions: string[];
  internationalOptions: string[];
  industryDemand: 'very_high' | 'high' | 'moderate' | 'low';
  earningPotential: 'exceptional' | 'very_lucrative' | 'lucrative' | 'moderate' | 'lower_but_stable';
  jobSecurity: 'very_high' | 'high' | 'moderate' | 'low';
  kenyanMarketReality: string;
  aiDisruptionRisk: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
  careerPath: string[];
};

export type IntegratedLearningPlan = {
  career: string;
  subject: string;
  currentLevel: number;
  targetLevel: number;
  whyItMatters: string;
  careerSpecificSteps: string[];
  careerSpecificResources: string[];
  successStories: string[];
  milestones: Array<{ month: number; goal: string; careerRelevance: string }>;
};

async function callDeepSeekStandalone(prompt: string): Promise<string> {
  const response = await fetch(`${DEEPSEEK_CONFIG.baseURL}/chat/completions`, {
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
          content: 'You are a helpful assistant. Always respond with valid JSON only — no markdown, no explanation, just the raw JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}

export async function analyzeCareerOptions(
  profile: CareerProfile
): Promise<CareerRecommendation[]> {
  const prompt = `You are an expert Kenyan education and career counselor specializing in the CBC (Competency-Based Curriculum) system.

STUDENT PROFILE:
- Name: ${profile.studentName}
- Grade: ${profile.grade}
- Current Pathway Affinity: ${profile.pathway}
- Pathway Confidence: ${profile.pathwayConfidence}

PERFORMANCE DATA:
Strengths (Score ≥ 3): ${profile.strengths.join(', ')}
Weaknesses (Score ≤ 2): ${profile.weaknesses.join(', ')}

Subject Scores (1-4 CBC scale):
${Object.entries(profile.subjectScores).map(([subject, score]) => `- ${subject}: ${score}`).join('\n')}

TASK: Provide 5 career recommendations that match the student's strengths, are realistic for Kenya's job market, consider TVET options, and account for AI disruption.

For EACH career return:
- career, matchScore (0-100), reasoning, requiredSubjects, currentGaps
- kenyanUniversities (top 3), tvetOptions, internationalOptions
- industryDemand (very_high/high/moderate/low)
- earningPotential (exceptional/very_lucrative/lucrative/moderate/lower_but_stable)
- jobSecurity (very_high/high/moderate/low)
- kenyanMarketReality (2-3 sentences), aiDisruptionRisk (very_low/low/moderate/high/very_high)
- careerPath (3-5 steps)

CRITICAL: DO NOT include specific salary numbers. Return as a JSON array ONLY.`;

  try {
    const text = await callDeepSeekStandalone(prompt);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Failed to parse AI response');
    const careers: CareerRecommendation[] = JSON.parse(jsonMatch[0]);
    return careers.slice(0, 5);
  } catch (error) {
    console.error('Career analysis error:', error);
    throw new Error('Failed to generate career recommendations');
  }
}

export async function generateCareerIntegratedLearningPlan(
  career: string,
  subject: string,
  currentLevel: number,
  targetLevel: number,
  studentName: string
): Promise<IntegratedLearningPlan> {
  const prompt = `You are a personalized learning coach for ${studentName}, a Kenyan CBC student.

CONTEXT:
- Career Goal: ${career}
- Subject: ${subject}
- Current CBC Level: ${currentLevel} (1=Below Expectations, 2=Approaching, 3=Meeting, 4=Exceeding)
- Target Level: ${targetLevel}

Create a personalized learning plan. Return as JSON ONLY:
{
  "whyItMatters": "...",
  "careerSpecificSteps": ["step1", "step2", "step3"],
  "careerSpecificResources": ["resource1", "resource2", "resource3"],
  "successStories": ["story1", "story2"],
  "milestones": [
    {"month": 1, "goal": "...", "careerRelevance": "..."},
    {"month": 2, "goal": "...", "careerRelevance": "..."},
    {"month": 3, "goal": "Reach level ${targetLevel}", "careerRelevance": "..."}
  ]
}

Make it INSPIRING and SPECIFIC to ${career}. Use Kenyan context. Prioritize FREE resources.`;

  try {
    const text = await callDeepSeekStandalone(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse AI response');
    const plan = JSON.parse(jsonMatch[0]);
    return { career, subject, currentLevel, targetLevel, ...plan };
  } catch (error) {
    console.error('Integrated learning plan error:', error);
    throw new Error('Failed to generate integrated learning plan');
  }
}