// lib/career/seedCareers.ts
// Run with: npx ts-node -e "import('./seedCareers').then(m => m.seedCareers())"
// Or call seedCareers() from an admin route.

import { createServiceClient } from '@/utils/supabase/service'
import type { Career } from './types'

type SeedCareer = Omit<Career, 'id' | 'created_at' | 'updated_at'>

export const SEED_CAREERS: SeedCareer[] = [
  // ──────────────────────────────────────────────────────────
  // 1. SOFTWARE ENGINEER
  // ──────────────────────────────────────────────────────────
  {
    slug: 'software-engineer',
    title: 'Software Engineer',
    category: 'technology',
    description:
      'Software engineers design, build, and maintain the digital systems that power everything from mobile money to hospital records. In Kenya, this is one of the fastest-growing professions — but the role is changing rapidly with AI.',
    ai_impact:
      'AI writes basic code faster than humans. Routine coding tasks (CRUD apps, simple scripts, boilerplate) are being automated. What AI cannot replace: system architecture, understanding business problems, debugging complex distributed systems, and leading engineering teams. The engineers thriving in 2030 will use AI as a tool, not compete with it.',
    ai_impact_level: 'high',
    kenya_market_outlook:
      'Kenya is East Africa\'s tech hub. Nairobi\'s "Silicon Savannah" has 400+ startups and growing demand for engineers. M-Pesa, Safaricom, Andela, Moringa School, and hundreds of fintechs are hiring. Remote work opens global salaries. Entry is competitive but Kenya-trained engineers are now respected globally.',
    salary_range_kes: { min: 80000, max: 350000, note: 'Entry to mid-level; senior engineers earn 500k–1.2M KES/month at top companies', senior_max: 1200000 },
    pathways: [
      {
        type: 'university',
        description: 'BSc Computer Science or Software Engineering',
        cost_kes: { min: 200000, max: 700000, note: 'per year at public/private universities' },
        duration_years: 4,
        institutions: ['University of Nairobi', 'Strathmore University', 'JKUAT', 'Maseno University', 'Kenyatta University'],
        entry_requirements: 'C+ in Mathematics and Physics at KCSE',
      },
      {
        type: 'self_taught',
        description: 'Online bootcamp + portfolio + open source contributions',
        cost_kes: { min: 15000, max: 80000, note: 'bootcamp fees; much of it is free (freeCodeCamp, The Odin Project)' },
        duration_years: 1,
        institutions: ['Moringa School', 'AkiraChix', 'freeCodeCamp (free)', 'ALX Africa'],
        entry_requirements: 'Determination + internet access',
      },
      {
        type: 'college',
        description: 'Diploma in ICT or Programming at a technical college',
        cost_kes: { min: 50000, max: 150000, note: 'full diploma cost' },
        duration_years: 2,
        institutions: ['Kenya Polytechnic', 'Nairobi Technical Training Institute', 'Zetech University'],
        entry_requirements: 'C- at KCSE',
      },
    ],
    required_subjects: ['mathematics', 'physics', 'english', 'computer_studies'],
    skill_timeline: [
      {
        age_range: '10–13',
        skills: ['Basic computer use', 'Scratch or block coding', 'Problem-solving games', 'Typing practice'],
        why: 'Build computational thinking before syntax. Scratch teaches logic without frustration.',
        activities: ['Scratch.mit.edu projects', 'Chess', 'Code.org courses'],
      },
      {
        age_range: '14–16',
        skills: ['Python basics', 'HTML/CSS', 'Understanding how the internet works', 'Simple web pages', 'Git basics'],
        why: 'Real programming begins here. Python is the fastest path from beginner to useful programs.',
        activities: ['Build a personal website', 'Automate a boring task in Python', 'CS50 on edX (free)'],
      },
      {
        age_range: '17–19',
        skills: ['JavaScript and React', 'Databases (SQL basics)', 'APIs', 'Version control (Git/GitHub)', 'One complete personal project'],
        why: 'Portfolio-building phase. Universities and employers want to see you can build real things.',
        activities: ['Build a school project tracker app', 'Contribute to an open-source project', 'Enter a hackathon'],
      },
      {
        age_range: '20–24',
        skills: ['System design', 'Cloud platforms (AWS/GCP)', 'Testing and CI/CD', 'Collaboration tools', 'AI-assisted development'],
        why: 'Career entry. Companies want engineers who can work in teams and ship production code.',
        activities: ['Internship at a Nairobi startup', 'Build a SaaS product', 'Get AWS Cloud Practitioner cert'],
      },
    ],
    future_skills: [
      'AI prompt engineering for developers',
      'System architecture and design',
      'Product thinking (understanding user needs)',
      'Data engineering and pipelines',
      'Cybersecurity fundamentals',
    ],
    obsolete_skills: [
      'Writing boilerplate CRUD code by hand',
      'Basic data entry automation scripts',
      'Manual testing of simple UI flows',
    ],
    kenya_examples: [
      { name: 'Juliana Rotich', what_they_did: 'Co-founded Ushahidi, a global crisis-mapping platform used worldwide', started_from: 'University of Nairobi CS degree' },
      { name: 'Andela graduates', what_they_did: 'Thousands of Kenyan engineers placed at global companies like Google, GitHub, and Spotify', started_from: 'Self-taught or bootcamp backgrounds' },
      { name: 'Cellulant engineers', what_they_did: 'Built Africa\'s largest fintech payment infrastructure serving 35 countries', started_from: 'Kenyan universities and polytechnics' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 2. MEDICAL DOCTOR
  // ──────────────────────────────────────────────────────────
  {
    slug: 'medical-doctor',
    title: 'Medical Doctor',
    category: 'health',
    description:
      'Doctors diagnose illness, treat patients, and protect public health. In Kenya, a doctor is still one of the most respected and needed professions — with severe shortages outside Nairobi. The doctor of 2030 will work alongside AI diagnostic tools, not against them.',
    ai_impact:
      'AI is excellent at reading X-rays, detecting patterns in lab results, and flagging drug interactions. But a doctor\'s core work — listening to a patient, making judgment calls in a rural clinic with limited equipment, comforting a family, making ethical decisions — cannot be automated. AI will make doctors more accurate, not unemployed.',
    ai_impact_level: 'medium',
    kenya_market_outlook:
      'Kenya has 0.2 doctors per 1,000 people (WHO recommends 1 per 1,000). Massive shortage, especially in counties. Government is actively recruiting, and the Kenya Medical Association reports high demand. Private practice in Nairobi, Mombasa, and Kisumu is lucrative. Specialization (surgery, oncology, psychiatry) commands premium pay.',
    salary_range_kes: { min: 150000, max: 500000, note: 'Government intern to experienced consultant; specialists can earn 800k–2M', senior_max: 2000000 },
    pathways: [
      {
        type: 'university',
        description: 'MBChB (Bachelor of Medicine and Surgery) — 6 years + 1 year internship',
        cost_kes: { min: 400000, max: 1200000, note: 'per year; government-sponsored slots available' },
        duration_years: 7,
        institutions: ['University of Nairobi', 'Moi University', 'Kenyatta University', 'Mount Kenya University', 'Kabarak University'],
        entry_requirements: 'A- in Biology, Chemistry, Physics/Mathematics at KCSE',
      },
      {
        type: 'college',
        description: 'Clinical Officer Certificate — faster path to patient care',
        cost_kes: { min: 150000, max: 400000, note: 'full course cost' },
        duration_years: 3,
        institutions: ['Kenya Medical Training College (KMTC) — 24 campuses nationwide'],
        entry_requirements: 'B- at KCSE with strong sciences',
      },
    ],
    required_subjects: ['biology', 'chemistry', 'physics', 'mathematics', 'english'],
    skill_timeline: [
      {
        age_range: '10–13',
        skills: ['Basic biology curiosity', 'Understanding the human body', 'First aid basics', 'Empathy and listening skills'],
        why: 'Foundation for science interest. The child who wants to be a doctor should love how living things work.',
        activities: ['Red Cross Junior First Aid course', 'Biology science fair projects', 'Visit a community health worker'],
      },
      {
        age_range: '14–16',
        skills: ['Strong Biology and Chemistry', 'Scientific method and lab skills', 'Research skills', 'Community health awareness'],
        why: 'The KCSE grades that unlock medicine are decided here. Biology and Chemistry must be priorities.',
        activities: ['Join science clubs', 'Volunteer at local clinic', 'Read medical journals (simplified versions)'],
      },
      {
        age_range: '17–19',
        skills: ['Advanced Biology and Chemistry', 'KCSE preparation for medical entry', 'Basic anatomy self-study', 'Communication and patient interaction skills'],
        why: 'Final academic push. Entry to medicine requires top KCSE grades.',
        activities: ['Shadow a doctor at a county hospital', 'Apply for KMTC or university parallel programs', 'Learn medical terminology'],
      },
      {
        age_range: '20–24',
        skills: ['Clinical rotations', 'Diagnosis frameworks', 'Medical ethics', 'Working under pressure', 'AI diagnostic tools'],
        why: 'Medical school is intense. Clinical rotations expose you to real patients and real decisions.',
        activities: ['Excel in preclinical years', 'Mentor junior students', 'Research a local disease pattern'],
      },
    ],
    future_skills: [
      'Reading and interpreting AI diagnostic reports',
      'Telemedicine and remote patient monitoring',
      'Mental health first response (massive shortage)',
      'Public health and epidemiology',
      'Research and evidence-based medicine',
    ],
    obsolete_skills: [
      'Manual film X-ray reading (being replaced by AI)',
      'Basic prescription management (digitizing)',
    ],
    kenya_examples: [
      { name: 'Dr. Farouk Mbarki', what_they_did: 'Built Nairobi\'s largest private oncology centre, treating cancer patients who previously had to travel abroad', started_from: 'Moi University MBChB' },
      { name: 'Dr. Charity Akello', what_they_did: 'WHO public health officer leading infectious disease response across East Africa', started_from: 'KMTC Clinical Officer, then upgraded to MBChB' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 3. AGRICULTURAL SCIENTIST / AGRITECH
  // ──────────────────────────────────────────────────────────
  {
    slug: 'agricultural-scientist',
    title: 'Agricultural Scientist / Agritech',
    category: 'agriculture',
    description:
      'Agriculture feeds Kenya. Agricultural scientists and agritech entrepreneurs are solving the country\'s biggest problems: drought, low yields, food insecurity, and farmer income. This career is being transformed by data, drones, and AI — making it exciting, not outdated.',
    ai_impact:
      'AI is being used for crop disease detection (photo-based diagnosis), soil analysis, weather prediction, and supply chain optimization. Tools like Plantix and Hello Tractor are already used by Kenyan farmers. But someone needs to design these systems, train farmers, and apply local knowledge. Agricultural scientists who understand both agronomy and technology have a massive advantage.',
    ai_impact_level: 'medium',
    kenya_market_outlook:
      'Agriculture is 26% of Kenya\'s GDP. The government\'s "Big 4" agenda prioritizes food security. Agritech startups (Twiga Foods, Apollo Agriculture, FarmDrive, Tulaa) are raising millions in funding. Export markets (flowers, tea, avocado, macadamia) are growing rapidly. There is enormous unmet demand for people who understand both science and farming.',
    salary_range_kes: { min: 60000, max: 250000, note: 'Government agricultural officer to private agritech company; entrepreneurs can earn much more', senior_max: 600000 },
    pathways: [
      {
        type: 'university',
        description: 'BSc Agriculture, Agronomy, or Agricultural Economics',
        cost_kes: { min: 150000, max: 500000, note: 'per year' },
        duration_years: 4,
        institutions: ['Egerton University', 'University of Nairobi', 'JKUAT', 'Moi University'],
        entry_requirements: 'C+ in Biology, Chemistry, and Mathematics at KCSE',
      },
      {
        type: 'tvet',
        description: 'Certificate or Diploma in Agriculture',
        cost_kes: { min: 40000, max: 150000, note: 'full course' },
        duration_years: 2,
        institutions: ['Kenya Agriculture and Livestock Research Organization (KALRO)', 'Agricultural Training Centres nationwide'],
        entry_requirements: 'KCSE D+ with basic science',
      },
      {
        type: 'entrepreneurial',
        description: 'Start a farm, agritech product, or agricultural services business',
        cost_kes: { min: 20000, max: 200000, note: 'starting capital; many start on family land' },
        duration_years: 1,
        institutions: ['Kenya Youth Agribusiness Strategy', 'AGRA programs', 'Apollo Agriculture training'],
        entry_requirements: 'Willingness to get hands dirty and learn by doing',
      },
    ],
    required_subjects: ['biology', 'chemistry', 'mathematics', 'geography'],
    skill_timeline: [
      {
        age_range: '10–13',
        skills: ['Curiosity about plants and animals', 'Basic gardening', 'Understanding weather and seasons', 'Soil awareness'],
        why: 'Children who grow up farming already have a head start. Practical observation is the foundation.',
        activities: ['School garden project', 'Visit a tea or flower farm', 'Basic composting at home'],
      },
      {
        age_range: '14–16',
        skills: ['Biology (plant biology, ecology)', 'Chemistry (fertilizers, soil pH)', 'Geography (climate, land use)', 'Introduction to crop science'],
        why: 'Academic grounding for agronomy. Understanding WHY crops grow or fail requires science.',
        activities: ['Conduct soil pH experiments', 'Track weather patterns', 'Interview a local farmer about challenges'],
      },
      {
        age_range: '17–19',
        skills: ['Advanced biology and chemistry', 'Basic data analysis (Excel for farm records)', 'Drone operation basics', 'Business planning for farms'],
        why: 'Modern agriculture is a business. Students who combine science with business thinking are rare and valuable.',
        activities: ['Design a small farm business plan', 'Try a hydroponic system', 'Volunteer with KALRO or Twiga Foods'],
      },
      {
        age_range: '20–24',
        skills: ['Agronomy field research', 'GIS and satellite data for farming', 'Supply chain management', 'AI diagnostic tools for crop disease', 'Access to capital (grants, loans)'],
        why: 'Career entry. The most successful agritech entrepreneurs start solving real farmer problems early.',
        activities: ['Internship at Apollo Agriculture or Twiga Foods', 'Enter Hult Prize or GSMA Agritech competition', 'Apply for AGRA youth grant'],
      },
    ],
    future_skills: [
      'Precision agriculture and drone operation',
      'Climate-smart farming adaptation',
      'AI-powered disease and pest detection',
      'Supply chain tech (farmer-to-market platforms)',
      'Carbon farming and sustainability certification',
    ],
    obsolete_skills: [
      'Manual pest spraying without data guidance',
      'Guesswork-based fertilizer application',
    ],
    kenya_examples: [
      { name: 'Twiga Foods', what_they_did: 'Built a B2B food distribution platform connecting 17,000+ Kenyan farmers directly to urban vendors', started_from: 'Peter Njonjo and Grant Brooke started with a simple supply chain problem' },
      { name: 'Apollo Agriculture', what_they_did: 'Uses satellite data and AI to give small-scale farmers credit and agronomy advice', started_from: 'Nairobi startup, now serving 300,000+ farmers' },
      { name: 'Zipporah Wangari', what_they_did: 'Young farmer from Kirinyaga who grew her avocado farm from 2 acres to 15 using Apollo Agriculture tools', started_from: 'KCSE graduate with basic agriculture training' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 4. CIVIL ENGINEER
  // ──────────────────────────────────────────────────────────
  {
    slug: 'civil-engineer',
    title: 'Civil Engineer',
    category: 'trades',
    description:
      'Civil engineers design and build Kenya\'s infrastructure: roads, bridges, water systems, dams, and housing. Kenya\'s Vision 2030, the SGR, the expressway, and thousands of county projects are creating consistent demand. This is a stable, well-paid career with strong government and private sector employment.',
    ai_impact:
      'AI is automating structural calculations, optimizing designs, and improving safety simulations. BIM (Building Information Modelling) software is replacing manual drafting. But civil engineering requires physical site supervision, stakeholder management, government approvals, and on-the-ground problem solving that AI cannot handle. The role is evolving, not disappearing.',
    ai_impact_level: 'medium',
    kenya_market_outlook:
      'The Kenya National Highways Authority, county governments, and major contractors (China Wu Yi, NCC, Spencon) are all hiring. Infrastructure projects worth hundreds of billions are underway. The housing deficit of 2 million units means construction engineers will be needed for decades.',
    salary_range_kes: { min: 100000, max: 400000, note: 'Graduate engineer to senior project engineer; consultants and project directors earn 600k–1.5M', senior_max: 1500000 },
    pathways: [
      {
        type: 'university',
        description: 'BSc Civil Engineering',
        cost_kes: { min: 200000, max: 800000, note: 'per year; government-sponsored slots available' },
        duration_years: 5,
        institutions: ['University of Nairobi', 'JKUAT', 'Technical University of Kenya', 'Moi University'],
        entry_requirements: 'B+ in Mathematics and Physics at KCSE',
      },
      {
        type: 'tvet',
        description: 'Diploma in Civil Engineering',
        cost_kes: { min: 60000, max: 200000, note: 'full diploma' },
        duration_years: 3,
        institutions: ['Kenya Polytechnic', 'Mombasa Technical Training Institute', 'Rift Valley Technical Training Institute'],
        entry_requirements: 'C+ in Mathematics and Physics',
      },
    ],
    required_subjects: ['mathematics', 'physics', 'english', 'geography'],
    skill_timeline: [
      {
        age_range: '10–13',
        skills: ['Spatial reasoning and geometry', 'Model building (LEGO, cardboard bridges)', 'Basic physics curiosity', 'Environmental awareness'],
        why: 'Civil engineers need 3D thinking. Building models as a child is genuine preparation.',
        activities: ['Build a model bridge that can hold weight', 'Watch construction sites with curiosity', 'Geometry and measurement projects'],
      },
      {
        age_range: '14–16',
        skills: ['Strong Mathematics (especially geometry and calculus prep)', 'Physics (forces, structures, materials)', 'Technical drawing basics', 'Computer-aided design intro (TinkerCAD)'],
        why: 'The calculation work of engineering starts with strong school maths. Grades here determine university entry.',
        activities: ['Technical drawing class', 'Science fair: structural engineering', 'Visit the Nairobi Expressway or SGR'],
      },
      {
        age_range: '17–19',
        skills: ['A-level Mathematics and Physics', 'AutoCAD basics', 'Basic surveying concepts', 'Reading engineering drawings'],
        why: 'University entry requires top maths/physics. AutoCAD self-study puts you ahead on day one.',
        activities: ['AutoCAD free trial projects', 'Talk to a site engineer at a construction project', 'Apply for engineering bursaries'],
      },
      {
        age_range: '20–24',
        skills: ['Structural analysis', 'Site supervision', 'Project management', 'BIM software (Revit)', 'Kenyan building codes and standards'],
        why: 'Engineering school is theory. Attachment and internship experience is where real learning happens.',
        activities: ['Industrial attachment with KeNHA or a consultant', 'Register as Graduate Engineer with Engineers Board of Kenya', 'Learn BIM on YouTube'],
      },
    ],
    future_skills: [
      'Building Information Modelling (BIM)',
      'Sustainable and green building design',
      'Climate-resilient infrastructure planning',
      'Project management software (Primavera, MS Project)',
      'GIS for infrastructure planning',
    ],
    obsolete_skills: [
      'Manual drafting on drawing boards',
      'Hand calculations for standard structural loads',
    ],
    kenya_examples: [
      { name: 'SGR engineers', what_they_did: 'Kenyan engineers worked alongside Chinese counterparts to build the Standard Gauge Railway, gaining world-class infrastructure skills', started_from: 'University of Nairobi and JKUAT engineering graduates' },
      { name: 'Engineers Without Borders Kenya', what_they_did: 'Young Kenyan engineers building low-cost water systems and bridges in rural areas', started_from: 'Engineering graduates applying skills locally' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 5. TEACHER / EDUCATION TECHNOLOGIST
  // ──────────────────────────────────────────────────────────
  {
    slug: 'teacher-education-technologist',
    title: 'Teacher / Education Technologist',
    category: 'education',
    description:
      'Teachers are the most important profession in any country. In Kenya, the shift to CBC creates demand for a new generation of educators who understand competency-based learning, technology, and child development. Education technologists design the tools and systems that improve how children learn.',
    ai_impact:
      'AI can generate lesson content, grade multiple-choice questions, and personalize practice problems. But teaching is fundamentally human: building relationships, motivating reluctant learners, reading a classroom\'s energy, mentoring a struggling student. Teachers who embrace AI tools to reduce admin and focus more on students will thrive. Those who resist will struggle.',
    ai_impact_level: 'low',
    kenya_market_outlook:
      'Kenya has 360,000+ teachers and still needs more, especially in STEM subjects and special needs education. The TSC has ongoing recruitment. Private schools pay much better. EdTech companies (Eneza Education, Zeraki, Ubongo) are hiring education technologists. CBC implementation creates demand for curriculum designers and teacher trainers.',
    salary_range_kes: { min: 40000, max: 200000, note: 'Government P1 teacher to senior private school teacher; EdTech companies pay 80k–300k', senior_max: 400000 },
    pathways: [
      {
        type: 'university',
        description: 'Bachelor of Education (BEd) — primary or secondary specialization',
        cost_kes: { min: 120000, max: 400000, note: 'per year; government bursaries widely available' },
        duration_years: 4,
        institutions: ['Kenyatta University', 'Moi University', 'Maseno University', 'University of Nairobi', 'Pwani University'],
        entry_requirements: 'C+ at KCSE',
      },
      {
        type: 'college',
        description: 'P1 Primary Teacher Education Certificate (PTEC)',
        cost_kes: { min: 60000, max: 150000, note: 'full course' },
        duration_years: 2,
        institutions: ['Kenya Education Management Institute (KEMI)', 'Shanzu Teachers College', 'Highridge Teachers College'],
        entry_requirements: 'C at KCSE',
      },
      {
        type: 'self_taught',
        description: 'EdTech specialist path — online learning design, curriculum tech',
        cost_kes: { min: 20000, max: 60000, note: 'online courses; many are free' },
        duration_years: 1,
        institutions: ['Coursera', 'EdX', 'Khan Academy trainers program', 'Google for Education'],
        entry_requirements: 'Teaching experience + technology interest',
      },
    ],
    required_subjects: ['english', 'mathematics', 'any_two_teaching_subjects'],
    skill_timeline: [
      {
        age_range: '10–13',
        skills: ['Communication and explanation skills', 'Patience', 'Tutoring younger siblings or classmates', 'Reading widely'],
        why: 'Future teachers often emerge as the child who enjoys explaining things to others.',
        activities: ['Tutor a classmate', 'Start a reading club', 'Lead a class presentation'],
      },
      {
        age_range: '14–16',
        skills: ['Strong language skills (English and Swahili)', 'Subject mastery in chosen teaching areas', 'Leadership in school activities', 'Understanding child psychology basics'],
        why: 'You cannot teach what you don\'t know deeply. Excellent teachers were excellent students in their subjects.',
        activities: ['Peer tutoring program', 'Drama/debate for communication', 'Read about how children learn'],
      },
      {
        age_range: '17–19',
        skills: ['Lesson planning basics', 'Public speaking confidence', 'Digital tools for education (Google Classroom, Kahoot)', 'Basic educational psychology'],
        why: 'Pre-university preparation. EdTech interest can be cultivated by building small learning tools or tutoring apps.',
        activities: ['Volunteer teacher at a local school', 'Create a YouTube explanation video', 'Build a simple quiz app'],
      },
      {
        age_range: '20–24',
        skills: ['Curriculum design', 'Classroom management', 'Assessment design (CBC portfolio)', 'AI tools for lesson prep', 'Inclusive education techniques'],
        why: 'Teaching practice (TP) is where theory meets reality. The best teachers are relentless learners themselves.',
        activities: ['Teaching practice in a government school', 'Attend KESI professional development', 'Explore EdTech startup internships'],
      },
    ],
    future_skills: [
      'AI-augmented lesson design',
      'Learning analytics and data-driven teaching',
      'Social-emotional learning facilitation',
      'Inclusive education and special needs support',
      'EdTech product design and curriculum consulting',
    ],
    obsolete_skills: [
      'Chalk-and-talk lecturing without engagement',
      'Rote memorization-focused teaching',
    ],
    kenya_examples: [
      { name: 'Zeraki', what_they_did: 'Built Kenya\'s most widely used school management and analytics platform, turning teachers into data-informed educators', started_from: 'JKUAT engineering graduates who saw a school problem' },
      { name: 'Eneza Education', what_they_did: 'Created an SMS-based learning platform used by 3M+ students across Africa', started_from: 'Kenyatta University graduates wanting to reach rural students' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 6. ENTREPRENEUR / BUSINESS OWNER
  // ──────────────────────────────────────────────────────────
  {
    slug: 'entrepreneur-business',
    title: 'Entrepreneur / Business Owner',
    category: 'business',
    description:
      'Kenya is one of Africa\'s most entrepreneurial countries. From the mama mboga who uses M-Pesa to the founder raising millions at a Nairobi accelerator, entrepreneurship is embedded in Kenyan culture. This career is not a fallback — it is a deliberate choice to create value, jobs, and wealth.',
    ai_impact:
      'AI is giving small businesses superpowers they previously couldn\'t afford: 24/7 customer service chatbots, automated accounting, market analysis, content creation, and demand forecasting. The entrepreneur who learns to use these tools can compete with much larger companies. The opportunity is enormous for those who act early.',
    ai_impact_level: 'low',
    kenya_market_outlook:
      'Kenya ranks among Africa\'s top 5 startup ecosystems. M-Pesa enables instant payments. iHub, Nairobi Garage, and GrowthAfrica support startups. Youth unemployment (35%+) is pushing young Kenyans into self-employment. Government programs like Kazi Njenga and Youth Enterprise Fund provide capital. The domestic market of 55M people is large and growing.',
    salary_range_kes: { min: 30000, max: 10000000, note: 'Ranges from micro-business income to tech unicorn exit; median successful SME owner earns 150k–500k/month', senior_max: 10000000 },
    pathways: [
      {
        type: 'university',
        description: 'BCom, BBA, or Economics degree for business foundation',
        cost_kes: { min: 100000, max: 400000, note: 'per year' },
        duration_years: 4,
        institutions: ['Strathmore University', 'USIU', 'Kenyatta University', 'University of Nairobi'],
        entry_requirements: 'C+ at KCSE, strong in Mathematics',
      },
      {
        type: 'entrepreneurial',
        description: 'Start a business directly — learn by doing with coaching support',
        cost_kes: { min: 5000, max: 100000, note: 'starting capital; many businesses start with under Ksh 10,000' },
        duration_years: 1,
        institutions: ['iHub', 'Nailab', 'GrowthAfrica', 'Youth Enterprise Development Fund'],
        entry_requirements: 'A real problem to solve + willingness to fail and learn',
      },
      {
        type: 'self_taught',
        description: 'Online business education + mentorship',
        cost_kes: { min: 0, max: 30000, note: 'many resources are free; Coursera, YouTube, LinkedIn Learning' },
        duration_years: 1,
        institutions: ['Google Hustle Academy', 'Alibaba eFounders program', 'Coursera Business Foundations'],
        entry_requirements: 'Self-discipline and a business idea',
      },
    ],
    required_subjects: ['mathematics', 'english', 'business_studies', 'economics'],
    skill_timeline: [
      {
        age_range: '10–13',
        skills: ['Selling (school snacks, crafts, services)', 'Basic money management', 'Identifying problems people have', 'Negotiation and persuasion'],
        why: 'The best entrepreneurs often sold things as children. This is not a bad thing — it\'s training.',
        activities: ['School tuck shop management', 'Sell something at a school fundraiser', 'Track pocket money in a notebook'],
      },
      {
        age_range: '14–16',
        skills: ['Business Studies and Economics', 'Financial literacy (budgets, profit, loss)', 'Communication and presentation', 'Basic marketing (social media)'],
        why: 'Understanding money, markets, and customers is the foundation of any business.',
        activities: ['Start a small side hustle', 'Run a school club like a business', 'Junior Achievement Kenya programs'],
      },
      {
        age_range: '17–19',
        skills: ['Business plan writing', 'Customer discovery interviews', 'Basic accounting (income statement)', 'Digital marketing', 'Pitching to investors'],
        why: 'University years or gap year is prime time to test a first business without major risk.',
        activities: ['Enter Hult Prize or GSEA competition', 'Build a MVP (minimum viable product)', 'Apply for Nailab or iHub youth program'],
      },
      {
        age_range: '20–24',
        skills: ['Sales and revenue generation', 'Team building and management', 'Financial management (cash flow)', 'AI tools for business automation', 'Investor relations'],
        why: 'The difference between a startup and a hobby is paying customers. Obsess over sales early.',
        activities: ['Get first 100 paying customers', 'Apply for Equity Bank or KCB SME loan', 'Join a business accelerator'],
      },
    ],
    future_skills: [
      'AI tools for business automation',
      'Digital marketing and e-commerce',
      'Data analytics for business decisions',
      'Climate-smart business models',
      'Regional expansion (East African market)',
    ],
    obsolete_skills: [
      'Paper-only bookkeeping',
      'Yellow pages and physical-only marketing',
    ],
    kenya_examples: [
      { name: 'Flutterwave (Nigeria/Kenya)', what_they_did: 'Olugbenga Agboola built a $3B African fintech, but the Kenya ecosystem has dozens of similar stories', started_from: 'Computer science degree + bank job experience' },
      { name: 'Bidco Africa', what_they_did: 'Vimal Shah grew a Kenyan cooking oil company into East Africa\'s largest FMCG manufacturer', started_from: 'Family duka in Nairobi\'s industrial area' },
      { name: 'Jumia Kenya', what_they_did: 'Built Kenya\'s first major e-commerce platform, creating thousands of merchant businesses', started_from: 'Rocket Internet initiative + Kenyan entrepreneurial ecosystem' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 7. JOURNALIST / CONTENT CREATOR
  // ──────────────────────────────────────────────────────────
  {
    slug: 'journalist-content-creator',
    title: 'Journalist / Content Creator',
    category: 'media',
    description:
      'Journalists investigate, report, and explain the world. Content creators build audiences around their ideas, expertise, and personality. In Kenya, the media landscape is shifting fast — from Nation and KBC to YouTube channels, podcasts, and X (Twitter) with hundreds of thousands of followers. Both traditional and digital media offer real career paths.',
    ai_impact:
      'AI can write press releases and basic news summaries. But investigative journalism, source relationships, verification of information, editorial judgment, and storytelling that moves audiences are deeply human. The threat is to low-skill content churning. The opportunity is for journalists who use AI to produce better, faster, more data-driven stories.',
    ai_impact_level: 'high',
    kenya_market_outlook:
      'Kenya has a vibrant media ecosystem: Nation Media Group, Standard Group, NTV, Citizen TV, and hundreds of digital outlets. YouTube monetization works in Kenya (minimum 1,000 subscribers). Podcasting is growing. Brands pay Kenyan content creators for sponsorships. Journalism as a social justice tool is growing via organizations like InformAction and Code for Kenya.',
    salary_range_kes: { min: 35000, max: 200000, note: 'Entry-level journalist to senior editor; top content creators earn 200k–1M+/month through multiple streams', senior_max: 1000000 },
    pathways: [
      {
        type: 'university',
        description: 'BA Journalism and Mass Communication',
        cost_kes: { min: 100000, max: 350000, note: 'per year' },
        duration_years: 4,
        institutions: ['University of Nairobi', 'Daystar University', 'Multimedia University', 'Strathmore'],
        entry_requirements: 'C+ with strong English',
      },
      {
        type: 'self_taught',
        description: 'Build a portfolio through blogging, YouTube, podcast, or freelance writing',
        cost_kes: { min: 5000, max: 30000, note: 'equipment and hosting costs; much is free' },
        duration_years: 1,
        institutions: ['Google Journalist Studio', 'Reuters Training', 'Knight Center for Journalism (free online courses)'],
        entry_requirements: 'A story worth telling + discipline to ship content regularly',
      },
    ],
    required_subjects: ['english', 'kiswahili', 'history', 'computer_studies'],
    skill_timeline: [
      {
        age_range: '10–13',
        skills: ['Reading widely (newspapers, books, blogs)', 'Telling stories clearly', 'Curiosity and asking good questions', 'Basic writing'],
        why: 'Journalists are voracious readers before they become writers. The habit starts here.',
        activities: ['School newspaper club', 'Write a daily journal', 'Interview a family member about their life'],
      },
      {
        age_range: '14–16',
        skills: ['Essay writing and argumentation', 'Photography basics', 'School radio or journalism club', 'Social media literacy'],
        why: 'Craft development years. Writing, photography, and media literacy are the tools.',
        activities: ['Start a school blog', 'Enter a writing competition', 'Learn basic video editing on phone'],
      },
      {
        age_range: '17–19',
        skills: ['Investigative research skills', 'Video production basics', 'Podcast creation', 'Data journalism basics (reading statistics)', 'Building an audience'],
        why: 'Portfolio beats a degree in journalism. Start publishing now.',
        activities: ['Start a YouTube channel or podcast', 'Freelance for a local newspaper or blog', 'Cover a local community story'],
      },
      {
        age_range: '20–24',
        skills: ['Source cultivation and ethics', 'Video editing (Premiere, DaVinci Resolve)', 'SEO and digital analytics', 'Monetization (YouTube, Substack, brand deals)', 'Fact-checking with AI tools'],
        why: 'The audience size and portfolio at this age determines career trajectory.',
        activities: ['Internship at NTV, Nation, or a digital outlet', 'Apply to Google News Initiative training', 'Build to 1,000 YouTube subscribers'],
      },
    ],
    future_skills: [
      'Data journalism and visualization',
      'AI-assisted research and fact-checking',
      'Multimedia storytelling (video + text + audio)',
      'Audience monetization strategies',
      'Investigative and accountability journalism',
    ],
    obsolete_skills: [
      'Print-only journalism skills',
      'Basic wire story rewriting',
    ],
    kenya_examples: [
      { name: 'Churchill Show comedians', what_they_did: 'Dozens of Kenyan content creators launched careers through Churchill Show before building independent YouTube and social media audiences', started_from: 'Open mic nights and church drama groups' },
      { name: 'NTV/Citizen TV investigative teams', what_they_did: 'Kenyan investigative journalists have broken major corruption stories that changed laws and removed officials from office', started_from: 'Daystar and UoN journalism graduates' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 8. ENVIRONMENTAL SCIENTIST
  // ──────────────────────────────────────────────────────────
  {
    slug: 'environmental-scientist',
    title: 'Environmental Scientist',
    category: 'environment',
    description:
      'Environmental scientists study ecosystems, climate, water, and the impact of human activity on the natural world. Kenya\'s environmental challenges — deforestation, water scarcity, climate change impacts, and plastic pollution — make this one of the most important careers of the 21st century.',
    ai_impact:
      'AI is used for satellite monitoring of deforestation, climate modelling, wildlife tracking, and water quality analysis. Environmental scientists who can work with these tools will be far more effective. The fieldwork, community engagement, policy advocacy, and ethical dimensions of environmental work remain entirely human.',
    ai_impact_level: 'low',
    kenya_market_outlook:
      'Kenya is a global leader in environmental conservation: Maasai Mara, Great Rift Valley, and Lake Victoria. The government, NGOs (WWF Kenya, Nature Kenya, WCS), UN Environment Programme (UNEP, headquartered in Nairobi), and the private sector (carbon credits, eco-tourism) all employ environmental scientists. Climate finance is growing rapidly.',
    salary_range_kes: { min: 60000, max: 250000, note: 'NGO field officer to UN Environment Programme consultant; carbon credit consultants earn significantly more', senior_max: 600000 },
    pathways: [
      {
        type: 'university',
        description: 'BSc Environmental Science or Natural Resource Management',
        cost_kes: { min: 120000, max: 450000, note: 'per year' },
        duration_years: 4,
        institutions: ['University of Nairobi', 'Kenyatta University', 'Egerton University', 'Moi University', 'JKUAT'],
        entry_requirements: 'C+ in Biology, Chemistry, and Geography',
      },
      {
        type: 'tvet',
        description: 'Diploma in Environment and Community Development',
        cost_kes: { min: 50000, max: 150000, note: 'full course' },
        duration_years: 2,
        institutions: ['Kenya Wildlife Service Training Institute', 'Koibatek Training Institute'],
        entry_requirements: 'C at KCSE with Geography or Biology',
      },
    ],
    required_subjects: ['biology', 'chemistry', 'geography', 'mathematics'],
    skill_timeline: [
      {
        age_range: '10–13',
        skills: ['Appreciation of nature and wildlife', 'Understanding ecosystems', 'Recycling and conservation habits', 'Curiosity about climate and weather'],
        why: 'Environmental scientists often trace their careers to a childhood love of nature.',
        activities: ['School nature club', 'Visit a national park', 'Start a school recycling program'],
      },
      {
        age_range: '14–16',
        skills: ['Biology (ecology, ecosystems)', 'Geography (climate, land use, water systems)', 'Chemistry (pollution, water quality)', 'Environmental news awareness'],
        why: 'Science foundation years. Environmental science requires all three sciences plus geography.',
        activities: ['Water quality testing project', 'Tree planting initiative', 'Write a report on a local environmental issue'],
      },
      {
        age_range: '17–19',
        skills: ['GIS basics (mapping tools)', 'Environmental law and policy awareness', 'Field research methods', 'Data collection and analysis', 'Grant writing basics'],
        why: 'Environmental science is practical. Field skills and policy understanding set you apart.',
        activities: ['Volunteer with a local conservation NGO', 'Conduct an environmental audit of your school', 'Apply for Kenya Youth Environmental Network'],
      },
      {
        age_range: '20–24',
        skills: ['Environmental Impact Assessment (EIA)', 'Climate data analysis', 'Carbon credit methodology', 'Community engagement facilitation', 'Report writing for donors and governments'],
        why: 'Most environmental jobs require EIA certification. Get it early.',
        activities: ['NEMA internship or accreditation', 'Fieldwork with UNEP Kenya', 'Apply for climate finance research grants'],
      },
    ],
    future_skills: [
      'Carbon credit assessment and trading',
      'Climate adaptation planning',
      'Satellite data and remote sensing',
      'Environmental finance and ESG reporting',
      'Community climate resilience programming',
    ],
    obsolete_skills: [
      'Manual-only field data collection without digital tools',
    ],
    kenya_examples: [
      { name: 'Wangari Maathai (legacy)', what_they_did: 'Nobel Peace Prize winner who planted 47 million trees through the Green Belt Movement, starting from Kenya\'s rural communities', started_from: 'University of Nairobi Biology lecturer' },
      { name: 'UNEP Nairobi', what_they_did: 'Hundreds of Kenyan environmental scientists work at the United Nations headquarters in Nairobi, influencing global policy', started_from: 'Kenyan university graduates in environmental sciences' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 9. GRAPHIC DESIGNER / CREATIVE TECHNOLOGIST
  // ──────────────────────────────────────────────────────────
  {
    slug: 'graphic-designer-creative-technologist',
    title: 'Graphic Designer / Creative Technologist',
    category: 'creative',
    description:
      'Designers create the visual communication that makes brands, products, and ideas understood. Creative technologists combine design with coding to build interactive experiences. In Kenya, the demand for design spans advertising, packaging, app design, film, and fashion — and it\'s growing.',
    ai_impact:
      'AI image generation (Midjourney, DALL-E, Adobe Firefly) is changing graphic design. Basic logo creation and stock illustration work is being automated. But brand strategy, UI/UX design, motion graphics, art direction, and creative problem-solving require human judgment, cultural understanding, and client relationships. Designers who use AI tools in their workflow will produce work faster and charge more.',
    ai_impact_level: 'high',
    kenya_market_outlook:
      'Kenya\'s advertising industry (Saatchi & Saatchi, McCann Nairobi, Ogilvy), film industry (growing Nollywood-adjacent), and startup ecosystem (every startup needs design) all employ designers. Freelance design on Upwork and Fiverr is accessible from Nairobi. The African creative economy is worth $4.2B and growing.',
    salary_range_kes: { min: 45000, max: 250000, note: 'Junior designer to creative director; top freelancers earn 300k–800k+/month', senior_max: 800000 },
    pathways: [
      {
        type: 'university',
        description: 'BA Fine Art and Design or BSc Interactive Media Design',
        cost_kes: { min: 120000, max: 450000, note: 'per year' },
        duration_years: 4,
        institutions: ['University of Nairobi (Fine Art)', 'Kenyatta University', 'Kenya Institute of Mass Communication (KIMC)', 'Multimedia University'],
        entry_requirements: 'C+ with strong Art scores',
      },
      {
        type: 'self_taught',
        description: 'Portfolio-driven self-teaching through online courses and client work',
        cost_kes: { min: 10000, max: 50000, note: 'software and courses; Adobe Creative Cloud student pricing available' },
        duration_years: 1,
        institutions: ['Coursera (Google UX Design)', 'YouTube (DesignWithArash)', 'Domestika', 'Figma Community'],
        entry_requirements: 'Artistic eye + willingness to practice daily',
      },
      {
        type: 'college',
        description: 'Diploma in Graphic Design or Visual Communication',
        cost_kes: { min: 60000, max: 200000, note: 'full diploma' },
        duration_years: 2,
        institutions: ['KIMC', 'Shang Tao Media College', 'PC Kinyanjui Technical Training Institute'],
        entry_requirements: 'KCSE C with Art or Computer Studies',
      },
    ],
    required_subjects: ['art_and_design', 'computer_studies', 'english', 'mathematics'],
    skill_timeline: [
      {
        age_range: '10–13',
        skills: ['Drawing and sketching', 'Color theory (even informally)', 'Photography basics (phone camera)', 'Visual storytelling (comics, posters)'],
        why: 'Design starts with observation. Children who draw, notice, and create are building the foundation.',
        activities: ['Draw every day', 'Start a sketchbook', 'Make posters for school events'],
      },
      {
        age_range: '14–16',
        skills: ['Digital tools basics (Canva, free design apps)', 'Typography fundamentals', 'Art classes at school', 'Photography and basic video editing'],
        why: 'The transition from pen-and-paper to digital tools. Canva is a great starting point before Figma and Adobe.',
        activities: ['Design school posters and social media graphics', 'Enter art competitions', 'Create a portfolio folder'],
      },
      {
        age_range: '17–19',
        skills: ['Adobe Photoshop and Illustrator', 'Figma for UI/UX', 'Logo design and brand identity', 'Motion graphics basics', 'Client work and freelancing'],
        why: 'Portfolio is everything. Designers with 20 real client pieces beat those with a degree and no work.',
        activities: ['Offer free designs to NGOs or small businesses', 'Open a Behance or Dribbble portfolio', 'Freelance on Fiverr'],
      },
      {
        age_range: '20–24',
        skills: ['UI/UX design and user research', 'Motion graphics (After Effects)', 'Brand strategy', 'AI design tools (Midjourney, Firefly)', 'Creative direction'],
        why: 'Senior designers understand business and users, not just aesthetics. Develop that thinking early.',
        activities: ['Work at an agency or design studio', 'Build a product from design to launch', 'Mentor junior designers'],
      },
    ],
    future_skills: [
      'AI-augmented design workflows',
      'Motion design and 3D (Blender)',
      'UX research and human-centred design',
      'Design systems at scale',
      'Afrofuturism and African visual identity work',
    ],
    obsolete_skills: [
      'Manual paste-up and print-only design',
      'Basic logo vectorization by hand',
    ],
    kenya_examples: [
      { name: 'Bold Design Studio (Nairobi)', what_they_did: 'Award-winning Kenyan design studio behind some of East Africa\'s most recognized brand identities', started_from: 'University of Nairobi Fine Art graduates' },
      { name: 'Shujaaz Inc', what_they_did: 'Nairobi creative studio that uses comics and media to reach 4M+ young Kenyans with life skills content', started_from: 'Graphic designers and youth workers who saw a communication gap' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // 10. ACCOUNTANT / FINANCIAL ANALYST
  // ──────────────────────────────────────────────────────────
  {
    slug: 'accountant-financial-analyst',
    title: 'Accountant / Financial Analyst',
    category: 'finance',
    description:
      'Accountants and financial analysts manage, analyze, and report on money. Every organization — hospital, NGO, startup, government, or corporation — needs this skill. In Kenya, CPA (Certified Public Accountant) qualification opens doors in both employment and consulting.',
    ai_impact:
      'AI and accounting software (QuickBooks, Xero, Sage) are automating data entry, bank reconciliation, and basic tax filing. This is eliminating low-skill bookkeeping. But financial analysis, strategic advisory, audit work, forensic accounting, and advising businesses on decisions — these require judgment, ethics, and communication that AI cannot replace. The bar has risen, not fallen.',
    ai_impact_level: 'high',
    kenya_market_outlook:
      'Kenya has one of Africa\'s most developed financial sectors: NSE, major commercial banks (KCB, Equity, Co-op), Big 4 audit firms (KPMG, Deloitte, EY, PwC), and a growing fintech ecosystem. CPA Kenya qualification is valued across East Africa. Treasury and county government finance departments need thousands of qualified accountants.',
    salary_range_kes: { min: 60000, max: 350000, note: 'Graduate accountant to Finance Manager; CFOs at major companies earn 800k–2M', senior_max: 2000000 },
    pathways: [
      {
        type: 'university',
        description: 'BCom Accounting or BSc Finance',
        cost_kes: { min: 120000, max: 450000, note: 'per year' },
        duration_years: 4,
        institutions: ['Strathmore University', 'University of Nairobi', 'USIU', 'Kenyatta University', 'KCA University'],
        entry_requirements: 'C+ in Mathematics and English at KCSE',
      },
      {
        type: 'college',
        description: 'CPA (Certified Public Accountant) Kenya — most respected professional qualification',
        cost_kes: { min: 80000, max: 200000, note: 'full CPA course; can be done while working' },
        duration_years: 3,
        institutions: ['KASNEB (Kenya Accountants and Secretaries National Examinations Board)', 'Strathmore Business School', 'KCA University'],
        entry_requirements: 'KCSE C with Mathematics, then pass CPA Foundation section',
      },
      {
        type: 'self_taught',
        description: 'Financial modeling and analysis skills via online courses + Excel mastery',
        cost_kes: { min: 5000, max: 40000, note: 'online courses; much is free' },
        duration_years: 1,
        institutions: ['CFI (Corporate Finance Institute)', 'Coursera', 'ACCA qualification (alternative to CPA)'],
        entry_requirements: 'KCSE + genuine interest in numbers and business',
      },
    ],
    required_subjects: ['mathematics', 'english', 'business_studies', 'economics'],
    skill_timeline: [
      {
        age_range: '10–13',
        skills: ['Basic arithmetic and mental math', 'Understanding money (budgets, savings)', 'Counting and managing pocket money', 'Business curiosity'],
        why: 'Accountants need number fluency. Mental math habits built young are valuable throughout a career.',
        activities: ['Manage a household budget for a month', 'Track income and expenses in a notebook', 'Junior savings account'],
      },
      {
        age_range: '14–16',
        skills: ['Strong Mathematics (especially algebra)', 'Business Studies (basic accounting)', 'Excel basics', 'Financial news awareness'],
        why: 'KCSE Mathematics grade directly determines accounting career options. This is non-negotiable.',
        activities: ['Accounts club at school', 'Build a personal budget in Excel', 'Read the Business Daily newspaper'],
      },
      {
        age_range: '17–19',
        skills: ['CPA Foundation preparation', 'Double-entry bookkeeping', 'Financial statements (income statement, balance sheet)', 'Tax basics (Kenya VAT, PAYE)', 'Accounting software (QuickBooks free trial)'],
        why: 'Starting CPA Foundation at 18 means qualifying by 21 — a significant career advantage.',
        activities: ['Begin CPA Foundation self-study', 'Help a family business with basic accounts', 'Internship at a local accounting firm'],
      },
      {
        age_range: '20–24',
        skills: ['Financial modelling (Excel advanced)', 'Audit procedures', 'Tax planning', 'Management accounting', 'AI-assisted financial analysis', 'Business advisory communication'],
        why: 'The accountants who become CFOs are those who understand business strategy, not just numbers.',
        activities: ['Audit internship at Big 4 (KPMG, Deloitte, EY, PwC)', 'Complete CPA qualification', 'CFA Level 1 for financial analysis track'],
      },
    ],
    future_skills: [
      'Financial modelling and forecasting',
      'ESG (environmental, social, governance) reporting',
      'Blockchain and digital asset accounting',
      'AI tool integration in finance workflows',
      'Strategic financial advisory',
    ],
    obsolete_skills: [
      'Manual ledger bookkeeping',
      'Data entry and bank reconciliation by hand',
      'Basic payroll processing (fully automated)',
    ],
    kenya_examples: [
      { name: 'Equity Bank CFOs', what_they_did: 'Equity Bank has built one of Africa\'s most celebrated financial institutions, with Kenyan accountants and analysts holding top regional roles', started_from: 'CPA Kenya and university graduates' },
      { name: 'Stanbic / Standard Chartered Kenya', what_they_did: 'International banks with large Kenya finance teams run by locally-trained CPA accountants', started_from: 'KASNEB CPA qualification + university degree' },
    ],
  },
]

export async function seedCareers(): Promise<{ inserted: number; errors: string[] }> {
  const supabase = createServiceClient()
  const errors: string[] = []
  let inserted = 0

  for (const career of SEED_CAREERS) {
    const { error } = await supabase
      .from('careers')
      .upsert(career, { onConflict: 'slug' })

    if (error) {
      errors.push(`${career.slug}: ${error.message}`)
    } else {
      inserted++
    }
  }

  return { inserted, errors }
}
