import type { CurriculumConfig } from './types'

export const IGCSE_CONFIG: CurriculumConfig = {
  id: 'igcse',
  name: 'Cambridge IGCSE',
  fullName: 'International General Certificate of Secondary Education',
  country: 'International',
  ageRange: '11-16',
  gradingSystem: 'grades',
  assessmentStyle: 'mixed',
  examBoard: 'Cambridge Assessment International Education (CAIE)',
  description: 'Internationally recognised Cambridge curriculum for Year 7-11',

  gradeLabels: [
    { value: 'A*', label: 'Exceptional', color: '#7c3aed', numericEquivalent: 97 },
    { value: 'A', label: 'Excellent', color: '#2563eb', numericEquivalent: 87 },
    { value: 'B', label: 'Good', color: '#16a34a', numericEquivalent: 77 },
    { value: 'C', label: 'Satisfactory', color: '#65a30d', numericEquivalent: 67 },
    { value: 'D', label: 'Approaching', color: '#d97706', numericEquivalent: 57 },
    { value: 'E', label: 'Borderline', color: '#ea580c', numericEquivalent: 47 },
    { value: 'F', label: 'Below Standard', color: '#dc2626', numericEquivalent: 37 },
    { value: 'G', label: 'Minimum', color: '#b91c1c', numericEquivalent: 27 },
    { value: 'U', label: 'Ungraded', color: '#6b7280', numericEquivalent: 10 },
  ],

  phases: [
    {
      name: 'Lower Secondary (Key Stage 3)',
      yearRange: 'Year 7-9',
      ageRange: '11-14',
      phaseType: 'junior',
      hasPathwayRecommendation: true,
      nextPhaseGoal:
        'Select optimal IGCSE subject combination for Year 10-11',
      subjects: [
        // Compulsory
        { id: 'english', displayName: 'English', name: 'english', isCompulsory: true },
        { id: 'mathematics', displayName: 'Mathematics', name: 'mathematics', isCompulsory: true },
        { id: 'science', displayName: 'Sciences (Biology/Chemistry/Physics)', name: 'science', isCompulsory: true },
        { id: 'humanities', displayName: 'Humanities (History/Geography)', name: 'humanities', isCompulsory: true },
        { id: 'ict', displayName: 'ICT / Computer Studies', name: 'ict', isCompulsory: true },
        { id: 'physical_education', displayName: 'Physical Education', name: 'physical_education', isCompulsory: true },
        { id: 'pshe', displayName: 'PSHE', name: 'pshe', isCompulsory: true },
        // Common in Kenya IGCSE schools
        { id: 'kiswahili', displayName: 'Kiswahili', name: 'kiswahili', isCompulsory: false },
        { id: 'french', displayName: 'French', name: 'french', isCompulsory: false },
        // Optional
        { id: 'art_design', displayName: 'Art & Design', name: 'art_design', isCompulsory: false },
        { id: 'music', displayName: 'Music', name: 'music', isCompulsory: false },
        { id: 'economics', displayName: 'Economics', name: 'economics', isCompulsory: false },
        { id: 'drama', displayName: 'Drama', name: 'drama', isCompulsory: false },
      ]
    },
    {
      name: 'Upper Secondary (IGCSE)',
      yearRange: 'Year 10-11',
      ageRange: '14-16',
      phaseType: 'senior',
      hasPathwayRecommendation: false,
      nextPhaseGoal:
        'Cambridge IGCSE examinations → A-Levels or IB Diploma',
      subjects: [
        // Group 1: Languages
        { id: 'english_first_language', displayName: 'English First Language (0500)', name: 'english_first_language', isCompulsory: false, group: 'Languages' },
        { id: 'english_second_language', displayName: 'English Second Language (0510)', name: 'english_second_language', isCompulsory: false, group: 'Languages' },
        { id: 'kiswahili', displayName: 'Kiswahili (0262)', name: 'kiswahili', isCompulsory: false, group: 'Languages' },
        { id: 'french', displayName: 'French (0520)', name: 'french', isCompulsory: false, group: 'Languages' },
        // Group 2: Humanities
        { id: 'history', displayName: 'History (0470)', name: 'history', isCompulsory: false, group: 'Humanities' },
        { id: 'geography', displayName: 'Geography (0460)', name: 'geography', isCompulsory: false, group: 'Humanities' },
        { id: 'economics', displayName: 'Economics (0455)', name: 'economics', isCompulsory: false, group: 'Humanities' },
        { id: 'business_studies', displayName: 'Business Studies (0450)', name: 'business_studies', isCompulsory: false, group: 'Humanities' },
        { id: 'global_perspectives', displayName: 'Global Perspectives (0457)', name: 'global_perspectives', isCompulsory: false, group: 'Humanities' },
        // Group 3: Sciences
        { id: 'biology', displayName: 'Biology (0610)', name: 'biology', isCompulsory: false, group: 'Sciences' },
        { id: 'chemistry', displayName: 'Chemistry (0620)', name: 'chemistry', isCompulsory: false, group: 'Sciences' },
        { id: 'physics', displayName: 'Physics (0625)', name: 'physics', isCompulsory: false, group: 'Sciences' },
        { id: 'combined_science', displayName: 'Combined Science (0653)', name: 'combined_science', isCompulsory: false, group: 'Sciences' },
        { id: 'environmental_management', displayName: 'Environmental Management (0680)', name: 'environmental_management', isCompulsory: false, group: 'Sciences' },
        // Group 4: Mathematics
        { id: 'mathematics', displayName: 'Mathematics (0580)', name: 'mathematics', isCompulsory: true, group: 'Mathematics' },
        { id: 'additional_mathematics', displayName: 'Additional Mathematics (0606)', name: 'additional_mathematics', isCompulsory: false, group: 'Mathematics' },
        // Group 5: Creative
        { id: 'computer_science', displayName: 'Computer Science (0478)', name: 'computer_science', isCompulsory: false, group: 'Creative & Professional' },
        { id: 'art_design', displayName: 'Art & Design (0400)', name: 'art_design', isCompulsory: false, group: 'Creative & Professional' },
        { id: 'music', displayName: 'Music (0410)', name: 'music', isCompulsory: false, group: 'Creative & Professional' },
        { id: 'physical_education', displayName: 'Physical Education (0413)', name: 'physical_education', isCompulsory: false, group: 'Creative & Professional' },
        { id: 'drama', displayName: 'Drama (0411)', name: 'drama', isCompulsory: false, group: 'Creative & Professional' },
        { id: 'accounting', displayName: 'Accounting (0452)', name: 'accounting', isCompulsory: false, group: 'Creative & Professional' },
      ]
    }
  ]
}
