// lib/academicClinic/careerDatabase.ts

// ==========================================
// TYPE DEFINITIONS
// ==========================================
export type AIDisruptionRisk = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high'
export type JobGrowthOutlook = 'declining' | 'stable' | 'growing' | 'booming'
export type EarningPotential = 'lower_but_stable' | 'moderate' | 'lucrative' | 'very_lucrative' | 'exceptional'
export type JobSecurity = 'low' | 'moderate' | 'high' | 'very_high'
export type DemandLevel = 'low' | 'moderate' | 'high' | 'very_high'

export type CareerData = {
  id: string
  name: string
  pathway: 'STEM' | 'Arts & Sports' | 'Social Sciences'
  matchRequirements: {
    primarySubjects: string[]
    minimumLevels: Record<string, number>
  }
  marketReality: {
    earningPotential: EarningPotential
    jobSecurity: JobSecurity
    demandLevel: DemandLevel
    kenyanContext: string
  }
  cbeReadiness: {
    coreCompetencies: string[]
    recommendedSeniorPath: string
    universities: string[]
    tvetOptions: string[]
  }
  aiImpact: {
    disruptionRisk: AIDisruptionRisk
    disruptionPercentage: number
    growthOutlook: JobGrowthOutlook
    growthPercentage: number
    timeline: {
      shortTerm: string
      midTerm: string
      longTerm: string
    }
    survivalStrategy: string[]
  }
  realityCheck: {
    pros: string[]
    challenges: string[]
    typicalDay: string
  }
}

