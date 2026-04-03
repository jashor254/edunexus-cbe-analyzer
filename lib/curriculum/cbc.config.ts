import type { CurriculumConfig } from './types'

export const CBC_CONFIG: CurriculumConfig = {
  id: 'cbc',
  name: 'CBC Kenya',
  fullName: 'Competency-Based Curriculum',
  country: 'Kenya',
  ageRange: '12-18',
  gradingSystem: 'levels',
  assessmentStyle: 'continuous',
  description: 'Kenya\'s national curriculum for Grades 7-12',

  gradeLabels: [
    {
      value: 1,
      label: 'Below Expectations',
      color: '#ef4444',
      numericEquivalent: 20
    },
    {
      value: 2,
      label: 'Approaching Expectations',
      color: '#f59e0b',
      numericEquivalent: 50
    },
    {
      value: 3,
      label: 'Meets Expectations',
      color: '#22c55e',
      numericEquivalent: 75
    },
    {
      value: 4,
      label: 'Exceeds Expectations',
      color: '#8b5cf6',
      numericEquivalent: 95
    }
  ],

  phases: [
    {
      name: 'Junior School',
      yearRange: 'Grade 7-9',
      ageRange: '12-15',
      phaseType: 'junior',
      hasPathwayRecommendation: true,
      nextPhaseGoal:
        'Choose Senior School pathway: STEM, Arts & Sports, or Social Sciences',
      subjects: [
        { id: 'mathematics', displayName: 'Mathematics', name: 'mathematics', isCompulsory: true },
        { id: 'english', displayName: 'English', name: 'english', isCompulsory: true },
        { id: 'kiswahili', displayName: 'Kiswahili', name: 'kiswahili', isCompulsory: true },
        { id: 'integrated_science', displayName: 'Integrated Science', name: 'integrated_science', isCompulsory: true },
        { id: 'social_studies', displayName: 'Social Studies', name: 'social_studies', isCompulsory: true },
        { id: 'creative_arts_sports', displayName: 'Creative Arts & Sports', name: 'creative_arts_sports', isCompulsory: true },
        { id: 'pre_technical_studies', displayName: 'Pre-Technical Studies', name: 'pre_technical_studies', isCompulsory: true },
        { id: 'agriculture', displayName: 'Agriculture & Nutrition', name: 'agriculture', isCompulsory: false },
        { id: 'religious_education', displayName: 'Religious Education', name: 'religious_education', isCompulsory: false },
      ]
    },
    {
      name: 'Senior School',
      yearRange: 'Grade 10-12',
      ageRange: '15-18',
      phaseType: 'senior',
      hasPathwayRecommendation: false,
      nextPhaseGoal: 'University or TVET preparation',
      subjects: [
        { id: 'mathematics', displayName: 'Mathematics', name: 'mathematics', isCompulsory: true },
        { id: 'english', displayName: 'English', name: 'english', isCompulsory: true },
        { id: 'kiswahili', displayName: 'Kiswahili', name: 'kiswahili', isCompulsory: true },
        { id: 'biology', displayName: 'Biology', name: 'biology', isCompulsory: false },
        { id: 'chemistry', displayName: 'Chemistry', name: 'chemistry', isCompulsory: false },
        { id: 'physics', displayName: 'Physics', name: 'physics', isCompulsory: false },
        { id: 'history_citizenship', displayName: 'History & Citizenship', name: 'history_citizenship', isCompulsory: false },
        { id: 'geography', displayName: 'Geography', name: 'geography', isCompulsory: false },
        { id: 'business_studies', displayName: 'Business Studies', name: 'business_studies', isCompulsory: false },
        { id: 'computer_science', displayName: 'Computer Science', name: 'computer_science', isCompulsory: false },
        { id: 'agriculture', displayName: 'Agriculture', name: 'agriculture', isCompulsory: false },
        { id: 'art_design', displayName: 'Art & Design', name: 'art_design', isCompulsory: false },
        { id: 'music', displayName: 'Music', name: 'music', isCompulsory: false },
        { id: 'physical_education', displayName: 'Physical Education', name: 'physical_education', isCompulsory: false },
      ]
    }
  ]
}
