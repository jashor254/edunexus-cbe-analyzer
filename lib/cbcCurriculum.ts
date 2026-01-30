// lib/cbcCurriculum.ts

/**
 * Official CBC Learning Areas and Subjects
 * Based on KICD Curriculum Designs
 */

export type SchoolLevel = 'junior' | 'senior'

export type LearningArea = {
  id: string
  name: string
  level: SchoolLevel
  grades: number[]
  description: string
  keyTopics: string[]
}

/**
 * Junior Secondary Learning Areas (Grade 7-9)
 */
export const JUNIOR_LEARNING_AREAS: LearningArea[] = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    level: 'junior',
    grades: [7, 8, 9],
    description: 'Numbers, algebra, geometry, measurements, statistics',
    keyTopics: [
      'Whole numbers and operations',
      'Fractions, decimals, percentages',
      'Ratio and proportion',
      'Algebra (equations, patterns)',
      'Geometry (angles, shapes, measurements)',
      'Data handling and probability',
      'Metric measurements'
    ]
  },
  {
    id: 'integrated_science',
    name: 'Integrated Science',
    level: 'junior',
    grades: [7, 8, 9],
    description: 'Biology, Chemistry, Physics integrated approach',
    keyTopics: [
      'Scientific method and inquiry',
      'Classification of living things',
      'Human body systems',
      'Matter and its properties',
      'Chemical reactions',
      'Forces and motion',
      'Energy forms and transformations',
      'Electricity and magnetism',
      'Environmental conservation'
    ]
  },
  {
    id: 'english',
    name: 'English',
    level: 'junior',
    grades: [7, 8, 9],
    description: 'Language skills, literature, communication',
    keyTopics: [
      'Reading comprehension',
      'Grammar and vocabulary',
      'Writing (narrative, descriptive, argumentative)',
      'Oral communication',
      'Poetry and prose',
      'Functional writing (letters, reports)'
    ]
  },
  {
    id: 'kiswahili',
    name: 'Kiswahili',
    level: 'junior',
    grades: [7, 8, 9],
    description: 'Lugha ya Kiswahili na Fasihi',
    keyTopics: [
      'Sarufi (Grammar)',
      'Insha (Composition)',
      'Fasihi simulizi na andishi',
      'Maandishi ya vitendakazi',
      'Mazungumzo na mawasiliano',
      'Usomaji na ufahamu'
    ]
  },
  {
    id: 'social_studies',
    name: 'Social Studies',
    level: 'junior',
    grades: [7, 8, 9],
    description: 'Geography, History, Civics integrated',
    keyTopics: [
      'Kenya geography (physical features, climate)',
      'Kenya history (pre-colonial, colonial, independence)',
      'East African Community',
      'Citizenship and governance',
      'Economic activities',
      'Map reading and interpretation',
      'Current affairs (Kenyan context)'
    ]
  },
  {
    id: 'creative_arts_sports',
    name: 'Creative Arts and Sports Science',
    level: 'junior',
    grades: [7, 8, 9],
    description: 'Music, Art, Physical Education, Sports Science',
    keyTopics: [
      'Visual arts (drawing, painting, sculpture)',
      'Performing arts (drama, music, dance)',
      'Sports and games',
      'Physical fitness',
      'Health and nutrition in sports'
    ]
  },
  {
    id: 'pre_technical_studies',
    name: 'Pre-Technical and Pre-Career Education',
    level: 'junior',
    grades: [7, 8, 9],
    description: 'Practical skills and career exploration',
    keyTopics: [
      'Basic tools and materials',
      'Simple constructions',
      'Career exploration',
      'Entrepreneurship basics',
      'Technology in daily life'
    ]
  },
  {
    id: 'agriculture_nutrition',
    name: 'Agriculture and Nutrition',
    level: 'junior',
    grades: [7, 8, 9],
    description: 'Food production and healthy eating',
    keyTopics: [
      'Crop production',
      'Livestock keeping',
      'Food and nutrition',
      'Kitchen garden',
      'Food preservation'
    ]
  },
  {
    id: 'cre',
    name: 'Christian Religious Education',
    level: 'junior',
    grades: [7, 8, 9],
    description: 'Christian teachings and values',
    keyTopics: [
      'Bible stories and teachings',
      'Christian values and morals',
      'Prayer and worship',
      'Christian living'
    ]
  },
  {
    id: 'ire',
    name: 'Islamic Religious Education',
    level: 'junior',
    grades: [7, 8, 9],
    description: 'Islamic teachings and values',
    keyTopics: [
      'Quran and Hadith',
      'Islamic pillars',
      'Islamic morals and values',
      'Ibaadah (worship)'
    ]
  }
]