// ==========================================
// CAREER DATABASE - 25 CAREERS
// ==========================================
export const CAREER_DATABASE: CareerData[] = [
  // ============================================
  // STEM PATHWAY (10 careers)
  // ============================================
  {
    id: 'software_engineer',
    name: 'Software Engineer / Developer',
    pathway: 'STEM',
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 3, integrated_science: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'high',
      demandLevel: 'very_high',
      kenyanContext: 'Tech startups, banks, telcos, and international remote jobs. Can work from anywhere. High demand, but competitive field requiring constant learning.',
    },
    cbeReadiness: {
      coreCompetencies: ['Critical Thinking', 'Digital Literacy', 'Problem Solving', 'Creativity'],
      recommendedSeniorPath: 'STEM - Computer Science & ICT',
      universities: ['JKUAT', 'UoN', 'Strathmore', 'Multimedia University', 'KCA'],
      tvetOptions: ['Nairobi Technical Training Institute', 'NIBS Tech', 'Zetech College'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 45,
      growthOutlook: 'booming',
      growthPercentage: 180,
      timeline: {
        shortTerm: 'AI tools like GitHub Copilot speed up coding but create MORE software jobs.',
        midTerm: 'Shift toward AI system architecture, ethics, and complex problem-solving.',
        longTerm: 'Human creativity and business understanding remain irreplaceable.',
      },
      survivalStrategy: [
        "Learn AI/ML fundamentals - don't fear AI, USE it",
        'Master system design and architecture (not just coding)',
        'Develop soft skills - communication, teamwork, business thinking',
        'Specialize in a niche (fintech, healthtech, agritech)',
      ],
    },
    realityCheck: {
      pros: [
        'Work remotely for global companies (earn in USD/EUR)',
        'Flexible hours and work-life balance',
        'Continuous learning keeps work interesting',
        'Can freelance or start your own tech company',
      ],
      challenges: [
        'Requires constant upskilling - tech changes fast',
        'Can be sedentary - health concerns if not careful',
        'Competitive job market for entry-level',
        'Imposter syndrome is common in the field',
      ],
      typicalDay:
        'Write code, attend team meetings (often virtual), debug issues, learn new technologies, collaborate on projects. Mix of solo deep work and team collaboration.',
    },
  },

  {
    id: 'medical_doctor',
    name: 'Medical Doctor',
    pathway: 'STEM',
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 3, integrated_science: 4 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'very_high',
      demandLevel: 'very_high',
      kenyanContext:
        'Always in demand. Can work in public hospitals, private clinics, or start own practice. Long training but guaranteed employment. Rural areas desperate for doctors.',
    },
    cbeReadiness: {
      coreCompetencies: ['Empathy', 'Communication', 'Ethical Decision Making', 'Critical Thinking'],
      recommendedSeniorPath: 'STEM - Biological Sciences',
      universities: ['UoN', 'Moi University', 'Aga Khan University', 'KU', 'JKUAT'],
      tvetOptions: [],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 5,
      growthOutlook: 'growing',
      growthPercentage: 60,
      timeline: {
        shortTerm: 'High demand persists across Kenya - urban and rural.',
        midTerm: 'AI assists diagnosis and surgery, but human touch critical.',
        longTerm: 'Bedside manner, empathy, and complex decision-making stay human.',
      },
      survivalStrategy: [
        'Embrace medical technology and AI diagnostic tools',
        'Specialize (cardiology, pediatrics, surgery, etc.)',
        'Develop excellent patient communication skills',
        'Consider public health or healthcare administration',
      ],
    },
    realityCheck: {
      pros: [
        'Saving lives - deeply fulfilling career',
        'Highly respected in society',
        'Job security guaranteed',
        'Multiple specialization options',
      ],
      challenges: [
        'Long education (6-8 years minimum)',
        'Emotionally and physically demanding',
        'Irregular hours, night shifts, emergencies',
        'High stress and burnout risk',
      ],
      typicalDay:
        'Patient consultations, diagnose conditions, prescribe treatment, perform procedures, update medical records, continuous learning on new treatments.',
    },
  },

  {
    id: 'data_scientist',
    name: 'Data Scientist / AI Specialist',
    pathway: 'STEM',
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 4, integrated_science: 3 },
    },
    marketReality: {
      earningPotential: 'exceptional',
      jobSecurity: 'high',
      demandLevel: 'very_high',
      kenyanContext:
        'Fastest growing tech field. Banks, insurance, telcos, government all need data scientists. Can work remotely for international companies. Shortage of qualified professionals.',
    },
    cbeReadiness: {
      coreCompetencies: ['Critical Thinking', 'Digital Literacy', 'Analytical Skills', 'Problem Solving'],
      recommendedSeniorPath: 'STEM - Data Science & Analytics',
      universities: ['Strathmore', 'USIU', 'JKUAT', 'UoN', 'Multimedia University'],
      tvetOptions: ['NIBS Tech - Data Analytics', 'Nairobi Tech - AI Fundamentals'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 20,
      growthOutlook: 'booming',
      growthPercentage: 250,
      timeline: {
        shortTerm: 'Explosive demand as Kenyan companies adopt data-driven decisions.',
        midTerm: 'AI builds basic models, but humans needed for strategy and ethics.',
        longTerm: 'Data governance, privacy, and ethical AI become critical roles.',
      },
      survivalStrategy: [
        'Master both technical skills AND business communication',
        'Specialize in industry verticals (fintech, health, agriculture)',
        'Focus on data ethics and explainable AI',
        'Build storytelling skills - translate data to decisions',
      ],
    },
    realityCheck: {
      pros: [
        'Cutting-edge field with constant innovation',
        'High demand, low supply of talent',
        'Can work across any industry',
        'Combination of math, tech, and business',
      ],
      challenges: [
        'Requires strong math and programming skills',
        'Fast-changing field - constant learning required',
        "Can be frustrating when business doesn't act on insights",
        'Need to explain complex concepts to non-technical people',
      ],
      typicalDay:
        'Clean and analyze data, build predictive models, create visualizations, present findings to stakeholders, collaborate with engineers and business teams.',
    },
  },

  {
    id: 'civil_engineer',
    name: 'Civil Engineer / Infrastructure Specialist',
    pathway: 'STEM',
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 4, integrated_science: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'very_high',
      kenyanContext:
        'Massive infrastructure projects (roads, buildings, dams). Government, private contractors, Chinese firms all hiring. Can start own construction consultancy.',
    },
    cbeReadiness: {
      coreCompetencies: ['Problem Solving', 'Spatial Intelligence', 'Project Management', 'Attention to Detail'],
      recommendedSeniorPath: 'STEM - Engineering & Technology',
      universities: ['UoN', 'JKUAT', 'Moi University', 'Egerton', 'TUK'],
      tvetOptions: ['Kenya Institute of Highways', 'Mombasa Technical Training Institute'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 25,
      growthOutlook: 'growing',
      growthPercentage: 90,
      timeline: {
        shortTerm: "Kenya's infrastructure boom continues (Vision 2030, Affordable Housing).",
        midTerm: 'AI assists design and planning, humans manage on-ground execution.',
        longTerm: 'Site judgment, safety, and stakeholder management remain human.',
      },
      survivalStrategy: [
        'Master BIM (Building Information Modeling) software',
        'Specialize in sustainable/green building',
        'Develop strong project management skills',
        'Get registered with Engineers Board of Kenya (EBK)',
      ],
    },
    realityCheck: {
      pros: [
        'See tangible results of your work (buildings, roads, bridges)',
        'Variety - office work and site visits',
        'Can own construction firm after experience',
        'Government and private sector opportunities',
      ],
      challenges: [
        'Site work can be physically demanding',
        'Dealing with contractors and deadlines stressful',
        'Weather-dependent work schedules',
        'Corruption in tender processes (ethical challenges)',
      ],
      typicalDay:
        'Site inspections, design reviews, coordinate with contractors, solve on-site problems, prepare reports, attend project meetings, ensure safety compliance.',
    },
  },

  {
    id: 'agricultural_scientist',
    name: 'Agricultural Scientist / Agri-Tech Specialist',
    pathway: 'STEM',
    matchRequirements: {
      primarySubjects: ['integrated_science', 'agriculture'],
      minimumLevels: { integrated_science: 3, agriculture: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'very_high',
      demandLevel: 'very_high',
      kenyanContext:
        'Kenya is agricultural. Food security is national priority. Tech-enabled farming (drones, IoT, precision agriculture) growing fast. Can be researcher, extension officer, or entrepreneur.',
    },
    cbeReadiness: {
      coreCompetencies: ['Innovation', 'Environmental Stewardship', 'Problem Solving', 'Entrepreneurship'],
      recommendedSeniorPath: 'STEM - Agriculture & Food Systems',
      universities: ['Egerton University', 'JKUAT', 'UoN', 'Moi University'],
      tvetOptions: ['Bukura Agricultural College', 'Embu University College'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 10,
      growthOutlook: 'booming',
      growthPercentage: 200,
      timeline: {
        shortTerm: 'Climate change and food security create massive opportunity.',
        midTerm: 'Tech-enabled farming (drones, sensors, AI) becomes standard.',
        longTerm: 'Human expertise in local conditions and adaptation critical.',
      },
      survivalStrategy: [
        'Learn precision agriculture and IoT systems',
        'Study climate-resilient crops and techniques',
        'Combine traditional knowledge with modern tech',
        'Build agri-business and value-addition skills',
      ],
    },
    realityCheck: {
      pros: [
        'Solve real problems (hunger, poverty, sustainability)',
        'Work outdoors and in labs',
        'Can own profitable agri-business',
        'Government support for agriculture',
      ],
      challenges: [
        'Weather and climate unpredictability',
        'Dealing with conservative farmers resistant to change',
        'Initial capital for experiments/startups',
        'Rural work may require relocation',
      ],
      typicalDay:
        'Field research, soil/crop testing, advise farmers, design irrigation systems, analyze data, write reports, conduct training sessions.',
    },
  },

  {
    id: 'pharmacist',
    name: 'Pharmacist',
    pathway: 'STEM',
    matchRequirements: {
      primarySubjects: ['integrated_science', 'mathematics'],
      minimumLevels: { integrated_science: 4, mathematics: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'very_high',
      demandLevel: 'high',
      kenyanContext:
        'Every hospital, clinic, and pharmacy needs licensed pharmacists. Can own retail pharmacy. Growing demand for pharmaceutical consultants and researchers.',
    },
    cbeReadiness: {
      coreCompetencies: ['Attention to Detail', 'Communication', 'Ethical Decision Making', 'Analytical Skills'],
      recommendedSeniorPath: 'STEM - Biological Sciences',
      universities: ['UoN', 'KU', 'Mount Kenya University', 'JKUAT'],
      tvetOptions: [],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 15,
      growthOutlook: 'growing',
      growthPercentage: 70,
      timeline: {
        shortTerm: 'Steady demand, aging population needs more medication.',
        midTerm: 'AI assists drug interaction checking, but counseling stays human.',
        longTerm: 'Personalized medicine and patient care require human expertise.',
      },
      survivalStrategy: [
        'Specialize (clinical pharmacy, industrial pharmacy, research)',
        'Develop excellent patient counseling skills',
        'Stay updated on new medications and treatments',
        'Consider pharmaceutical manufacturing or research',
      ],
    },
    realityCheck: {
      pros: [
        'Direct patient interaction and helping people',
        'Can own profitable retail pharmacy',
        'Regular working hours (compared to doctors)',
        'Respected profession with good income',
      ],
      challenges: [
        'Long hours standing in retail pharmacies',
        'Dealing with difficult patients and insurance',
        'High responsibility - medication errors can be fatal',
        'Competitive retail pharmacy market in cities',
      ],
      typicalDay:
        'Dispense medications, counsel patients on usage, check drug interactions, manage inventory, advise doctors on medications, ensure regulatory compliance.',
    },
  },

  {
    id: 'architect',
    name: 'Architect / Building Designer',
    pathway: 'STEM',
    matchRequirements: {
      primarySubjects: ['mathematics', 'creative_arts'],
      minimumLevels: { mathematics: 3, creative_arts: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext:
        'Real estate boom creates demand. Affordable housing projects, commercial buildings, renovation market. Can start own firm. Competitive but lucrative for good designers.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Spatial Intelligence', 'Problem Solving', 'Attention to Detail'],
      recommendedSeniorPath: 'STEM - Engineering & Design',
      universities: ['UoN', 'JKUAT', 'TUK - Technical University of Kenya'],
      tvetOptions: ['Kenya Polytechnic', 'Mombasa Polytechnic'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 40,
      growthOutlook: 'growing',
      growthPercentage: 65,
      timeline: {
        shortTerm: "AI generates basic floor plans, but creativity and client needs require humans.",
        midTerm: "Architects who use AI tools will outcompete those who don't.",
        longTerm: 'Cultural context, sustainability, and human-centered design stay human.',
      },
      survivalStrategy: [
        'Master AI design tools (Midjourney, parametric design)',
        'Focus on sustainable and green architecture',
        'Develop strong client relationship skills',
        'Specialize in a niche (heritage, eco-design, smart buildings)',
      ],
    },
    realityCheck: {
      pros: [
        'Creative and technical work combined',
        'See your designs become reality',
        'Can build own successful firm',
        'Work on diverse projects',
      ],
      challenges: [
        'Long education and apprenticeship period',
        'Dealing with contractors and clients can be stressful',
        'Projects can be delayed or cancelled',
        'Competitive field - need strong portfolio',
      ],
      typicalDay:
        'Meet clients, create design concepts, use CAD software, coordinate with engineers, visit construction sites, prepare presentations, manage budgets.',
    },
  },

  {
    id: 'environmental_scientist',
    name: 'Environmental Scientist / Conservationist',
    pathway: 'STEM',
    matchRequirements: {
      primarySubjects: ['integrated_science', 'geography'],
      minimumLevels: { integrated_science: 3, geography: 3 },
    },
    marketReality: {
      earningPotential: 'moderate',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext:
        'Climate change makes this critical. NGOs, NEMA, KWS, research institutions hiring. Growing corporate ESG (environmental, social, governance) roles.',
    },
    cbeReadiness: {
      coreCompetencies: ['Environmental Stewardship', 'Critical Thinking', 'Research Skills', 'Communication'],
      recommendedSeniorPath: 'STEM - Environmental Science',
      universities: ['Egerton', 'KU', 'UoN', 'Moi University'],
      tvetOptions: ['Kenya Wildlife Service Training Institute'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 10,
      growthOutlook: 'booming',
      growthPercentage: 150,
      timeline: {
        shortTerm: 'Climate crisis accelerates demand for environmental experts.',
        midTerm: 'AI helps data analysis, but field work and policy require humans.',
        longTerm: 'Community engagement and conservation leadership stay human.',
      },
      survivalStrategy: [
        'Combine science with policy and advocacy',
        'Learn GIS and environmental modeling tools',
        'Build community engagement skills',
        'Specialize (water, wildlife, renewable energy, waste management)',
      ],
    },
    realityCheck: {
      pros: [
        'Meaningful work protecting planet',
        'Work outdoors and in field',
        'Can work with wildlife and nature',
        'Growing field with job security',
      ],
      challenges: [
        'Pay lower than engineering/medicine initially',
        'Can be frustrating dealing with politics/bureaucracy',
        'Field work can be physically demanding',
        'Remote locations for some roles',
      ],
      typicalDay:
        'Environmental impact assessments, field data collection, lab analysis, write reports, advise on conservation, coordinate with communities and government.',
    },
  },

  {
    id: 'electrical_engineer',
    name: 'Electrical Engineer / Power Systems Specialist',
    pathway: 'STEM',
    matchRequirements: {
      primarySubjects: ['mathematics', 'integrated_science'],
      minimumLevels: { mathematics: 4, integrated_science: 4 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'very_high',
      demandLevel: 'very_high',
      kenyanContext:
        'Power infrastructure expansion (Last Mile Connectivity, renewable energy). KPLC, REA, private contractors, manufacturing companies all need electrical engineers.',
    },
    cbeReadiness: {
      coreCompetencies: ['Problem Solving', 'Critical Thinking', 'Safety Consciousness', 'Innovation'],
      recommendedSeniorPath: 'STEM - Engineering & Technology',
      universities: ['UoN', 'JKUAT', 'Moi University', 'TUK'],
      tvetOptions: ['Kenya Power Training School', 'Eldoret Polytechnic'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 20,
      growthOutlook: 'booming',
      growthPercentage: 120,
      timeline: {
        shortTerm: 'Renewable energy transition creates massive opportunities.',
        midTerm: 'Smart grids and automation require electrical engineers.',
        longTerm: 'Hands-on installation and safety oversight stay human.',
      },
      survivalStrategy: [
        'Specialize in renewable energy (solar, wind)',
        'Learn automation and control systems',
        'Master power system design software',
        'Get professional engineering license (EBK)',
      ],
    },
    realityCheck: {
      pros: [
        'Critical infrastructure work',
        'Good job security',
        'Can work across industries',
        'Opportunity in renewable energy boom',
      ],
      challenges: [
        'High-risk work environment (electricity)',
        'Emergency call-outs at odd hours',
        'Physically demanding site work',
        'High responsibility for safety',
      ],
      typicalDay:
        'Design electrical systems, supervise installations, troubleshoot power issues, ensure safety compliance, coordinate with contractors, prepare technical drawings.',
    },
  },

  {
    id: 'veterinarian',
    name: 'Veterinary Doctor',
    pathway: 'STEM',
    matchRequirements: {
      primarySubjects: ['integrated_science', 'agriculture'],
      minimumLevels: { integrated_science: 4, agriculture: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext:
        'Livestock is huge in Kenya. Private clinics, government, NGOs, pharmaceutical companies. Can specialize in pets (urban) or livestock (rural). Growing pet ownership in cities.',
    },
    cbeReadiness: {
      coreCompetencies: ['Empathy', 'Problem Solving', 'Manual Dexterity', 'Communication'],
      recommendedSeniorPath: 'STEM - Biological Sciences',
      universities: ['UoN', 'Egerton University'],
      tvetOptions: [],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 5,
      growthOutlook: 'growing',
      growthPercentage: 80,
      timeline: {
        shortTerm: 'Increasing pet ownership and livestock investments.',
        midTerm: 'AI helps diagnosis, but treatment stays hands-on.',
        longTerm: 'Animal handling and surgery remain human-dependent.',
      },
      survivalStrategy: [
        'Specialize (small animals, large animals, exotic)',
        'Build strong client relationships',
        'Stay updated on veterinary medicine advances',
        'Consider pharmaceutical or research roles',
      ],
    },
    realityCheck: {
      pros: [
        'Work with animals (if you love them!)',
        'Can own profitable clinic',
        'Variety - pets, livestock, wildlife',
        'Respected profession',
      ],
      challenges: [
        'Emotional toll (euthanasia, sick animals)',
        'Physically demanding (restraining animals)',
        'Irregular hours (emergencies)',
        'Dealing with difficult pet owners',
      ],
      typicalDay:
        'Examine animals, diagnose conditions, perform surgeries, prescribe medications, advise owners, conduct vaccinations, manage clinic operations.',
    },
  },

  // ============================================
  // ARTS & SPORTS PATHWAY (8 careers)
  // ============================================
  {
    id: 'creative_director',
    name: 'Creative Director / Brand Strategist',
    pathway: 'Arts & Sports',
    matchRequirements: {
      primarySubjects: ['creative_arts', 'english'],
      minimumLevels: { creative_arts: 3, english: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext:
        'Every brand needs creative strategy. Advertising agencies, corporates, startups. Can freelance or start own agency. Nairobi creative scene growing fast.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Communication', 'Cultural Awareness', 'Critical Thinking'],
      recommendedSeniorPath: 'Arts & Sports - Visual & Performing Arts',
      universities: ['Kenyatta University', 'USIU', 'Daystar', 'Multimedia University'],
      tvetOptions: ['Nairobi Institute of Business Studies (NIBS)', 'Kenya Institute of Mass Communication'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 35,
      growthOutlook: 'growing',
      growthPercentage: 85,
      timeline: {
        shortTerm: 'AI generates images/copy, but strategy requires human insight.',
        midTerm: 'Creatives who embrace AI tools will dominate.',
        longTerm: 'Cultural nuance and emotional storytelling stay human.',
      },
      survivalStrategy: [
        'Master AI creative tools (Midjourney, ChatGPT, Runway)',
        'Focus on strategy and concept over execution',
        'Build personal brand and thought leadership',
        'Develop business acumen - creativity + commerce',
      ],
    },
    realityCheck: {
      pros: [
        'Exciting, dynamic work environment',
        'See your ideas become campaigns',
        'Can build successful agency',
        'Work with diverse brands and industries',
      ],
      challenges: [
        'Tight deadlines and client pressure',
        'Subjective work - dealing with criticism',
        'Competitive field - need strong portfolio',
        'Irregular income if freelancing',
      ],
      typicalDay:
        'Brainstorm campaigns, present concepts to clients, manage design team, review creative work, track industry trends, pitch for new business.',
    },
  },

  {
    id: 'journalist',
    name: 'Journalist / Content Creator',
    pathway: 'Arts & Sports',
    matchRequirements: {
      primarySubjects: ['english', 'kiswahili'],
      minimumLevels: { english: 3, kiswahili: 3 },
    },
    marketReality: {
      earningPotential: 'moderate',
      jobSecurity: 'moderate',
      demandLevel: 'moderate',
      kenyanContext:
        'Traditional media struggling, but digital content booming. YouTube, podcasts, blogs, social media. Can work for media houses or be independent content creator.',
    },
    cbeReadiness: {
      coreCompetencies: ['Communication', 'Critical Thinking', 'Digital Literacy', 'Ethical Awareness'],
      recommendedSeniorPath: 'Arts & Sports - Languages & Communication',
      universities: ['Daystar', 'USIU', 'Multimedia University', 'Maseno University'],
      tvetOptions: ['Kenya Institute of Mass Communication (KIMC)', 'Nairobi Aviation College'],
    },
    aiImpact: {
      disruptionRisk: 'high',
      disruptionPercentage: 55,
      growthOutlook: 'stable',
      growthPercentage: 30,
      timeline: {
        shortTerm: 'AI writes basic news, but investigation and storytelling need humans.',
        midTerm: 'Shift to multimedia (video, podcasts, social media).',
        longTerm: 'Trust and authentic voices matter - human connection wins.',
      },
      survivalStrategy: [
        'Build personal brand - become the story',
        'Master video and multimedia production',
        'Develop investigative and data journalism skills',
        'Create niche expertise (politics, tech, sports, etc.)',
      ],
    },
    realityCheck: {
      pros: [
        'Tell important stories, impact society',
        'Meet interesting people',
        'Variety - no two days the same',
        'Can build large following as influencer',
      ],
      challenges: [
        'Lower pay in traditional media',
        'Irregular hours, working weekends',
        'Stressful deadlines',
        'Online harassment and trolling',
      ],
      typicalDay:
        'Research stories, conduct interviews, write articles/scripts, edit content, manage social media, attend press conferences, pitch story ideas.',
    },
  },

  {
    id: 'musician',
    name: 'Professional Musician / Music Producer',
    pathway: 'Arts & Sports',
    matchRequirements: {
      primarySubjects: ['creative_arts', 'music'],
      minimumLevels: { creative_arts: 3, music: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'low',
      demandLevel: 'moderate',
      kenyanContext:
        'Kenyan music industry growing (Gengetone, Afrobeats). Multiple income streams: performances, streaming, production, teaching. Highly competitive but rewarding for talented.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Discipline', 'Collaboration', 'Entrepreneurship'],
      recommendedSeniorPath: 'Arts & Sports - Performing Arts',
      universities: ['Kenyatta University - Music', 'Daystar - Music Production'],
      tvetOptions: ['Sauti Academy', 'Bomas of Kenya Music School'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 40,
      growthOutlook: 'growing',
      growthPercentage: 75,
      timeline: {
        shortTerm: 'AI generates beats and melodies, but hits need human creativity.',
        midTerm: 'Musicians who use AI production tools will have advantage.',
        longTerm: 'Live performances and authentic artistry irreplaceable.',
      },
      survivalStrategy: [
        'Learn music production AND performance',
        'Build strong social media presence',
        'Diversify income (teaching, licensing, production)',
        'Master digital distribution and marketing',
      ],
    },
    realityCheck: {
      pros: [
        'Do what you love (if passionate about music)',
        'Creative freedom',
        'Potential for fame and high earnings',
        'Multiple income streams',
      ],
      challenges: [
        "Very competitive, many don't make it",
        'Unstable income, especially starting out',
        'Requires thick skin (criticism, rejection)',
        'Need business skills to succeed',
      ],
      typicalDay:
        'Practice instrument/vocals, write songs, record in studio, promote on social media, network with industry, perform at gigs, negotiate deals.',
    },
  },

  {
    id: 'athlete',
    name: 'Professional Athlete / Sports Coach',
    pathway: 'Arts & Sports',
    matchRequirements: {
      primarySubjects: ['physical_education', 'health_education'],
      minimumLevels: { physical_education: 4, health_education: 3 },
    },
    marketReality: {
      earningPotential: 'exceptional',
      jobSecurity: 'low',
      demandLevel: 'moderate',
      kenyanContext:
        'Kenya dominates distance running. Football, rugby, basketball growing. Short career, so need transition plan. Coaching and sports management are stable alternatives.',
    },
    cbeReadiness: {
      coreCompetencies: ['Discipline', 'Resilience', 'Teamwork', 'Goal Setting'],
      recommendedSeniorPath: 'Arts & Sports - Physical Education',
      universities: ['Kenyatta University - Sports Science', 'Moi University', 'Egerton'],
      tvetOptions: ['Kenya Academy of Sports', 'Coast Institute of Technology'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 5,
      growthOutlook: 'stable',
      growthPercentage: 40,
      timeline: {
        shortTerm: 'AI helps training optimization, but performance is human.',
        midTerm: 'Sports science and data analysis grow.',
        longTerm: 'Human athleticism and competition irreplaceable.',
      },
      survivalStrategy: [
        'Get sports science education alongside training',
        'Plan for life after playing (coaching, management)',
        'Build personal brand during peak years',
        'Invest earnings wisely',
      ],
    },
    realityCheck: {
      pros: [
        'Represent Kenya globally',
        'Top athletes earn very well',
        'Do what you love (if passionate)',
        'Build lasting fame',
      ],
      challenges: [
        'Extremely competitive',
        'Injury can end career suddenly',
        'Short career span (usually 10-15 years)',
        'Need discipline and sacrifice',
      ],
      typicalDay:
        'Intense training sessions, diet management, physiotherapy, strategy meetings with coaches, competitions, recovery and rest, sponsor obligations.',
    },
  },

  {
    id: 'interior_designer',
    name: 'Interior Designer / Space Planner',
    pathway: 'Arts & Sports',
    matchRequirements: {
      primarySubjects: ['creative_arts', 'mathematics'],
      minimumLevels: { creative_arts: 3, mathematics: 2 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext:
        'Real estate boom drives demand. Homes, offices, hotels, restaurants all need designers. Can start own firm. Growing middle class wants nice interiors.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Spatial Intelligence', 'Attention to Detail', 'Client Management'],
      recommendedSeniorPath: 'Arts & Sports - Visual Arts & Design',
      universities: ['UoN - Architecture Interior option', 'Daystar', 'USIU'],
      tvetOptions: ['Kenya Institute of Interior Design', 'Nairobi Technical Training Institute'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 35,
      growthOutlook: 'growing',
      growthPercentage: 70,
      timeline: {
        shortTerm: "AI generates mood boards, but client taste is personal.",
        midTerm: 'Designers who use AI visualization tools win more clients.',
        longTerm: 'Understanding client psychology and space functionality stay human.',
      },
      survivalStrategy: [
        'Master 3D visualization software',
        'Build strong portfolio and social media',
        'Develop excellent client communication',
        'Specialize (luxury, sustainable, minimalist, etc.)',
      ],
    },
    realityCheck: {
      pros: [
        'Creative and practical work',
        'See transformations you create',
        'Can build profitable business',
        'Work with variety of clients',
      ],
      challenges: [
        'Dealing with demanding clients',
        'Managing budgets and contractors',
        'Competitive market',
        'Need business skills to succeed',
      ],
      typicalDay:
        'Meet clients, create design concepts, source furniture/materials, coordinate with contractors, visit sites, manage projects, maintain supplier relationships.',
    },
  },

  {
    id: 'film_director',
    name: 'Film Director / Video Producer',
    pathway: 'Arts & Sports',
    matchRequirements: {
      primarySubjects: ['creative_arts', 'english'],
      minimumLevels: { creative_arts: 3, english: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext:
        'Kenyan film/TV industry growing (Riverwood). Corporate videos, ads, YouTube content booming. Netflix, Showmax commissioning local content. Can freelance or start production company.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Leadership', 'Storytelling', 'Technical Skills'],
      recommendedSeniorPath: 'Arts & Sports - Film & Media Production',
      universities: ['USIU', 'Daystar', 'Multimedia University', 'Kenyatta'],
      tvetOptions: ['Kenya Institute of Mass Communication', 'Film School Kenya'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 30,
      growthOutlook: 'booming',
      growthPercentage: 120,
      timeline: {
        shortTerm: 'Content demand exploding (streaming, social media).',
        midTerm: 'AI assists editing and effects, but storytelling stays human.',
        longTerm: 'Direction, performance, and cultural narratives remain human.',
      },
      survivalStrategy: [
        'Master AI editing and effects tools',
        'Develop strong storytelling skills',
        'Build production and business skills',
        'Create unique voice/style',
      ],
    },
    realityCheck: {
      pros: [
        'Creative fulfillment',
        'Tell Kenyan stories to world',
        'Growing industry opportunities',
        'Can become famous/influential',
      ],
      challenges: [
        'Project-based income (feast or famine)',
        'Long, irregular hours',
        'High equipment costs initially',
        'Competitive field',
      ],
      typicalDay:
        'Develop scripts, plan shoots, direct actors/crew, edit footage, pitch projects, manage budgets, coordinate with clients, market your work.',
    },
  },

  {
    id: 'graphic_designer',
    name: 'Graphic Designer / Visual Communicator',
    pathway: 'Arts & Sports',
    matchRequirements: {
      primarySubjects: ['creative_arts', 'english'],
      minimumLevels: { creative_arts: 3, english: 2 },
    },
    marketReality: {
      earningPotential: 'moderate',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext:
        'Every business needs design. Agencies, corporates, NGOs, startups. Easy to freelance globally. Nairobi has vibrant design scene. Can work remotely for international clients.',
    },
    cbeReadiness: {
      coreCompetencies: ['Creativity', 'Digital Literacy', 'Visual Communication', 'Attention to Detail'],
      recommendedSeniorPath: 'Arts & Sports - Visual Arts',
      universities: ['UoN', 'Kenyatta', 'USIU', 'Daystar'],
      tvetOptions: ['NIBS', 'Nairobi Institute of Technology', 'Kenya School of Professional Studies'],
    },
    aiImpact: {
      disruptionRisk: 'high',
      disruptionPercentage: 60,
      growthOutlook: 'stable',
      growthPercentage: 45,
      timeline: {
        shortTerm: 'AI generates basic designs, threatening junior designers.',
        midTerm: 'Designers who use AI as tool will dominate.',
        longTerm: 'Strategic design thinking and brand expertise stay valuable.',
      },
      survivalStrategy: [
        'Master AI tools (Midjourney, Adobe Firefly, etc.)',
        'Move from execution to strategy (senior roles)',
        'Specialize (motion graphics, UX/UI, branding)',
        'Build strong portfolio and personal brand',
      ],
    },
    realityCheck: {
      pros: [
        'Creative work daily',
        'Can work remotely/freelance',
        'Diverse projects',
        'Relatively easy to start (laptop + skills)',
      ],
      challenges: [
        'Competitive and saturated market',
        'Client revisions can be frustrating',
        'Pressure to constantly learn new tools',
        'Lower pay for junior designers',
      ],
      typicalDay:
        'Create designs (logos, posters, social media, packaging), revise based on feedback, communicate with clients, research trends, manage multiple projects.',
    },
  },

  {
    id: 'event_planner',
    name: 'Event Planner / Hospitality Manager',
    pathway: 'Arts & Sports',
    matchRequirements: {
      primarySubjects: ['business_studies', 'creative_arts'],
      minimumLevels: { business_studies: 3, creative_arts: 2 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'moderate',
      demandLevel: 'high',
      kenyanContext:
        'Kenyans love events (weddings, corporate, conferences). Growing middle class spending on celebrations. Tourism and hospitality recovering. Can start own events company.',
    },
    cbeReadiness: {
      coreCompetencies: ['Organization', 'Communication', 'Creativity', 'Problem Solving'],
      recommendedSeniorPath: 'Arts & Sports - Hospitality',
      universities: ['Kenyatta - Hospitality', 'USIU', 'Moi University', 'Multimedia'],
      tvetOptions: ['Kenya Utalii College', 'Nairobi Aviation College'],
    },
    aiImpact: {
      disruptionRisk: 'low',
      disruptionPercentage: 20,
      growthOutlook: 'growing',
      growthPercentage: 80,
      timeline: {
        shortTerm: 'Events are social and human-centered.',
        midTerm: 'AI helps logistics, but client relationship is key.',
        longTerm: 'Personal touch and crisis management stay human.',
      },
      survivalStrategy: [
        'Use tech for efficiency (booking systems, design tools)',
        'Build strong vendor network',
        'Develop niche (corporate, weddings, international)',
        'Excellent client service and reputation',
      ],
    },
    realityCheck: {
      pros: [
        'Exciting, social work',
        'See immediate results',
        'Can build profitable business',
        'Meet diverse people',
      ],
      challenges: [
        'High stress (everything must be perfect)',
        'Long hours, including weekends/nights',
        'Dealing with difficult clients',
        'Seasonal income fluctuations',
      ],
      typicalDay:
        'Meet clients, plan event details, coordinate vendors, visit venues, manage budgets, solve problems, oversee event execution, handle crises.',
    },
  },

  // ============================================
  // SOCIAL SCIENCES PATHWAY (7 careers)
  // ============================================
  {
    id: 'lawyer',
    name: 'Lawyer / Legal Advocate',
    pathway: 'Social Sciences',
    matchRequirements: {
      primarySubjects: ['english', 'social_studies'],
      minimumLevels: { english: 4, social_studies: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext:
        'Always in demand. Can work in law firms, corporate, government, or private practice. Competitive but lucrative. Long education but respected profession.',
    },
    cbeReadiness: {
      coreCompetencies: ['Critical Thinking', 'Communication', 'Ethical Decision Making', 'Research Skills'],
      recommendedSeniorPath: 'Social Sciences - Law & Governance',
      universities: ['UoN', 'Moi University', 'Kenyatta', 'USIU', 'Strathmore'],
      tvetOptions: [],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 40,
      growthOutlook: 'stable',
      growthPercentage: 35,
      timeline: {
        shortTerm: 'AI assists research and document drafting.',
        midTerm: 'Routine contracts automated, complex litigation stays human.',
        longTerm: 'Advocacy, negotiation, and client relationships irreplaceable.',
      },
      survivalStrategy: [
        'Specialize (corporate, human rights, IP, etc.)',
        'Embrace legal tech tools',
        'Develop strong courtroom and negotiation skills',
        'Build reputation and client base',
      ],
    },
    realityCheck: {
      pros: [
        'Intellectual and challenging work',
        'High earning potential',
        'Respected profession',
        'Can fight for justice',
      ],
      challenges: [
        'Very long education (6+ years)',
        'Highly competitive',
        'Long hours, high stress',
        'Dealing with difficult/emotional cases',
      ],
      typicalDay:
        'Client consultations, legal research, draft documents, court appearances, negotiations, case strategy, manage paralegals, continuing legal education.',
    },
  },

  {
    id: 'accountant_cpa',
    name: 'Accountant (CPA) / Financial Analyst',
    pathway: 'Social Sciences',
    matchRequirements: {
      primarySubjects: ['mathematics', 'business_studies'],
      minimumLevels: { mathematics: 3, business_studies: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'very_high',
      kenyanContext:
        'Every organization needs accountants. Big 4 firms, banks, corporates, government, SMEs. CPA qualification is gold standard. Stable career with clear progression.',
    },
    cbeReadiness: {
      coreCompetencies: ['Analytical Thinking', 'Attention to Detail', 'Ethical Decision Making', 'Problem Solving'],
      recommendedSeniorPath: 'Social Sciences - Commerce & Finance',
      universities: ['Strathmore', 'KCA University', 'USIU', 'UoN', 'Kenyatta'],
      tvetOptions: ['Kenya School of Accountancy', 'Nairobi Institute of Business Studies'],
    },
    aiImpact: {
      disruptionRisk: 'high',
      disruptionPercentage: 65,
      growthOutlook: 'stable',
      growthPercentage: 20,
      timeline: {
        shortTerm: 'Bookkeeping and basic tasks automated.',
        midTerm: 'Tax and compliance increasingly automated.',
        longTerm: 'Strategic advisory, forensics, and complex analysis stay human.',
      },
      survivalStrategy: [
        'Specialize in high-value areas (forensic, strategic CFO work)',
        'Master financial analysis, not just compliance',
        'Develop business advisory skills',
        'Learn data analytics and financial modeling',
      ],
    },
    realityCheck: {
      pros: [
        'Clear career path and qualifications',
        'Good job security',
        'Work across any industry',
        'Respected profession',
      ],
      challenges: [
        'Studying for CPA while working is tough',
        'Can be repetitive work',
        'Busy seasons (audit, tax deadlines)',
        'AI disrupting traditional roles',
      ],
      typicalDay:
        'Prepare financial statements, analyze data, conduct audits, advise management, ensure compliance, manage budgets, prepare reports.',
    },
  },

  {
    id: 'teacher',
    name: 'Teacher / Education Specialist',
    pathway: 'Social Sciences',
    matchRequirements: {
      primarySubjects: ['english', 'kiswahili'],
      minimumLevels: { english: 3, kiswahili: 3 },
    },
    marketReality: {
      earningPotential: 'lower_but_stable',
      jobSecurity: 'very_high',
      demandLevel: 'very_high',
      kenyanContext:
        'CBC rollout creates demand. Government (TSC) guaranteed employment. Private schools pay better. Can become principal/education officer. Very secure but lower pay than other professions.',
    },
    cbeReadiness: {
      coreCompetencies: ['Communication', 'Empathy', 'Patience', 'Leadership'],
      recommendedSeniorPath: 'Social Sciences - Education',
      universities: ['Kenyatta University', 'Moi University', 'Egerton', 'Maseno', 'KU'],
      tvetOptions: ['Teacher Training Colleges (TTCs) nationwide'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 5,
      growthOutlook: 'stable',
      growthPercentage: 40,
      timeline: {
        shortTerm: 'CBC creates need for more trained teachers.',
        midTerm: 'AI becomes teaching assistant, not replacement.',
        longTerm: 'Human mentorship, empathy, and discipline stay critical.',
      },
      survivalStrategy: [
        'Embrace educational technology',
        'Specialize (special needs, gifted students, CBC training)',
        'Develop curriculum design skills',
        'Pursue school leadership roles',
      ],
    },
    realityCheck: {
      pros: [
        'Very stable employment (TSC)',
        'Holidays aligned with school calendar',
        'Shape young minds',
        'Respected in community',
      ],
      challenges: [
        'Lower pay compared to other professions',
        'Large class sizes in public schools',
        'Dealing with difficult students/parents',
        'Heavy workload (marking, planning)',
      ],
      typicalDay:
        'Prepare lessons, teach classes, mark assignments, manage classroom discipline, parent meetings, staff meetings, extracurricular activities.',
    },
  },

  {
    id: 'social_worker',
    name: 'Social Worker / Community Development Officer',
    pathway: 'Social Sciences',
    matchRequirements: {
      primarySubjects: ['social_studies', 'english'],
      minimumLevels: { social_studies: 3, english: 3 },
    },
    marketReality: {
      earningPotential: 'moderate',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext:
        "NGOs, government, hospitals, children's homes all need social workers. Meaningful work but moderate pay. Growing field as Kenya addresses social issues.",
    },
    cbeReadiness: {
      coreCompetencies: ['Empathy', 'Communication', 'Problem Solving', 'Cultural Awareness'],
      recommendedSeniorPath: 'Social Sciences - Social Work & Community Development',
      universities: ['UoN', 'Kenyatta', 'Moi University', 'Catholic University'],
      tvetOptions: ['Kenya Institute of Social Work'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 5,
      growthOutlook: 'growing',
      growthPercentage: 70,
      timeline: {
        shortTerm: 'Social challenges create demand for social workers.',
        midTerm: 'AI helps data/case management, but fieldwork stays human.',
        longTerm: 'Empathy, counseling, and community work irreplaceable.',
      },
      survivalStrategy: [
        'Specialize (child protection, mental health, community development)',
        'Develop counseling and conflict resolution skills',
        'Learn program design and grant writing',
        'Build strong community relationships',
      ],
    },
    realityCheck: {
      pros: [
        'Meaningful work helping vulnerable',
        'Variety of settings (hospitals, NGOs, government)',
        'Strong job security',
        'Personal fulfillment',
      ],
      challenges: [
        'Emotionally draining work',
        'Moderate pay in NGO sector',
        'Dealing with difficult cases',
        'Bureaucracy in government roles',
      ],
      typicalDay:
        'Meet clients, assess needs, connect to resources, write case reports, conduct home visits, coordinate with agencies, advocate for clients.',
    },
  },

  {
    id: 'human_resources',
    name: 'Human Resources Manager',
    pathway: 'Social Sciences',
    matchRequirements: {
      primarySubjects: ['business_studies', 'english'],
      minimumLevels: { business_studies: 3, english: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext:
        'Every company needs HR. From recruitment to employee relations. Can work corporate, consulting, or government. Clear career progression to senior management.',
    },
    cbeReadiness: {
      coreCompetencies: ['Communication', 'Conflict Resolution', 'Empathy', 'Organization'],
      recommendedSeniorPath: 'Social Sciences - Business & Management',
      universities: ['Strathmore', 'USIU', 'KCA', 'Kenyatta', 'UoN'],
      tvetOptions: ['Kenya Institute of Management', 'Nairobi Institute of Business Studies'],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 45,
      growthOutlook: 'stable',
      growthPercentage: 40,
      timeline: {
        shortTerm: 'Recruitment tools automate screening.',
        midTerm: 'Payroll and admin increasingly automated.',
        longTerm: 'Employee relations, culture, and leadership development stay human.',
      },
      survivalStrategy: [
        'Focus on strategic HR, not admin tasks',
        'Develop talent development and coaching skills',
        'Learn HR analytics and people data',
        'Master change management and org development',
      ],
    },
    realityCheck: {
      pros: [
        'Work with people daily',
        'Strategic role in organization',
        'Good work-life balance',
        'Clear career progression',
      ],
      challenges: [
        'Caught between management and employees',
        'Dealing with conflicts and difficult people',
        'Sometimes blamed for unpopular decisions',
        'Administrative burden in small companies',
      ],
      typicalDay:
        'Recruitment interviews, employee relations issues, policy development, training coordination, performance management, payroll oversight, strategic planning.',
    },
  },

  {
    id: 'psychologist',
    name: 'Psychologist / Counselor',
    pathway: 'Social Sciences',
    matchRequirements: {
      primarySubjects: ['social_studies', 'english'],
      minimumLevels: { social_studies: 3, english: 3 },
    },
    marketReality: {
      earningPotential: 'lucrative',
      jobSecurity: 'high',
      demandLevel: 'high',
      kenyanContext:
        "Mental health awareness growing. Schools, hospitals, corporates, private practice all need psychologists. Still stigma but changing. Growing field with good prospects.",
    },
    cbeReadiness: {
      coreCompetencies: ['Empathy', 'Communication', 'Critical Thinking', 'Ethical Awareness'],
      recommendedSeniorPath: 'Social Sciences - Psychology & Counseling',
      universities: ['UoN', 'Kenyatta', 'USIU', 'Daystar', 'Catholic University'],
      tvetOptions: ['Counseling training institutes'],
    },
    aiImpact: {
      disruptionRisk: 'very_low',
      disruptionPercentage: 10,
      growthOutlook: 'booming',
      growthPercentage: 140,
      timeline: {
        shortTerm: 'Mental health crisis increases demand.',
        midTerm: 'AI chatbots for basic support, but therapy stays human.',
        longTerm: 'Human connection and empathy irreplaceable in healing.',
      },
      survivalStrategy: [
        'Get proper licensure and credentials',
        'Specialize (clinical, educational, organizational)',
        'Build strong therapeutic skills',
        'Combine traditional and modern approaches',
      ],
    },
    realityCheck: {
      pros: [
        'Help people through difficult times',
        'Intellectually stimulating',
        'Can have private practice',
        'Growing field in Kenya',
      ],
      challenges: [
        'Emotionally demanding work',
        'Dealing with severe mental health issues',
        "Carrying clients' burdens",
        'Need own therapy/supervision',
      ],
      typicalDay:
        'Client sessions, assessment and diagnosis, develop treatment plans, take notes, coordinate with other professionals, continuing education.',
    },
  },

  {
    id: 'economist',
    name: 'Economist / Policy Analyst',
    pathway: 'Social Sciences',
    matchRequirements: {
      primarySubjects: ['mathematics', 'business_studies'],
      minimumLevels: { mathematics: 4, business_studies: 3 },
    },
    marketReality: {
      earningPotential: 'very_lucrative',
      jobSecurity: 'high',
      demandLevel: 'moderate',
      kenyanContext:
        'Government, Central Bank, research institutions, international organizations (World Bank, IMF). Highly intellectual work. Good pay and influence on policy.',
    },
    cbeReadiness: {
      coreCompetencies: ['Analytical Thinking', 'Critical Thinking', 'Research Skills', 'Communication'],
      recommendedSeniorPath: 'Social Sciences - Economics & Statistics',
      universities: ['UoN', 'Kenyatta', 'Strathmore', 'USIU', 'Egerton'],
      tvetOptions: [],
    },
    aiImpact: {
      disruptionRisk: 'moderate',
      disruptionPercentage: 35,
      growthOutlook: 'stable',
      growthPercentage: 45,
      timeline: {
        shortTerm: 'AI assists data analysis and forecasting.',
        midTerm: 'Routine modeling automated.',
        longTerm: 'Policy interpretation, context, and recommendations stay human.',
      },
      survivalStrategy: [
        'Master econometrics and data science',
        'Develop strong communication skills',
        'Specialize (development, monetary policy, trade)',
        'Combine quantitative skills with policy understanding',
      ],
    },
    realityCheck: {
      pros: [
        'Influence national policy',
        'Intellectually challenging',
        'Respected profession',
        'Good work environment',
      ],
      challenges: [
        'Requires advanced degrees (Masters/PhD)',
        'Can be abstract/theoretical',
        'Frustration when policy ignored',
        'Competitive for top positions',
      ],
      typicalDay:
        'Economic research, data analysis, forecast modeling, write policy briefs, present findings, advise government/organizations, publish papers.',
    },
  },
]

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Returns careers matching the given pathway where the student meets
 * all minimum competency levels. Sorted by best match first.
 */
export function getMatchingCareers(
  pathway: string,
  scores: Record<string, number>
): CareerData[] {
  if (!CAREER_DATABASE || CAREER_DATABASE.length === 0) return []

  return CAREER_DATABASE
    .filter((career) => {
      if (career.pathway !== pathway) return false
      return Object.entries(career.matchRequirements.minimumLevels).every(
        ([subject, minLevel]) => (scores[subject] ?? 0) >= minLevel
      )
    })
    .sort((a, b) => {
      const getSurplus = (career: CareerData) =>
        Object.entries(career.matchRequirements.minimumLevels).reduce(
          (sum, [subject, minLevel]) => sum + ((scores[subject] ?? 0) - minLevel),
          0
        )
      return getSurplus(b) - getSurplus(a)
    })
    .slice(0, 5)
}

/**
 * Search for a career by name (fuzzy match)
 * ✅ FIXED: Single definition, no duplicates
 */
export function findCareerByName(careerName: string): CareerData | null {
  const normalized = careerName.toLowerCase().trim()

  // 1. Exact match
  const exactMatch = CAREER_DATABASE.find(
    (career) => career.name.toLowerCase() === normalized
  )
  if (exactMatch) return exactMatch

  // 2. Partial match (career name contains query or vice versa)
  const partialMatch = CAREER_DATABASE.find(
    (career) =>
      career.name.toLowerCase().includes(normalized) ||
      normalized.includes(career.name.toLowerCase())
  )
  if (partialMatch) return partialMatch

  // 3. ID match
  const idMatch = CAREER_DATABASE.find(
    (career) => career.id === normalized.replace(/\s+/g, '_')
  )
  if (idMatch) return idMatch

  return null
}

/**
 * Get all career names (for autocomplete)
 * ✅ FIXED: Single definition, no duplicates
 */
export function getAllCareerNames(): string[] {
  return CAREER_DATABASE.map((career) => career.name)
}

/**
 * Get all careers for a specific pathway
 */
export function getCareersByPathway(pathway: string): CareerData[] {
  return CAREER_DATABASE.filter((career) => career.pathway === pathway)
}

/**
 * Search careers by keyword (returns multiple matches)
 */
export function searchCareers(keyword: string): CareerData[] {
  const normalized = keyword.toLowerCase().trim()
  return CAREER_DATABASE.filter(
    (career) =>
      career.name.toLowerCase().includes(normalized) ||
      career.id.includes(normalized) ||
      career.marketReality.kenyanContext.toLowerCase().includes(normalized)
  )
}