import { createServiceClient } from '@/utils/supabase/service';
import { careerEngine, CareerIntelligence } from './careerIntelligence';
import { CAREER_DATABASE } from './careerDatabase';

// ==================== TYPES ====================

export interface StudentAssessment {
  academic: {
    grade: number;
    subjectScores: Record<string, number>;
    learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
    strongestSubjects: string[];
    strugglingSubjects: string[];
  };
  psychometric: {
    personalityType: string;
    interests: string[];
    workValues: string[];
    stressTolerance: 'low' | 'medium' | 'high';
  };
  practical: {
    preferredLocations: string[];
    financialConstraints: 'low' | 'medium' | 'high';
    familyExpectations: string[];
  };
  behavioral: {
    engagementPattern: 'consistent' | 'bursty' | 'struggling';
    persistenceScore: number;
  };
}

export interface CareerMatch {
  career: CareerIntelligence;
  matchScore: number;
  matchDimensions: {
    academicFit: number;
    personalityFit: number;
    interestAlignment: number;
    practicalViability: number;
    futureProofing: number;
  };
  pathway: {
    currentReadiness: 'ready' | 'developing' | 'early';
    nextSteps: string[];
    criticalGaps: string[];
    estimatedTimeline: string;
  };
  risks: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    mitigationStrategies: string[];
  };
  alternatives: {
    ifAcademicFails: string[];
    ifMarketChanges: string[];
    ifInterestShifts: string[];
  };
}

export interface MatchReport {
  topMatches: CareerMatch[];
  hiddenGems: CareerMatch[];
  avoidThese: CareerMatch[];
  developmentPlan: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  parentGuidance: {
    howToSupport: string[];
    conversationsToHave: string[];
    warningSigns: string[];
  };
  isLocked?: boolean;
}

// ==================== THE ENGINE ====================

export class CareerMatcher {
  private supabase = createServiceClient();

  // ==================== MAIN METHODS ====================

  async generateMatches(studentId: string, isPremium: boolean = false): Promise<MatchReport> {
    try {
      const { data: studentMeta } = await this.supabase
        .from('students')
        .select('id, name, grade, curriculum_type, year_level')
        .eq('id', studentId)
        .single();

      const curriculumType = studentMeta?.curriculum_type || 'cbc';
      const assessment = await this.compileStudentAssessment(studentId);
      const careers = await this.getRelevantCareers(assessment.academic.grade, curriculumType);
      const scoredMatches = await this.scoreAllCareers(careers, assessment);

      const topMatches = scoredMatches.slice(0, 5);
      
      if (!isPremium) {
        return {
          topMatches: [topMatches[0]],
          hiddenGems: [],
          avoidThese: [],
          developmentPlan: { 
            immediate: ["Focus on " + topMatches[0].pathway.criticalGaps[0]], 
            shortTerm: ["Upgrade to Premium to see full roadmap"], 
            longTerm: [] 
          },
          parentGuidance: { 
            howToSupport: ["Upgrade for full parental guidance reports"], 
            conversationsToHave: [], 
            warningSigns: [] 
          },
          isLocked: true
        };
      }

      const hiddenGems = scoredMatches
        .filter(m => m.matchDimensions.futureProofing > 80 && m.matchScore < 75)
        .slice(0, 3);

      const avoidThese = scoredMatches
        .filter(m => m.matchScore < 40)
        .slice(0, 2);

      const developmentPlan = this.createDevelopmentPlan(topMatches[0], assessment);
      const parentGuidance = this.generateParentGuidance(assessment, topMatches[0]);

      await this.saveMatchReport(studentId, topMatches);

      return { topMatches, hiddenGems, avoidThese, developmentPlan, parentGuidance, isLocked: false };
    } catch (error) {
      console.error("Match Engine Error:", error);
      throw new Error("Failed to align student with careers.");
    }
  }

  /**
   * NEW METHOD: Assess a specific career for a student
   * This was missing and caused the API error
   */
  async assessSpecificCareer(studentId: string, careerName: string): Promise<{
    studentId: string;
    career: {
      id: string;
      name: string;
      description: string;
      pathway: string;
      category: string;
    };
    assessment: {
      matchScore: number;
      compatibility: string;
      readiness: string;
    };
    gaps: string[];
    recommendedActions: string[];
    pathway: {
      currentPhase: string;
      nextMilestones: string[];
      recommendedSubjects: string[];
      extracurriculars: string[];
    };
    estimatedTimeToReady: string;
  }> {
    // Fetch student profile
    const { data: student, error: studentError } = await this.supabase
      .from('students')
      .select('id, name, grade, curriculum_type, year_level')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      throw new Error('Student not found');
    }

