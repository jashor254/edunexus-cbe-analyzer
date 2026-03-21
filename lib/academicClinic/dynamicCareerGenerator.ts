// lib/academicClinic/dynamicCareerGenerator.ts

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
 * Generate career dynamically using AI/research
 * This is called when career is not found in static database
 */
export async function generateDynamicCareer(careerName: string): Promise<DynamicCareer> {
  // In production, this would call an AI API (OpenAI, Gemini, etc.)
  // For now, we'll return researched data based on the career name
  
  console.log(`🔍 Researching career: ${careerName}`)
  
  // Normalize career name for matching
  const normalizedName = careerName.toLowerCase().trim()
  
  // STEM Careers
  if (normalizedName.includes('engineer') || 
      normalizedName.includes('software') || 
      normalizedName.includes('developer') ||
      normalizedName.includes('programmer')) {
    return {
      name: careerName,
      description: 'Design, build, and maintain software systems and applications that power modern businesses and services.',
      salary_range: 'KES 80,000 - 350,000/month',
      education_path: 'Bachelor\'s degree in Computer Science, Software Engineering, or related field',
      education_duration: '4 years',
      outlook: 'excellent',
      demand_in_kenya: 'very_high',
      ai_disruption_risk: 'low',
      required_subjects: ['mathematics', 'computer_studies', 'physics', 'english'],
      required_subjects_display: ['Mathematics', 'Computer Studies', 'Physics', 'English'],
      universities_in_kenya: [
        'University of Nairobi',
        'JKUAT',
        'Strathmore University',
        'Kenyatta University',
        'Technical University of Kenya'
      ],
      tvet_options: [
        'Kenya Coast National Polytechnic',
        'Eldoret National Polytechnic',
        'Kisumu National Polytechnic'
      ],
      career_path: [
        'Junior Developer (0-2 years)',
        'Software Developer (2-5 years)',
        'Senior Developer (5-8 years)',
        'Tech Lead (8+ years)',
        'Software Architect / Engineering Manager'
      ],
      is_ai_generated: true
    }
  }
  
  // Medical Careers
  if (normalizedName.includes('doctor') || 
      normalizedName.includes('medical') || 
      normalizedName.includes('physician') ||
      normalizedName.includes('surgeon')) {
    return {
      name: careerName,
      description: 'Diagnose and treat illnesses, perform medical procedures, and provide healthcare to patients.',
      salary_range: 'KES 120,000 - 600,000/month',
      education_path: 'Bachelor of Medicine and Bachelor of Surgery (MBChB) plus internship',
      education_duration: '6-7 years',
      outlook: 'excellent',
      demand_in_kenya: 'very_high',
      ai_disruption_risk: 'very_low',
      required_subjects: ['biology', 'chemistry', 'mathematics', 'physics', 'english'],
      required_subjects_display: ['Biology', 'Chemistry', 'Mathematics', 'Physics', 'English'],
      universities_in_kenya: [
        'University of Nairobi',
        'Moi University',
        'Kenyatta University',
        'Egerton University',
        'Maseno University'
      ],
      career_path: [
        'Medical Student',
        'Intern',
        'Medical Officer',
        'Senior Medical Officer',
        'Specialist / Consultant'
      ],
      is_ai_generated: true
    }
  }
  
  // Business Careers
  if (normalizedName.includes('business') || 
      normalizedName.includes('management') || 
      normalizedName.includes('account') ||
      normalizedName.includes('finance') ||
      normalizedName.includes('marketing')) {
    return {
      name: careerName,
      description: 'Manage business operations, analyze markets, drive growth, and lead organizations to success.',
      salary_range: 'KES 60,000 - 400,000/month',
      education_path: 'Bachelor\'s degree in Business, Commerce, Economics, or related field',
      education_duration: '4 years',
      outlook: 'good',
      demand_in_kenya: 'high',
      ai_disruption_risk: 'moderate',
      required_subjects: ['business_studies', 'mathematics', 'english', 'economics'],
      required_subjects_display: ['Business Studies', 'Mathematics', 'English', 'Economics'],
      universities_in_kenya: [
        'University of Nairobi',
        'Strathmore University',
        'USIU',
        'Kenyatta University',
        'Moi University'
      ],
      tvet_options: [
        'Kenya Institute of Management (KIM)',
        'Various National Polytechnics'
      ],
      career_path: [
        'Graduate Trainee',
        'Business Analyst',
        'Manager',
        'Senior Manager',
        'Director / Executive'
      ],
      is_ai_generated: true
    }
  }
  
  // Creative Careers
  if (normalizedName.includes('artist') || 
      normalizedName.includes('designer') || 
      normalizedName.includes('creative') ||
      normalizedName.includes('media') ||
      normalizedName.includes('film')) {
    return {
      name: careerName,
      description: 'Express creativity through various media, create visual content, and tell compelling stories.',
      salary_range: 'KES 40,000 - 200,000/month',
      education_path: 'Degree or diploma in Creative Arts, Design, Film, or related field',
      education_duration: '3-4 years',
      outlook: 'emerging',
      demand_in_kenya: 'moderate',
      ai_disruption_risk: 'moderate',
      required_subjects: ['creative_arts_sports', 'english', 'kiswahili', 'art'],
      required_subjects_display: ['Creative Arts', 'English', 'Kiswahili', 'Art'],
      universities_in_kenya: [
        'Kenyatta University',
        'Multimedia University',
        'University of Nairobi'
      ],
      career_path: [
        'Junior Creative',
        'Creative Specialist',
        'Senior Creative',
        'Creative Director'
      ],
      is_ai_generated: true
    }
  }
  
  // Default for unknown careers
  return {
    name: careerName,
    description: `A comprehensive career path in ${careerName} offering opportunities for growth and development.`,
    salary_range: 'KES 50,000 - 250,000/month (varies by experience)',
    education_path: 'Bachelor\'s degree or diploma in relevant field',
    education_duration: '3-4 years',
    outlook: 'good',
    demand_in_kenya: 'moderate',
    ai_disruption_risk: 'moderate',
    required_subjects: ['mathematics', 'english', 'kiswahili'],
    required_subjects_display: ['Mathematics', 'English', 'Kiswahili'],
    universities_in_kenya: [
      'University of Nairobi',
      'Kenyatta University',
      'Moi University'
    ],
    career_path: [
      'Entry Level',
      'Mid Level',
      'Senior Level',
      'Expert / Consultant'
    ],
    is_ai_generated: true
  }
}

/**
 * Enhance existing career with AI-generated details
 */
export async function enhanceCareerWithAI(baseCareer: any): Promise<any> {
  // This would add AI-generated insights to existing careers
  return {
    ...baseCareer,
    enhanced_by_ai: true,
    ai_insights: `Additional insights about ${baseCareer.name} generated by AI.`,
    enhanced_at: new Date().toISOString()
  }
}