/**
 * Senior Secondary Subjects (Grade 10-12)
 * Based on Official KICD Curriculum Design (40 lessons per week)
 * Students choose 3 electives based on pathway: STEM, Arts, or Social Sciences
 */
export const SENIOR_SUBJECTS: LearningArea[] = [
  // CORE SUBJECTS (MANDATORY FOR ALL - 4 subjects)
  {
    id: 'english',
    name: 'English',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Core subject - 6 lessons per week',
    keyTopics: [
      'Literary analysis',
      'Critical essays',
      'Creative writing',
      'Oral literature',
      'Set books analysis',
      'Language structures',
      'Functional writing'
    ]
  },
  {
    id: 'kiswahili',
    name: 'Kiswahili / Kenyan Sign Language',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Core subject - 6 lessons per week',
    keyTopics: [
      'Fasihi ya Kiswahili',
      'Sarufi ya kina',
      'Uchambuzi wa vitabu',
      'Insha za kisasa',
      'Maandishi ya vitendakazi'
    ]
  },
  {
    id: 'physical_education',
    name: 'Physical Education',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Core subject - 3 lessons per week',
    keyTopics: [
      'Physical fitness and health',
      'Sports techniques',
      'Nutrition and wellness',
      'Team sports and games'
    ]
  },
  {
    id: 'community_service_learning',
    name: 'Community Service Learning (CSL)',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Core subject - 3 lessons per week',
    keyTopics: [
      'Community engagement',
      'Social responsibility',
      'Service projects',
      'Leadership and civic duty'
    ]
  },

  // ELECTIVE SUBJECTS (Choose 3 based on pathway)
  // Mathematics Pathway
  {
    id: 'mathematics',
    name: 'Mathematics',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (STEM pathway)',
    keyTopics: [
      'Advanced algebra',
      'Trigonometry',
      'Calculus (differentiation, integration)',
      'Vectors',
      'Sequences and series',
      'Coordinate geometry',
      'Statistics and probability'
    ]
  },
  
  // Sciences
  {
    id: 'physics',
    name: 'Physics',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (STEM pathway)',
    keyTopics: [
      'Mechanics (motion, forces, energy)',
      'Electricity and magnetism',
      'Waves and optics',
      'Thermodynamics',
      'Modern physics',
      'Practical investigations'
    ]
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (STEM pathway)',
    keyTopics: [
      'Atomic structure and bonding',
      'Chemical equations',
      'Organic chemistry',
      'Acids, bases, and salts',
      'Rates of reaction',
      'Electrochemistry',
      'Practical chemistry'
    ]
  },
  {
    id: 'biology',
    name: 'Biology',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (STEM/Medical pathway)',
    keyTopics: [
      'Cell biology',
      'Genetics and evolution',
      'Human physiology',
      'Ecology and conservation',
      'Plant biology',
      'Microorganisms'
    ]
  },
  {
    id: 'general_science',
    name: 'General Science',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Integrated science concepts',
      'Scientific inquiry',
      'Everyday science applications'
    ]
  },

  // Languages & Literature
  {
    id: 'literature_in_english',
    name: 'Literature in English',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (Arts pathway)',
    keyTopics: [
      'Poetry analysis',
      'Drama and plays',
      'Novels and prose',
      'Literary criticism',
      'Creative writing'
    ]
  },
  {
    id: 'fasihi_ya_kiswahili',
    name: 'Fasihi ya Kiswahili',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Riwaya (Novels)',
      'Tamthilia (Plays)',
      'Ushairi (Poetry)',
      'Hadithi fupi (Short stories)'
    ]
  },
  {
    id: 'sign_language',
    name: 'Sign Language',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Kenyan Sign Language basics',
      'Communication techniques',
      'Deaf culture and community'
    ]
  },
  {
    id: 'arabic',
    name: 'Arabic',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Arabic language',
      'Reading and writing',
      'Conversation',
      'Arabic literature'
    ]
  },
  {
    id: 'french',
    name: 'French',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'French language basics',
      'Grammar and vocabulary',
      'Conversation',
      'French culture'
    ]
  },
  {
    id: 'german',
    name: 'German',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'German language fundamentals',
      'Grammar and syntax',
      'Conversation practice'
    ]
  },
  {
    id: 'mandarin_chinese',
    name: 'Mandarin Chinese',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Mandarin basics',
      'Characters and writing',
      'Conversation',
      'Chinese culture'
    ]
  },
  {
    id: 'indigenous_languages',
    name: 'Indigenous Languages',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Local language study',
      'Cultural heritage',
      'Oral literature'
    ]
  },

  // Humanities & Social Sciences
  {
    id: 'history_and_citizenship',
    name: 'History and Citizenship',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (Social Sciences pathway)',
    keyTopics: [
      'Kenya history',
      'World history',
      'Government and politics',
      'Constitutional development',
      'Citizenship education'
    ]
  },
  {
    id: 'geography',
    name: 'Geography',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (Social Sciences pathway)',
    keyTopics: [
      'Physical geography',
      'Human geography',
      'Map work',
      'Environmental studies',
      'Regional geography'
    ]
  },
  {
    id: 'christian_religious_education',
    name: 'Christian Religious Education',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Bible studies',
      'Christian ethics',
      'Church history',
      'Christian living'
    ]
  },
  {
    id: 'islamic_religious_education',
    name: 'Islamic Religious Education',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Quran and Hadith',
      'Islamic law',
      'Islamic history',
      'Islamic ethics'
    ]
  },
  {
    id: 'hindu_religious_education',
    name: 'Hindu Religious Education',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Hindu scriptures',
      'Hindu philosophy',
      'Hindu practices and festivals'
    ]
  },
  {
    id: 'business_studies',
    name: 'Business Studies',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Business management',
      'Marketing',
      'Finance and accounting',
      'Entrepreneurship',
      'Commerce'
    ]
  },

  // Arts & Performance
  {
    id: 'music',
    name: 'Music',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (Arts pathway)',
    keyTopics: [
      'Music theory',
      'Instrument performance',
      'Music composition',
      'Music history'
    ]
  },
  {
    id: 'music_and_dance',
    name: 'Music and Dance',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (Arts pathway)',
    keyTopics: [
      'Traditional Kenyan dances',
      'Contemporary dance',
      'Choreography',
      'Performance arts'
    ]
  },
  {
    id: 'theatre_and_film',
    name: 'Theatre and Film',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (Arts pathway)',
    keyTopics: [
      'Acting techniques',
      'Script writing',
      'Film production',
      'Theatre history'
    ]
  },
  {
    id: 'fine_arts',
    name: 'Fine Arts',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (Arts pathway)',
    keyTopics: [
      'Drawing and painting',
      'Sculpture',
      'Art history',
      'Design principles'
    ]
  },
  {
    id: 'sports_and_recreation',
    name: 'Sports and Recreation',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Sports science',
      'Coaching techniques',
      'Sports management',
      'Recreation planning'
    ]
  },

  // Technical & Applied Sciences
  {
    id: 'computer_studies',
    name: 'Computer Studies',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Programming',
      'Computer systems',
      'Databases',
      'Networks',
      'Web design'
    ]
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Crop production',
      'Livestock management',
      'Agricultural economics',
      'Farm management'
    ]
  },
  {
    id: 'home_science',
    name: 'Home Science',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Nutrition',
      'Food preparation',
      'Home management',
      'Textile and design'
    ]
  },
  {
    id: 'aviation',
    name: 'Aviation',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Aviation basics',
      'Aerodynamics',
      'Navigation',
      'Aviation safety'
    ]
  },
  {
    id: 'building_and_construction',
    name: 'Building and Construction',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Construction techniques',
      'Building materials',
      'Architectural drawing',
      'Construction management'
    ]
  },
  {
    id: 'electricity',
    name: 'Electricity',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Electrical systems',
      'Wiring and installations',
      'Electrical safety',
      'Electrical maintenance'
    ]
  },
  {
    id: 'metalwork',
    name: 'Metalwork',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Metal fabrication',
      'Welding',
      'Metal design',
      'Workshop safety'
    ]
  },
  {
    id: 'power_mechanics',
    name: 'Power Mechanics',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Engine mechanics',
      'Automotive systems',
      'Machine operation',
      'Maintenance and repair'
    ]
  },
  {
    id: 'woodwork',
    name: 'Woodwork',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week',
    keyTopics: [
      'Woodworking techniques',
      'Furniture making',
      'Wood joinery',
      'Workshop safety'
    ]
  },
  {
    id: 'media_technology',
    name: 'Media Technology',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (offered in specific schools)',
    keyTopics: [
      'Digital media production',
      'Photography and videography',
      'Graphic design',
      'Media editing'
    ]
  },
  {
    id: 'marine_and_fisheries_technology',
    name: 'Marine and Fisheries Technology',
    level: 'senior',
    grades: [10, 11, 12],
    description: 'Elective - 6 lessons per week (offered in specific schools)',
    keyTopics: [
      'Marine biology',
      'Fish farming',
      'Maritime studies',
      'Fisheries management'
    ]
  }
]