    // Fetch specific career
    const { data: career, error: careerError } = await this.supabase
      .from('career_intelligence')
      .select('id, name, description, category, salary_range_kes, required_subjects, cbc_mapping, ai_forecast, pathway')
      .ilike('name', `%${careerName}%`)
      .single();

    if (careerError || !career) {
      throw new Error(`Career "${careerName}" not found`);
    }

    // Compile full assessment for accurate scoring
    const assessment = await this.compileStudentAssessment(studentId);
    
    // Calculate detailed assessment
    const matchScore = this.calculateSingleMatchScore(student, career, assessment);
    const gaps = this.identifySkillGaps(student, career, assessment);
    const pathway = this.generatePathway(student, career);

    return {
      studentId,
      career: {
        id: career.id,
        name: career.name,
        description: career.description,
        pathway: career.pathway,
        category: career.category,
      },
      assessment: {
        matchScore,
        compatibility: this.getCompatibilityLabel(matchScore),
        readiness: this.calculateReadiness(student, career),
      },
      gaps,
      recommendedActions: this.generateActions(gaps, student.grade),
      pathway,
      estimatedTimeToReady: this.estimatePreparationTime(gaps, student.grade),
    };
  }

  // ==================== DATA COMPILATION ====================

  private async compileStudentAssessment(studentId: string): Promise<StudentAssessment> {
    const [academic, psych, behavior, profile] = await Promise.all([
      this.getAcademicStats(studentId),
      this.getPsychometricData(studentId),
      this.getBehavioralData(studentId),
      this.getProfilePracticalData(studentId)
    ]);

    return { academic, psychometric: psych, behavioral: behavior, practical: profile };
  }

  private async getAcademicStats(studentId: string) {
    const { data: assessments } = await this.supabase
      .from('assessments')
      .select('subject_scores, grade')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    const latest = assessments?.[0];
    const scores = (latest?.subject_scores as Record<string, number>) || {};

    return {
      grade: latest?.grade || 7,
      subjectScores: scores,
      learningStyle: 'visual' as const,
      strongestSubjects: Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([s]) => s),
      strugglingSubjects: Object.entries(scores)
        .filter(([, s]) => s < 2.5)
        .map(([s]) => s)
    };
  }

  private async getPsychometricData(studentId: string) {
    const { data } = await this.supabase
      .from('psychometric_assessments')
      .select('personality_type, holland_codes, work_values, stress_tolerance')
      .eq('student_id', studentId)
      .single();

    return {
      personalityType: data?.personality_type || 'analytical',
      interests: data?.holland_codes || ['Social', 'Investigative'],
      workValues: data?.work_values || ['Stability'],
      stressTolerance: (data?.stress_tolerance as 'low' | 'medium' | 'high') || 'medium'
    };
  }

  private async getBehavioralData(studentId: string) {
    return {
      engagementPattern: 'consistent' as const,
      persistenceScore: 85
    };
  }

  private async getProfilePracticalData(studentId: string) {
    const { data } = await this.supabase
      .from('students')
      .select('location_preference, financial_tier')
      .eq('id', studentId)
      .single();

    return {
      preferredLocations: data?.location_preference || ['urban'],
      financialConstraints: (data?.financial_tier as 'low' | 'medium' | 'high') || 'medium',
      familyExpectations: []
    };
  }

  // ==================== SCORING LOGIC ====================

  private async scoreAllCareers(careers: CareerIntelligence[], assessment: StudentAssessment): Promise<CareerMatch[]> {
    const results = careers.map(career => {
      const academicFit = this.calculateAcademicFit(career, assessment);
      const marketViability = 100 - career.aiForecast.automationRisk;
      const personalityFit = this.calculatePersonalityFit(career, assessment);

      const matchScore = Math.round((academicFit * 0.3) + (marketViability * 0.3) + (personalityFit * 0.4));

      return {
        career,
        matchScore,
        matchDimensions: {
          academicFit,
          personalityFit,
          interestAlignment: personalityFit,
          practicalViability: 80,
          futureProofing: marketViability
        },
        pathway: {
          currentReadiness: academicFit > 80 ? 'ready' : 'developing' as any,
          nextSteps: [
            `Focus on ${career.cbcMapping.keyLearningAreas[0]}`,
            `Join ${career.cbcMapping.suggestedCCAs?.[0] || 'Science Club'}`
          ],
          criticalGaps: academicFit < 60 ? [`Low performance in ${career.cbcMapping.keyLearningAreas[0]}`] : [],
          estimatedTimeline: "4-6 Years"
        },
        risks: {
          level: career.aiForecast.automationRisk > 50 ? 'high' : 'low' as any,
          factors: [`AI automation risk: ${career.aiForecast.automationRisk}%`],
          mitigationStrategies: ["Focus on uniquely human creativity"]
        },
        alternatives: {
          ifAcademicFails: career.aiForecast.pivotOpportunities,
          ifMarketChanges: ["Consultancy", "Teaching"],
          ifInterestShifts: ["Data Analytics"]
        }
      };
    });

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  private calculateAcademicFit(career: CareerIntelligence, assessment: StudentAssessment): number {
    const reqs = career.cbcMapping.keyLearningAreas;
    const scores = assessment.academic.subjectScores;
    if (reqs.length === 0) return 70;

    const total = reqs.reduce((sum, subject) => {
      const score = scores[subject] || 0;
      return sum + (score / 4);
    }, 0);
    return Math.round((total / reqs.length) * 100);
  }

  private calculatePersonalityFit(career: CareerIntelligence, assessment: StudentAssessment): number {
    return assessment.psychometric.interests.length > 0 ? 85 : 60;
  }

  // ==================== SPECIFIC CAREER ASSESSMENT HELPERS ====================

  private calculateSingleMatchScore(student: any, career: any, assessment: StudentAssessment): number {
    const academicFit = this.calculateAcademicFit(career, assessment);
    const marketViability = 100 - (career.ai_forecast?.automationRisk || 30);
    const personalityFit = this.calculatePersonalityFit(career, assessment);
    
    return Math.round((academicFit * 0.3) + (marketViability * 0.3) + (personalityFit * 0.4));
  }

  private getCompatibilityLabel(score: number): string {
    if (score >= 90) return 'Excellent Fit';
    if (score >= 80) return 'Strong Match';
    if (score >= 70) return 'Good Potential';
    if (score >= 60) return 'Possible with Work';
    return 'Challenging Path';
  }

  private calculateReadiness(student: any, career: any): string {
    const grade = student.grade || 7;
    
    if (grade >= 10) return 'Ready for specialization';
    if (grade >= 7) return 'Good time to start preparation';
    return 'Early exploration phase';
  }

  private identifySkillGaps(student: any, career: any, assessment: StudentAssessment): string[] {
    const gaps: string[] = [];
    const requiredSubjects = career.cbc_mapping?.keyLearningAreas || [];
    const scores = assessment.academic.subjectScores;
    
    requiredSubjects.forEach((subject: string) => {
      if (!scores[subject] || scores[subject] < 3) {
        gaps.push(subject);
      }
    });

    return gaps.length > 0 ? gaps : ['No critical gaps identified'];
  }

  private generatePathway(student: any, career: any) {
    const currentGrade = student.grade || 7;
    const targetGrade = 12;
    
    return {
      currentPhase: this.getPhase(currentGrade),
      nextMilestones: this.generateMilestones(currentGrade, targetGrade),
      recommendedSubjects: career.cbc_mapping?.seniorSchoolPathways || [],
      extracurriculars: career.cbc_mapping?.suggestedCCAs || [],
    };
  }

  private getPhase(grade: number): string {
    if (grade <= 3) return 'Foundation';
    if (grade <= 6) return 'Exploration';
    if (grade <= 9) return 'Specialization';
    return 'Preparation';
  }

  private generateMilestones(currentGrade: number, targetGrade: number): string[] {
    const milestones = [];
    for (let g = currentGrade + 1; g <= Math.min(currentGrade + 3, targetGrade); g++) {
      milestones.push(`Grade ${g}: Master core competencies`);
    }
    return milestones;
  }

  private generateActions(gaps: string[], grade: number): string[] {
    if (gaps.length === 0 || gaps[0] === 'No critical gaps identified') {
      return ['Maintain current performance', 'Explore advanced topics'];
    }
    
    return gaps.map(gap => 
      grade <= 6 
        ? `Build foundational ${gap} through daily practice`
        : `Advanced ${gap} preparation with mentor guidance`
    );
  }

  private estimatePreparationTime(gaps: string[], grade: number): string {
    if (gaps.length === 0 || gaps[0] === 'No critical gaps identified') {
      return 'On track with standard progression';
    }
    
    const years = Math.ceil(gaps.length / 2);
    if (grade + years > 12) return 'Extended preparation needed';
    return `${years} year${years > 1 ? 's' : ''} with consistent effort`;
  }

  // ==================== REPORT GENERATION ====================

  private createDevelopmentPlan(topMatch: CareerMatch, assessment: StudentAssessment) {
    return {
      immediate: [`Master ${topMatch.career.cbcMapping.juniorSchoolFocus[0]} basics`],
      shortTerm: [`Select ${topMatch.career.cbcMapping.seniorSchoolPathways[0]} in Grade 10`],
      longTerm: [`Aim for ${topMatch.career.kenyanMarket.keyEmployers[0]} internships`]
    };
  }

  private generateParentGuidance(assessment: StudentAssessment, topMatch: CareerMatch) {
    return {
      howToSupport: [`Buy books about ${topMatch.career.name}`],
      conversationsToHave: [`Discuss the role of AI in ${topMatch.career.name}`],
      warningSigns: [`Lack of interest in ${topMatch.career.cbcMapping.keyLearningAreas[0]}`]
    };
  }

  private async getRelevantCareers(grade: number, curriculumType: string = 'cbc'): Promise<CareerIntelligence[]> {
    const dbFallback: CareerIntelligence[] = CAREER_DATABASE.map((c) => ({
      id: c.id,
      name: c.name,
      cbcMapping: {
        juniorSchoolFocus: c.matchRequirements.primarySubjects,
        seniorSchoolPathways: [c.pathway] as ('STEM' | 'Arts & Sports' | 'Social Sciences' | 'TVET')[],
        keyLearningAreas: c.matchRequirements.primarySubjects,
        suggestedCCAs: [],
        portfolioProjects: [],
      },
      aiForecast: {
        automationRisk: c.aiImpact.disruptionPercentage,
        pivotOpportunities: c.aiImpact.survivalStrategy,
        humanAdvantage: [],
        timeline: '5_years' as const,
      },
      kenyanMarket: {
        sectorGrowth: c.aiImpact.growthOutlook === 'booming' ? 'booming' : (c.aiImpact.growthOutlook as any),
        keyEmployers: [],
        saturationLevel: 'balanced' as const,
        entryBarriers: 'medium' as const,
        ruralVsUrban: 'hybrid' as const,
        salaryRangeKES: { entry: 50000, mid: 120000, senior: 250000 },
      },
      category: 'traditional' as const,
      description: c.realityCheck.typicalDay,
      realStories: {
        successProfile: '',
        challengesFaced: c.realityCheck.challenges,
        adviceForStudents: '',
      },
      verificationStatus: 'ai_generated' as const,
      lastUpdated: new Date(),
    }));

    let query = this.supabase
      .from('career_intelligence')
      .select('id, name, description, category, salary_range_kes, required_subjects, cbc_mapping, ai_forecast, kenyan_market, pathway, university_path')
      .limit(20);

    // IGCSE students get international careers too; CBC students get local focus
    if (curriculumType === 'igcse') {
      query = query.or('curriculum_type.eq.igcse,curriculum_type.eq.both');
    } else {
      query = query.or('curriculum_type.eq.cbc,curriculum_type.eq.both,curriculum_type.is.null');
    }

    const { data } = await query;
    if (!data || data.length === 0) return dbFallback;
    return data as unknown as CareerIntelligence[];
  }

  private async saveMatchReport(studentId: string, matches: CareerMatch[]) {
    await this.supabase.from('career_match_reports').upsert({
      student_id: studentId,
      top_career_id: matches[0].career.id,
      score: matches[0].matchScore,
      updated_at: new Date().toISOString()
    }, { onConflict: 'student_id' });
  }
}

export const careerMatcher = new CareerMatcher();