/**
 * Get learning areas/subjects for a specific grade
 */
export function getSubjectsForGrade(grade: number): LearningArea[] {
  const level: SchoolLevel = grade <= 9 ? 'junior' : 'senior'
  const subjects = level === 'junior' ? JUNIOR_LEARNING_AREAS : SENIOR_SUBJECTS
  return subjects.filter(s => s.grades.includes(grade))
}

/**
 * Get subject details by ID
 */
export function getSubjectById(id: string): LearningArea | undefined {
  return [...JUNIOR_LEARNING_AREAS, ...SENIOR_SUBJECTS].find(s => s.id === id)
}

/**
 * Check if a topic is within CBC curriculum
 */
export function isValidCBCTopic(subjectId: string, topic: string): boolean {
  const subject = getSubjectById(subjectId)
  if (!subject) return false
  
  // Simple keyword matching (can be enhanced with AI later)
  const topicLower = topic.toLowerCase()
  return subject.keyTopics.some(keyTopic => 
    topicLower.includes(keyTopic.toLowerCase()) ||
    keyTopic.toLowerCase().includes(topicLower)
  )
}

/**
 * CBC Curriculum Boundaries - Topics that are OUT OF SCOPE
 */
export const OUT_OF_SCOPE_TOPICS = [
  // University-level topics
  'quantum mechanics',
  'organic synthesis',
  'advanced calculus',
  'molecular biology',
  'complex analysis',
  
  // Non-Kenyan curriculum
  'SAT preparation',
  'AP courses',
  'A-levels',
  'IB curriculum',
  
  // Inappropriate topics
  'exam cheating',
  'homework answers without explanation',
  
  // Too advanced for grade level
  'university admission essays', // for junior students
  'research methodology', // for junior students
]

/**
 * Check if query is appropriate for grade level
 */
export function isAppropriateForGrade(grade: number, topic: string): {
  appropriate: boolean
  reason?: string
} {
  const topicLower = topic.toLowerCase()
  
  // Check if topic is out of scope
  if (OUT_OF_SCOPE_TOPICS.some(blocked => topicLower.includes(blocked))) {
    return {
      appropriate: false,
      reason: 'This topic is outside the CBC curriculum'
    }
  }
  
  // Junior students asking about senior topics
  if (grade <= 9) {
    const seniorKeywords = ['calculus', 'differentiation', 'integration', 'vectors', 'organic chemistry']
    if (seniorKeywords.some(kw => topicLower.includes(kw))) {
      return {
        appropriate: false,
        reason: 'This topic is covered in Senior Secondary (Grade 10-12). Focus on your current grade topics first!'
      }
    }
  }
  
  return { appropriate: true }
}