// lib/career/seedCareers.ts

import { createServiceClient } from '@/utils/supabase/service'
import { STANDARD_DISCLAIMER } from './types'
import type { Career } from './types'

type SeedCareer = Omit<Career, 'id' | 'created_at' | 'updated_at'>

const D = STANDARD_DISCLAIMER

const KC = 'Kenya median salary for a degree holder is KES 60K–85K/month. Above KES 150K = top 15% of earners. This career can reach that level by year 3-5 with the right path.'
const SGN_TECH   = 'Kenya tech salaries growing 15-20% per year (2026 data). General professional salaries: 8-12%.'
const SGN_PROF   = 'Kenya professional salaries growing 8-12% per year (2026 data). Tech roles growing at 15-20%.'
const ENTREP_NOTE = 'Highly variable. Year 1-2 typically reinvested. Established business: KES 200K–unlimited/month.'

export const SEED_CAREERS: SeedCareer[] = [

  // ── 1. SOFTWARE ENGINEER ─────────────────────────────────────────────────────
  {
    slug: 'software-engineer',
    title: 'Software Engineer',
    category: 'technology',
    pathway: 'STEM',
    description: 'Software engineers design, build, and maintain the digital systems that power everything from mobile money to hospital records. In Kenya, this is one of the fastest-growing professions — but the role is shifting rapidly with AI. The engineers who will thrive are not code-typing machines; they are problem-solvers who happen to use code.',
    doors: [
      {
        type: 'employment',
        title: 'Software Developer at a Company',
        description: 'Build products for tech companies, banks, telcos, and NGOs. Kenya\'s Silicon Savannah employs thousands of developers across 400+ startups and established corporations.',
        salary_tiers: {
          entry:  { min: 80000,  max: 150000, label: 'Entry level (0-2 years)' },
          mid:    { min: 150000, max: 400000, label: 'Mid level (3-5 years)' },
          senior: { min: 400000, max: 700000, label: 'Senior (5+ years)' },
          note: 'Nairobi rates. Remote USD roles can be 30-80% higher.',
          kenya_context: KC, salary_growth_note: SGN_TECH,
        },
        employers: ['Safaricom', 'Equity Bank', 'Andela', 'Microsoft Africa', 'iHub startups', 'Cellulant', 'Twiga Foods Tech'],
        time_to_first_job: '3–4 years (degree) or 1 year (bootcamp + strong portfolio)',
      },
      {
        type: 'self_employment',
        title: 'Freelance Developer',
        description: 'Build websites and apps for clients locally and globally. Many Kenyan developers earn in USD while living in Nairobi — a significant advantage.',
        startup_cost_kes: { min: 50000, max: 150000 },
        platforms: ['Upwork', 'Fiverr', 'Toptal', 'LinkedIn', 'local referrals', 'PesaLink for payments'],
      },
      {
        type: 'entrepreneurship',
        title: 'Build a Tech Product / Startup',
        description: 'Build software that solves a Kenyan or African problem and scale it. The market is massive and underserved.',
        kenya_examples: ['Safaricom M-Pesa (started as a small team)', 'Sendy (logistics)', 'Twiga Foods', 'MarketForce', 'Apollo Agriculture'],
        market_size: 'KES 200B+ digital economy growing 30% per year across East Africa',
        earnings_note: ENTREP_NOTE,
      },
      {
        type: 'ai_era',
        title: 'AI Tools Builder / Prompt Engineer',
        description: 'A new door that barely existed in 2022. Build AI-powered products using APIs like Claude, GPT, and DeepSeek for businesses that cannot afford big agencies.',
        ai_opportunity: 'Most Kenyan businesses need AI automation but cannot afford expensive agencies. A developer who understands AI APIs can charge premium rates solving real problems — from AI customer service to automated legal document review.',
        skills_needed: ['API integration', 'prompt engineering', 'no-code + code hybrid tools', 'understanding of LLM limitations'],
        early_mover_advantage: true,
      },
    ],
    ai_impact: {
      level: 'transforming',
      replacing: ['Writing boilerplate CRUD code', 'Basic bug fixing in simple code', 'Simple website building from templates', 'Documentation writing', 'Routine data migration scripts'],
      creating: ['AI systems need human oversight and judgment', 'Prompt engineering is a new well-paid skill', 'AI product management (knowing what to build)', 'Training data curation and quality control', 'AI ethics and safety engineering'],
      human_advantage: ['Understanding what the client actually needs (empathy)', 'System architecture decisions under uncertainty', 'Creative problem-solving for novel situations', 'Client relationships and trust-building', 'Debugging complex AI failures in production'],
      timeline: 'Significant change already happening — junior coding roles are shrinking but senior + AI-integration roles are growing fast. By 2027, most routine code will be AI-generated.',
      honest_summary: 'AI is changing software development faster than any other field. Basic coding is becoming a commodity — AI can write most CRUD apps in minutes. But developers who understand systems, can work with AI tools, and solve real business problems are MORE valuable than ever. The opportunity is to be the person who knows how to use AI — not the person AI replaces.',
    },
    kenya_market_outlook: 'Kenya is East Africa\'s tech hub. Nairobi\'s "Silicon Savannah" has 400+ startups and growing demand. M-Pesa, Safaricom, Andela, and hundreds of fintechs are hiring. Remote work opens global salaries. Entry is competitive but Kenya-trained engineers are now respected globally.',
    salary_range_kes: {
      entry:  { min: 80000,  max: 150000, label: 'Entry level (0-2 years)' },
      mid:    { min: 150000, max: 400000, label: 'Mid level (3-5 years)' },
      senior: { min: 400000, max: 700000, label: 'Senior (5+ years)' },
      note: 'Nairobi rates. Remote USD roles can be 30-80% higher.',
      kenya_context: KC, salary_growth_note: SGN_TECH,
    },
    required_subjects: ['mathematics', 'physics', 'english', 'computer_studies'],
    subject_importance: { mathematics: 'critical', physics: 'important', english: 'important', computer_studies: 'helpful' },
    skill_timeline: [
      { age_range: '10–13', phase: 'Foundation', skills: ['Basic computer use', 'Scratch block coding', 'Problem-solving games', 'Typing practice'], why: 'Computational thinking before syntax. Scratch teaches logic without frustration.', parent_action: 'Get Scratch.mit.edu on the family computer. Let them build games for fun — that IS learning.', activities: ['Scratch.mit.edu projects', 'Chess club', 'Code.org Hour of Code'] },
      { age_range: '14–16', phase: 'Building', skills: ['Python basics', 'HTML/CSS', 'How the internet works', 'Simple web pages', 'Git basics'], why: 'Real programming begins. Python is the fastest path from beginner to useful programs.', parent_action: 'Help them set up a free GitHub account and do one Python project together. The sense of accomplishment is powerful.', activities: ['Build a personal website', 'Automate a boring task in Python', 'CS50 on edX (free)'] },
      { age_range: '17–19', phase: 'Specializing', skills: ['JavaScript and React', 'Databases (SQL)', 'APIs', 'One complete personal project', 'Version control'], why: 'Portfolio-building phase. Universities and employers want to see real things you built.', parent_action: 'Encourage them to build something people actually use — even a small tool for the family or school. Real users teach more than tutorials.', activities: ['Build a school project tracker app', 'Contribute to open source', 'Enter a hackathon'] },
      { age_range: '20–24', phase: 'Career Entry', skills: ['System design', 'Cloud platforms (AWS/GCP)', 'Testing', 'AI-assisted development', 'Team collaboration tools'], why: 'Career entry. Companies want engineers who can work in teams and ship production code.', parent_action: 'Encourage internships over classroom time. The best learning at this stage is working on real products with real users.', activities: ['Internship at a Nairobi startup', 'Build a SaaS product', 'AWS Cloud Practitioner certification'] },
    ],
    future_skills: ['AI prompt engineering for developers', 'System architecture', 'Product thinking', 'Data engineering', 'Cybersecurity fundamentals'],
    kenya_examples: [
      { name: 'Juliana Rotich', what_they_did: 'Co-founded Ushahidi, a global crisis-mapping platform used worldwide', started_from: 'University of Nairobi CS degree', door: 'entrepreneurship' },
      { name: 'Andela graduates', what_they_did: 'Thousands placed at global companies like Google, GitHub, and Spotify', started_from: 'Self-taught or bootcamp backgrounds', door: 'employment' },
    ],
    disclaimer: D,
  },

  // ── 2. MEDICAL DOCTOR ────────────────────────────────────────────────────────
  {
    slug: 'medical-doctor',
    title: 'Medical Doctor',
    category: 'health',
    pathway: 'STEM',
    description: 'Doctors diagnose illness, treat patients, and protect public health. In Kenya, the doctor is still one of the most needed professionals — the country has 0.2 doctors per 1,000 people against a WHO recommendation of 1 per 1,000. The doctor of 2030 will work alongside AI diagnostic tools, not against them.',
    doors: [
      {
        type: 'employment',
        title: 'Government or Private Hospital Doctor',
        description: 'Work at county hospitals, national referral hospitals, or private facilities. Kenya has massive government recruitment and private sector demand.',
        salary_tiers: {
          entry:  { min: 80000,  max: 150000, label: 'Entry level (intern/house officer)' },
          mid:    { min: 150000, max: 400000, label: 'Medical Officer / Registrar (3-5 years)' },
          senior: { min: 400000, max: 800000, label: 'Specialist / Consultant (5+ years)' },
          note: 'Government rates. Private sector and specialists earn 800K–2M+.',
          kenya_context: KC, salary_growth_note: SGN_PROF,
        },
        employers: ['Ministry of Health Kenya', 'Aga Khan Hospital', 'Nairobi Hospital', 'MP Shah', 'County governments', 'Mission hospitals'],
        time_to_first_job: '7 years (MBChB + 1-year internship) or 3 years (KMTC Clinical Officer)',
      },
      {
        type: 'self_employment',
        title: 'Private Practice / Locum Doctor',
        description: 'Run your own clinic or offer locum services to hospitals. Many Kenyan doctors run thriving private practices alongside government work.',
        startup_cost_kes: { min: 300000, max: 2000000 },
        platforms: ['Local clinic', 'Referral networks', 'HealthIT Kenya platforms', 'Daktari Online'],
      },
      {
        type: 'entrepreneurship',
        title: 'Health Startup / Telemedicine',
        description: 'Build a health business solving access, cost, or quality problems in Kenya\'s fragmented healthcare system.',
        kenya_examples: ['Daktari Online (telemedicine)', 'Ilara Health (diagnostic devices)', 'Maisha Meds (pharmacy)', 'mPharma Kenya'],
        market_size: 'Kenya healthcare market KES 300B+ growing at 8% annually',
        earnings_note: ENTREP_NOTE,
      },
      {
        type: 'ai_era',
        title: 'AI Diagnostics Operator / Health Data Specialist',
        description: 'AI tools like diagnostic imaging readers and clinical decision support are entering Kenyan hospitals. Doctors who understand these systems will supervise and optimize them.',
        ai_opportunity: 'Radiology AI is coming to Kenya — hospitals need doctors who can interpret AI-assisted scans and validate AI recommendations for Kenyan disease patterns (TB, malaria, tropical diseases).',
        skills_needed: ['Medical informatics', 'Understanding of AI diagnostic tools', 'Health data management', 'Telemedicine platforms'],
        early_mover_advantage: false,
      },
    ],
    ai_impact: {
      level: 'medium',
      replacing: ['Reading basic X-rays and scans (AI does this faster)', 'Routine prescription management', 'Administrative documentation', 'Standard lab result interpretation'],
      creating: ['Supervising AI diagnostic tools', 'Complex case analysis where AI flags issues', 'Rare disease identification using global data', 'Mental health services (massive gap, AI cannot replace human therapy)'],
      human_advantage: ['Listening to a patient and reading between the lines', 'Making ethical decisions in resource-limited settings', 'Comforting families during difficult diagnoses', 'Managing complex multi-system diseases', 'Community trust and cultural sensitivity'],
      timeline: 'AI diagnostic tools are entering Kenya now (2025–2027). Routine diagnostics will be AI-assisted within 5 years. Judgment-heavy clinical work remains human for 20+ years.',
      honest_summary: 'AI is excellent at reading X-rays and detecting patterns in lab results. But a doctor\'s core work — listening to a patient in a rural clinic with limited equipment, making ethical decisions, comforting families — cannot be automated. AI will make doctors more accurate, not unemployed. The best doctors of 2030 will use AI tools fluently.',
    },
    kenya_market_outlook: 'Kenya has 0.2 doctors per 1,000 people (WHO recommends 1 per 1,000). Massive shortage everywhere outside Nairobi. Government actively recruiting. KMA reports high demand. Specialization (surgery, oncology, psychiatry) commands premium pay. Private practice in Nairobi, Mombasa, and Kisumu is highly lucrative.',
    salary_range_kes: {
      entry:  { min: 80000,  max: 150000, label: 'Intern / House Officer (0-2 years)' },
      mid:    { min: 150000, max: 400000, label: 'Medical Officer / Registrar (3-5 years)' },
      senior: { min: 400000, max: 800000, label: 'Specialist / Consultant (5+ years)' },
      note: 'Government rates. Private sector specialists earn 800K–2M+.',
      kenya_context: KC, salary_growth_note: SGN_PROF,
    },
    required_subjects: ['biology', 'chemistry', 'physics', 'mathematics', 'english'],
    subject_importance: { biology: 'critical', chemistry: 'critical', physics: 'important', mathematics: 'important', english: 'important' },
    skill_timeline: [
      { age_range: '10–13', phase: 'Foundation', skills: ['Curiosity about the human body', 'Basic first aid', 'Empathy and listening', 'Biology awareness'], why: 'Children who want to be doctors should love how living things work — not just want the title.', parent_action: 'Enroll in Red Cross Junior First Aid course (free in many counties). Visit a community health worker together.', activities: ['Red Cross Junior First Aid', 'Biology science fair', 'Visit a community health worker'] },
      { age_range: '14–16', phase: 'Building', skills: ['Strong Biology and Chemistry', 'Scientific method', 'Lab skills', 'Research basics'], why: 'The KCSE grades that unlock medicine are decided here. Biology and Chemistry must be priorities.', parent_action: 'Make Biology and Chemistry the top priority this year. Join science clubs. Consider private tuition if needed — medicine entry is highly competitive.', activities: ['Science clubs', 'Volunteer at local clinic', 'Simplified medical journal reading'] },
      { age_range: '17–19', phase: 'Specializing', skills: ['Advanced Biology and Chemistry', 'KCSE preparation for medical entry', 'Basic anatomy', 'Communication and patient skills'], why: 'Final academic push. Entry to medicine requires top KCSE grades — A- or better in sciences.', parent_action: 'Shadow a doctor at a county hospital if possible. One day of observation often confirms or changes the career direction.', activities: ['Shadow a doctor', 'Apply for KMTC or university programs', 'Learn medical terminology'] },
      { age_range: '20–24', phase: 'Career Entry', skills: ['Clinical rotations', 'Diagnosis frameworks', 'Medical ethics', 'AI diagnostic tools', 'Working under pressure'], why: 'Medical school is intense. Clinical rotations expose you to real patients and real decisions.', parent_action: 'Support them through the emotional demands of medical school. The first year treating patients is the hardest. Emotional support from home matters enormously.', activities: ['Excel in preclinical years', 'Research a local disease pattern', 'Mentor junior students'] },
    ],
    future_skills: ['Reading AI diagnostic reports', 'Telemedicine and remote monitoring', 'Mental health first response', 'Public health and epidemiology', 'Evidence-based medicine'],
    kenya_examples: [
      { name: 'Dr. Charity Akello', what_they_did: 'WHO public health officer leading infectious disease response across East Africa', started_from: 'KMTC Clinical Officer upgraded to MBChB', door: 'employment' },
      { name: 'Daktari Online founders', what_they_did: 'Built Kenya\'s leading telemedicine platform connecting rural patients to urban specialists', started_from: 'Kenyan doctors who saw the access gap', door: 'entrepreneurship' },
    ],
    disclaimer: D,
  },

  // ── 3. AGRICULTURAL SCIENTIST / AGRITECH ─────────────────────────────────────
  {
    slug: 'agricultural-scientist',
    title: 'Agricultural Scientist / Agritech',
    category: 'agriculture',
    pathway: 'STEM',
    description: 'Agriculture feeds Kenya. Agricultural scientists and agritech entrepreneurs are solving the country\'s biggest problems: drought, low yields, food insecurity, and farmer income. This career is being transformed by data, drones, and AI — making it exciting, not outdated.',
    doors: [
      {
        type: 'employment',
        title: 'Agricultural Officer / Researcher',
        description: 'Work for government bodies, research institutions, or agribusiness companies driving Kenya\'s food system.',
        salary_tiers: {
          entry:  { min: 40000, max: 85000,  label: 'Entry level (0-2 years)' },
          mid:    { min: 85000, max: 200000, label: 'Mid level (3-5 years)' },
          senior: { min: 200000, max: 450000, label: 'Senior / Head of Department (5+ years)' },
          note: 'KALRO/government rates. Private agribusiness and NGOs pay 20-40% higher.',
          kenya_context: KC, salary_growth_note: SGN_PROF,
        },
        employers: ['KALRO (Kenya Agricultural Research)', 'Ministry of Agriculture', 'Twiga Foods', 'Apollo Agriculture', 'East Africa Breweries', 'Del Monte Kenya'],
        time_to_first_job: '4 years (degree) or 2 years (TVET diploma)',
      },
      {
        type: 'self_employment',
        title: 'Own Farm / Agricultural Consulting',
        description: 'Run your own farm as a business or consult for smallholder farmers. Many young Kenyans are building profitable farms using modern techniques.',
        startup_cost_kes: { min: 20000, max: 500000 },
        platforms: ['Farm direct sales', 'Twiga Foods marketplace', 'Apollo Agriculture credit system', 'WhatsApp farmer groups'],
      },
      {
        type: 'entrepreneurship',
        title: 'Agritech Startup',
        description: 'Build technology that solves farming problems at scale. Kenya is Africa\'s agritech leader with a booming startup ecosystem.',
        kenya_examples: ['Twiga Foods (B2B distribution)', 'Apollo Agriculture (AI + credit for farmers)', 'FarmDrive', 'Tulaa', 'Hello Tractor'],
        market_size: 'Kenya agriculture is 26% of GDP — KES 3.5 trillion market with massive tech opportunity',
        earnings_note: ENTREP_NOTE,
      },
      {
        type: 'ai_era',
        title: 'Precision Farming Specialist',
        description: 'Use AI, drones, and satellite data to help farmers grow more with less. This is where agronomy meets technology.',
        ai_opportunity: 'Crop disease detection via phone camera (Plantix), satellite soil analysis, and AI-powered planting calendars are transforming Kenyan farming. Someone must train farmers and deploy these tools locally.',
        skills_needed: ['Drone operation', 'GIS and satellite imagery', 'AI agricultural tools', 'Data interpretation for farmers'],
        early_mover_advantage: true,
      },
    ],
    ai_impact: {
      level: 'medium',
      replacing: ['Manual pest counting and monitoring', 'Guesswork-based fertilizer application', 'Yield prediction by experience alone', 'Manual weather record-keeping'],
      creating: ['Drone and satellite monitoring of crop health', 'AI-powered disease diagnosis via smartphone', 'Precision irrigation system management', 'Agricultural data analytics for insurance and finance'],
      human_advantage: ['Understanding local soil and microclimates', 'Farmer trust and relationship building', 'Adapting technology to local conditions', 'Crisis response in floods or drought', 'Community knowledge and traditional farming wisdom'],
      timeline: 'AI agricultural tools are already used by 300,000+ Kenyan farmers through Apollo Agriculture and Plantix. By 2028, most commercial farms will use precision data.',
      honest_summary: 'AI is being used for crop disease detection, soil analysis, and weather prediction in Kenya right now. But someone needs to design these systems, train farmers, and apply local knowledge. Agricultural scientists who understand both agronomy and technology have a massive advantage and career security.',
    },
    kenya_market_outlook: 'Agriculture is 26% of Kenya\'s GDP. The government\'s Big 4 agenda prioritizes food security. Agritech startups are raising millions in funding. Export markets (flowers, tea, avocado, macadamia) are growing rapidly. Enormous unmet demand for people who understand both science and farming.',
    salary_range_kes: {
      entry:  { min: 40000,  max: 85000,  label: 'Entry level (0-2 years)' },
      mid:    { min: 85000,  max: 200000, label: 'Mid level (3-5 years)' },
      senior: { min: 200000, max: 450000, label: 'Senior / Management (5+ years)' },
      note: 'KALRO/government rates. Private agribusiness and NGOs pay 20-40% higher.',
      kenya_context: KC, salary_growth_note: SGN_PROF,
    },
    required_subjects: ['biology', 'chemistry', 'mathematics', 'geography'],
    subject_importance: { biology: 'critical', chemistry: 'important', mathematics: 'important', geography: 'helpful' },
    skill_timeline: [
      { age_range: '10–13', phase: 'Foundation', skills: ['Curiosity about plants and animals', 'Basic gardening', 'Understanding seasons', 'Soil awareness'], why: 'Children who grow up farming already have a head start. Practical observation is the foundation.', parent_action: 'Start a small kitchen garden together. Let them observe what affects plant growth. This is real science.', activities: ['School garden project', 'Visit a tea or flower farm', 'Basic composting'] },
      { age_range: '14–16', phase: 'Building', skills: ['Biology (plant biology, ecology)', 'Chemistry (soil pH, fertilizers)', 'Geography (climate, land use)', 'Crop science basics'], why: 'Academic grounding for agronomy. Understanding WHY crops grow or fail requires science.', parent_action: 'Do soil pH experiments at home (available at most hardware stores). Track weather patterns and crop growth together.', activities: ['Soil pH experiments', 'Track weather patterns', 'Interview a local farmer'] },
      { age_range: '17–19', phase: 'Specializing', skills: ['Advanced biology and chemistry', 'Data analysis (Excel for farm records)', 'Drone operation basics', 'Farm business planning'], why: 'Modern agriculture is a business. Combining science with business thinking is rare and valuable.', parent_action: 'Encourage a real farm project — even a small hydroponic setup at home. Learning by doing is accelerated here.', activities: ['Small farm business plan', 'Try hydroponics', 'Volunteer with KALRO or Twiga Foods'] },
      { age_range: '20–24', phase: 'Career Entry', skills: ['Agronomy field research', 'GIS and satellite data', 'Supply chain management', 'AI crop diagnostic tools', 'Grant writing and access to capital'], why: 'The most successful agritech entrepreneurs start solving real farmer problems in their early 20s.', parent_action: 'Help them explore funding — AGRA youth grants, Apollo Agriculture training programs, and government agribusiness loans are available.', activities: ['Internship at Apollo or Twiga', 'Enter Hult Prize agritech competition', 'Apply for AGRA youth grant'] },
    ],
    future_skills: ['Precision agriculture and drone operation', 'Climate-smart farming adaptation', 'AI-powered disease and pest detection', 'Supply chain tech', 'Carbon farming certification'],
    kenya_examples: [
      { name: 'Twiga Foods', what_they_did: 'Built a B2B platform connecting 17,000+ Kenyan farmers directly to urban vendors', started_from: 'Founders saw a supply chain problem', door: 'entrepreneurship' },
      { name: 'Zipporah Wangari', what_they_did: 'Grew her avocado farm from 2 to 15 acres using Apollo Agriculture tools', started_from: 'KCSE graduate with basic agriculture training', door: 'self_employment' },
    ],
    disclaimer: D,
  },

  // ── 4. CIVIL ENGINEER ────────────────────────────────────────────────────────
  {
    slug: 'civil-engineer',
    title: 'Civil Engineer',
    category: 'trades',
    pathway: 'STEM',
    description: 'Civil engineers design and build Kenya\'s infrastructure: roads, bridges, water systems, dams, and housing. Kenya\'s Vision 2030, the SGR, the Nairobi Expressway, and thousands of county projects create consistent demand. This is a stable, well-paid career with strong government and private sector employment.',
    doors: [
      {
        type: 'employment',
        title: 'Infrastructure Engineer',
        description: 'Design and oversee construction of roads, bridges, water systems, and buildings for government or private contractors.',
        salary_tiers: {
          entry:  { min: 70000,  max: 130000, label: 'Graduate Engineer (0-2 years)' },
          mid:    { min: 130000, max: 300000, label: 'Project Engineer (3-5 years)' },
          senior: { min: 300000, max: 600000, label: 'Senior / Principal Engineer (5+ years)' },
          note: 'Nairobi construction market rates. Consultants and directors earn 600K–1.5M.',
          kenya_context: KC, salary_growth_note: SGN_PROF,
        },
        employers: ['Kenya National Highways Authority (KeNHA)', 'County Governments', 'China Wu Yi', 'NCC Group', 'Spencon', 'Knight Frank Kenya'],
        time_to_first_job: '5 years (BSc Civil Engineering) or 3 years (Diploma)',
      },
      {
        type: 'self_employment',
        title: 'Construction Consultant / Site Supervisor',
        description: 'Offer consulting services for private construction projects, supervise sites, or manage building projects for clients.',
        startup_cost_kes: { min: 100000, max: 400000 },
        platforms: ['Direct client referrals', 'Construction tenders (KeNHA, KENHA)', 'LinkedIn professional network', 'Engineers Board of Kenya listings'],
      },
      {
        type: 'entrepreneurship',
        title: 'Construction Company / Real Estate Developer',
        description: 'Start a construction firm or develop affordable housing. Kenya\'s housing deficit of 2 million units creates massive opportunity.',
        kenya_examples: ['Karibu Homes (affordable housing)', 'Mi Vida Homes', 'Centum Real Estate', 'Small-scale local contractors across all 47 counties'],
        market_size: 'Kenya construction sector KES 550B+ — housing deficit of 2M units growing each year',
        earnings_note: ENTREP_NOTE,
      },
      {
        type: 'ai_era',
        title: 'BIM / Digital Construction Specialist',
        description: 'Building Information Modelling (BIM) and AI-powered structural analysis are transforming how buildings and infrastructure are designed.',
        ai_opportunity: 'BIM software (Revit, Civil 3D) and AI simulation tools are replacing manual drafting. Engineers who master these tools are 10x more productive and command premium salaries at international firms.',
        skills_needed: ['AutoCAD and Revit (BIM)', 'AI structural analysis software', 'GIS for infrastructure planning', 'Drone surveying'],
        early_mover_advantage: true,
      },
    ],
    ai_impact: {
      level: 'medium',
      replacing: ['Manual drafting on drawing boards', 'Hand calculations for standard loads', 'Basic quantity surveying calculations', 'Simple site inspection reports'],
      creating: ['BIM model management and coordination', 'AI-assisted structural optimization', 'Drone-based site inspection and monitoring', 'Digital twin maintenance'],
      human_advantage: ['On-site problem solving when plans meet reality', 'Stakeholder and community engagement', 'Government approvals and regulatory navigation', 'Safety judgment under unexpected site conditions', 'Managing large construction teams'],
      timeline: 'BIM adoption in Kenya is accelerating (2025–2028). International projects already require BIM competency. Manual drafting will be obsolete in professional practice by 2027.',
      honest_summary: 'AI is automating structural calculations and replacing manual drafting. But civil engineering requires physical site supervision, stakeholder management, government approvals, and on-the-ground problem solving that AI cannot handle. The role is evolving, not disappearing.',
    },
    kenya_market_outlook: 'The Kenya National Highways Authority, county governments, and major contractors are all hiring. Infrastructure projects worth hundreds of billions are underway. The housing deficit of 2 million units means construction engineers will be needed for decades.',
    salary_range_kes: {
      entry:  { min: 70000,  max: 130000, label: 'Graduate Engineer (0-2 years)' },
      mid:    { min: 130000, max: 300000, label: 'Project Engineer (3-5 years)' },
      senior: { min: 300000, max: 600000, label: 'Senior / Principal Engineer (5+ years)' },
      note: 'Nairobi construction market rates. Consultants and directors earn 600K–1.5M.',
      kenya_context: KC, salary_growth_note: SGN_PROF,
    },
    required_subjects: ['mathematics', 'physics', 'english', 'geography'],
    subject_importance: { mathematics: 'critical', physics: 'critical', english: 'important', geography: 'helpful' },
    skill_timeline: [
      { age_range: '10–13', phase: 'Foundation', skills: ['Spatial reasoning', 'Model building (LEGO, cardboard bridges)', 'Basic physics curiosity', 'Environmental awareness'], why: 'Civil engineers need 3D thinking. Building models as a child is genuine preparation.', parent_action: 'Challenge them to build a bridge from cardboard that holds weight. Visit a construction site and explain what each profession does.', activities: ['Model bridge weight challenge', 'Visit construction sites', 'Geometry and measurement projects'] },
      { age_range: '14–16', phase: 'Building', skills: ['Strong Mathematics (geometry, algebra)', 'Physics (forces, materials)', 'Technical drawing basics', 'TinkerCAD intro'], why: 'The calculation work of engineering starts with strong school maths. Grades here determine university entry.', parent_action: 'Prioritize Mathematics and Physics this term. Technical drawing club at school is valuable. Download TinkerCAD free.', activities: ['Technical drawing class', 'Structural science fair project', 'Visit KeNHA or SGR infrastructure'] },
      { age_range: '17–19', phase: 'Specializing', skills: ['A-level Mathematics and Physics', 'AutoCAD basics', 'Basic surveying concepts', 'Reading engineering drawings'], why: 'University entry requires top maths/physics. AutoCAD self-study puts you ahead on day one.', parent_action: 'Encourage AutoCAD self-study (free student license available). One summer attachment at a construction firm is worth more than a term of theory.', activities: ['AutoCAD projects', 'Talk to a site engineer', 'Apply for engineering bursaries'] },
      { age_range: '20–24', phase: 'Career Entry', skills: ['Structural analysis', 'Site supervision', 'Project management', 'BIM (Revit)', 'Kenyan building codes'], why: 'Engineering school is theory. Industrial attachment is where real learning happens.', parent_action: 'Push them toward a quality industrial attachment — KeNHA or a top consulting firm. The connections made here often lead to first jobs.', activities: ['IA with KeNHA or a consultant', 'Register as Graduate Engineer with EBK', 'Learn BIM software'] },
    ],
    future_skills: ['Building Information Modelling (BIM)', 'Sustainable green building', 'Climate-resilient infrastructure', 'GIS for infrastructure', 'Project management (Primavera)'],
    kenya_examples: [
      { name: 'SGR engineers', what_they_did: 'Kenyan engineers built the Standard Gauge Railway alongside Chinese counterparts, gaining world-class skills', started_from: 'UoN and JKUAT engineering graduates', door: 'employment' },
      { name: 'Karibu Homes team', what_they_did: 'Kenyan civil engineers building affordable housing at scale across Nairobi and secondary towns', started_from: 'Engineering graduates who saw the housing gap', door: 'entrepreneurship' },
    ],
    disclaimer: D,
  },

  // ── 5. TEACHER / EDUCATION TECHNOLOGIST ──────────────────────────────────────
  {
    slug: 'teacher-education-technologist',
    title: 'Teacher / Education Technologist',
    category: 'education',
    pathway: 'Social',
    description: 'Teachers are the most important profession in any country. In Kenya, the shift to CBC creates demand for a new generation of educators who understand competency-based learning, technology, and child development. Education technologists design the tools and systems that improve how children learn.',
    doors: [
      {
        type: 'employment',
        title: 'School Teacher / University Lecturer',
        description: 'Teach in government or private schools, or at university level. Kenya has 360,000+ teachers and needs more, especially in STEM.',
        salary_tiers: {
          entry:  { min: 35000, max: 65000,  label: 'P1 / Graduate Teacher (0-2 years)' },
          mid:    { min: 65000, max: 150000, label: 'Senior Teacher / HOD (3-5 years)' },
          senior: { min: 150000, max: 350000, label: 'Deputy Principal / Lecturer (5+ years)' },
          note: 'Government TSC rates on lower end. Private international school rates significantly higher.',
          kenya_context: KC, salary_growth_note: SGN_PROF,
        },
        employers: ['Teachers Service Commission (TSC)', 'Private schools (Brookhouse, Alliance, Riara)', 'Universities (UoN, Strathmore)', 'NGOs (Teach For Kenya, Bridge)'],
        time_to_first_job: '4 years (BEd degree) or 2 years (P1 PTEC certificate)',
      },
      {
        type: 'self_employment',
        title: 'Private Tutor / Educational Coach',
        description: 'Offer private tutoring, online classes, or coaching services. Demand for quality tutors in Nairobi is high and growing.',
        startup_cost_kes: { min: 10000, max: 50000 },
        platforms: ['WhatsApp referrals', 'TutorFind Kenya', 'YouTube channel', 'Zoom online tutoring', 'Superprof Kenya'],
      },
      {
        type: 'entrepreneurship',
        title: 'Start a School or EdTech Product',
        description: 'Build an educational institution or a technology product that improves learning. The EdTech market in Africa is booming.',
        kenya_examples: ['Zeraki (school management analytics)', 'Eneza Education (SMS learning)', 'Viusasa (Swahili content)', 'Ubongo Kids (animated learning)'],
        market_size: 'Kenya EdTech market KES 50B+ growing at 15% annually; East Africa education market much larger',
        earnings_note: ENTREP_NOTE,
      },
      {
        type: 'ai_era',
        title: 'AI Curriculum Designer / Online Course Creator',
        description: 'Use AI tools to design personalized learning experiences, create online courses, and develop AI-augmented teaching materials.',
        ai_opportunity: 'AI can generate lesson outlines, quiz questions, and personalized feedback. Teachers who learn to direct AI tools can create and sell curriculum content globally — and Kenyan teachers in CBC are uniquely positioned for African markets.',
        skills_needed: ['Learning management systems', 'AI writing and content tools', 'Instructional design basics', 'Video production for courses'],
        early_mover_advantage: true,
      },
    ],
    ai_impact: {
      level: 'low',
      replacing: ['Grading multiple-choice tests', 'Writing generic lesson plan templates', 'Answering simple factual student questions', 'Administrative attendance tracking'],
      creating: ['AI-powered personalized learning at scale', 'AI as a teaching assistant handling routine Q&A', 'Data analytics showing exactly where each student struggles', 'Creating and selling AI-enhanced online courses'],
      human_advantage: ['Building relationships and trust with struggling students', 'Reading a classroom\'s emotional energy', 'Motivating reluctant learners', 'Mentoring students through life challenges', 'Physical safety supervision and child protection'],
      timeline: 'AI is already helping teachers create content (2024). Within 3 years, every classroom will have AI tools. Teachers who embrace them will teach better and faster. Those who resist will be left behind.',
      honest_summary: 'AI can generate lesson content and grade multiple-choice tests. But teaching is fundamentally human: building relationships, motivating reluctant learners, reading a classroom\'s energy, mentoring a struggling student. Teachers who embrace AI tools to reduce admin and focus more on students will thrive.',
    },
    kenya_market_outlook: 'Kenya has 360,000+ teachers and still needs more, especially in STEM and special needs. TSC has ongoing recruitment. Private schools pay much better. EdTech companies (Zeraki, Eneza, Ubongo) are hiring education technologists. CBC implementation creates demand for curriculum designers and teacher trainers.',
    salary_range_kes: {
      entry:  { min: 35000, max: 65000,  label: 'P1 / Graduate Teacher (0-2 years)' },
      mid:    { min: 65000, max: 150000, label: 'Senior Teacher / HOD (3-5 years)' },
      senior: { min: 150000, max: 350000, label: 'Deputy Principal / Lecturer (5+ years)' },
      note: 'Government TSC rates on lower end. Private international school rates significantly higher.',
      kenya_context: KC, salary_growth_note: SGN_PROF,
    },
    required_subjects: ['english', 'mathematics', 'kiswahili'],
    subject_importance: { english: 'critical', mathematics: 'important', kiswahili: 'important' },
    skill_timeline: [
      { age_range: '10–13', phase: 'Foundation', skills: ['Communication and explanation skills', 'Patience', 'Tutoring classmates', 'Reading widely'], why: 'Future teachers often emerge as the child who enjoys explaining things to others.', parent_action: 'Notice if your child enjoys helping others understand things. Encourage tutoring younger siblings — this is teaching practice.', activities: ['Tutor a classmate', 'Start a reading club', 'Lead a class presentation'] },
      { age_range: '14–16', phase: 'Building', skills: ['Strong language skills', 'Subject mastery in chosen teaching areas', 'School leadership activities', 'Child psychology awareness'], why: 'You cannot teach what you don\'t know deeply. Excellent teachers were excellent students in their subjects.', parent_action: 'Encourage debate club, school prefect positions, or drama — all build the communication skills teachers need.', activities: ['Peer tutoring program', 'Drama and debate', 'Read about how children learn'] },
      { age_range: '17–19', phase: 'Specializing', skills: ['Lesson planning basics', 'Public speaking', 'Digital education tools', 'Basic educational psychology'], why: 'Pre-university. EdTech interest can be cultivated by building small learning tools or tutoring apps.', parent_action: 'Arrange a week of volunteering at a local primary school. Real teaching experience at 17 is formative.', activities: ['Volunteer teacher at a local school', 'Create a YouTube explanation video', 'Build a simple quiz app'] },
      { age_range: '20–24', phase: 'Career Entry', skills: ['Curriculum design', 'Classroom management', 'CBC portfolio assessment', 'AI lesson prep tools', 'Inclusive education'], why: 'Teaching practice (TP) is where theory meets reality. The best teachers are relentless learners themselves.', parent_action: 'Ensure they complete their Teaching Practice in a diverse school — urban and rural experience both matter.', activities: ['TP in a government school', 'KESI professional development', 'EdTech startup internship'] },
    ],
    future_skills: ['AI-augmented lesson design', 'Learning analytics', 'Social-emotional learning facilitation', 'Inclusive education', 'EdTech product design'],
    kenya_examples: [
      { name: 'Zeraki founders', what_they_did: 'Built Kenya\'s most widely used school management and analytics platform, turning teachers into data-informed educators', started_from: 'JKUAT engineering graduates who saw a school problem', door: 'entrepreneurship' },
      { name: 'Teach For Kenya teachers', what_they_did: 'University graduates teaching in underserved communities and going on to build education policy and EdTech careers', started_from: 'Various university backgrounds', door: 'employment' },
    ],
    disclaimer: D,
  },

  // ── 6. ENTREPRENEUR / BUSINESS OWNER ─────────────────────────────────────────
  {
    slug: 'entrepreneur-business',
    title: 'Entrepreneur / Business Owner',
    category: 'business',
    pathway: 'Social',
    description: 'Kenya is one of Africa\'s most entrepreneurial countries. From the mama mboga who uses M-Pesa to the founder raising millions at a Nairobi accelerator, entrepreneurship is embedded in Kenyan culture. This career is not a fallback — it is a deliberate choice to create value, jobs, and wealth.',
    doors: [
      {
        type: 'employment',
        title: 'Corporate / SME Business Role',
        description: 'Work in business development, sales, operations, or strategy at a company before launching your own. The best entrepreneurs often learn fundamentals at a corporate job first.',
        salary_tiers: {
          entry:  { min: 60000,  max: 120000, label: 'Junior Executive / Sales Rep (0-2 years)' },
          mid:    { min: 120000, max: 300000, label: 'Manager / Business Developer (3-5 years)' },
          senior: { min: 300000, max: 600000, label: 'Director / C-Suite (5+ years)' },
          note: 'Corporate Nairobi rates. Bonuses and commissions can double base salary.',
          kenya_context: KC, salary_growth_note: SGN_PROF,
        },
        employers: ['Safaricom', 'Equity Bank', 'KCB', 'Unilever Kenya', 'Coca-Cola East Africa', 'Jumia Kenya'],
        time_to_first_job: '4 years (business degree) or immediately with strong hustle skills',
      },
      {
        type: 'self_employment',
        title: 'Independent Business Owner (SME)',
        description: 'Run a business in retail, services, consultancy, or any sector. Kenya\'s 7.4 million SMEs are the backbone of the economy.',
        startup_cost_kes: { min: 5000, max: 500000 },
        platforms: ['M-Pesa business', 'WhatsApp/Facebook business', 'Jiji.co.ke', 'Jumia marketplace', 'Direct sales'],
      },
      {
        type: 'entrepreneurship',
        title: 'Build a Scalable Startup',
        description: 'Build a company that solves a problem at scale — technology, consumer products, logistics, healthcare. The Nairobi startup ecosystem is East Africa\'s most advanced.',
        kenya_examples: ['Equity Bank (started as a small SACCO)', 'Bidco Africa', 'Java House', 'Naivas Supermarkets'],
        market_size: 'Kenya GDP KES 15 trillion — opportunities in every sector, domestic market of 55M people',
        earnings_note: ENTREP_NOTE,
      },
      {
        type: 'ai_era',
        title: 'AI-Powered Business Operator',
        description: 'Use AI tools to run a lean, highly efficient business that previously needed a large team. One person with AI tools can now do what required 5 people.',
        ai_opportunity: 'AI gives small businesses superpowers: 24/7 customer service chatbots, automated accounting, market analysis, content creation at scale, and demand forecasting. The entrepreneur who learns these tools can compete with much larger companies.',
        skills_needed: ['AI business automation tools', 'Prompt engineering for business', 'Digital marketing with AI', 'Data analysis'],
        early_mover_advantage: true,
      },
    ],
    ai_impact: {
      level: 'low',
      replacing: ['Basic bookkeeping and data entry', 'Standard customer service responses', 'Simple market research reports', 'Basic content writing for social media'],
      creating: ['AI-powered micro-businesses with one person serving 1,000+ customers', 'New product categories enabled by AI (AI tutors, AI health assistants)', 'Consultancies that sell AI expertise to traditional businesses', 'AI reseller and implementation businesses'],
      human_advantage: ['Building relationships and trust', 'Reading market opportunities others miss', 'Negotiating deals with suppliers and partners', 'Managing and motivating teams', 'Creative problem-solving in new situations'],
      timeline: 'AI tools are already available and affordable (2024). Entrepreneurs who adopt them early will have significant cost advantages over competitors within 2 years.',
      honest_summary: 'AI is giving small businesses superpowers they previously couldn\'t afford: 24/7 customer service, automated accounting, market analysis, content creation, and demand forecasting. The entrepreneur who learns to use these tools can compete with much larger companies. The opportunity is enormous for those who act early.',
    },
    kenya_market_outlook: 'Kenya ranks among Africa\'s top 5 startup ecosystems. M-Pesa enables instant payments. iHub, Nairobi Garage, and GrowthAfrica support startups. Youth unemployment (35%+) is pushing young Kenyans into self-employment. Government programs like Kazi Njenga and Youth Enterprise Fund provide capital.',
    salary_range_kes: null,
    required_subjects: ['mathematics', 'english', 'business_studies', 'economics'],
    subject_importance: { mathematics: 'important', english: 'critical', business_studies: 'important', economics: 'helpful' },
    skill_timeline: [
      { age_range: '10–13', phase: 'Foundation', skills: ['Selling (snacks, crafts, services)', 'Basic money management', 'Identifying problems people have', 'Negotiation basics'], why: 'The best entrepreneurs often sold things as children. This is not a bad thing — it\'s training.', parent_action: 'Let them run a small business — tuck shop, crafts sale at a school event. Don\'t give them all the capital. Let them solve funding problems.', activities: ['School tuck shop management', 'Fundraiser stall', 'Track pocket money in a notebook'] },
      { age_range: '14–16', phase: 'Building', skills: ['Business Studies and Economics', 'Financial literacy (budget, profit, loss)', 'Communication and persuasion', 'Social media for business'], why: 'Understanding money, markets, and customers is the foundation of any business.', parent_action: 'Open a savings account with them. Show them how to read a simple financial statement. Let them see your household budget.', activities: ['Start a side hustle', 'Run a school club like a business', 'Junior Achievement Kenya'] },
      { age_range: '17–19', phase: 'Specializing', skills: ['Business plan writing', 'Customer discovery interviews', 'Basic accounting', 'Digital marketing', 'Pitching to investors'], why: 'University years or gap year is prime time to test a first business without major risk.', parent_action: 'Don\'t dismiss their "crazy" business idea. Help them research it instead of just saying no. Failure at 18 teaches more than any course.', activities: ['Enter Hult Prize or GSEA', 'Build an MVP', 'Apply to Nailab or iHub youth program'] },
      { age_range: '20–24', phase: 'Career Entry', skills: ['Sales and revenue generation', 'Team building', 'Cash flow management', 'AI business tools', 'Investor relations'], why: 'The difference between a startup and a hobby is paying customers. Obsess over sales early.', parent_action: 'Help them find a mentor — one person who has built a similar business is worth 10 courses. Introductions matter enormously in Kenya.', activities: ['First 100 paying customers', 'Apply for Equity Bank SME loan', 'Join a business accelerator'] },
    ],
    future_skills: ['AI tools for business automation', 'Digital marketing and e-commerce', 'Data analytics for decisions', 'Climate-smart business models', 'East Africa regional market expansion'],
    kenya_examples: [
      { name: 'Vimal Shah (Bidco Africa)', what_they_did: 'Grew a Kenyan cooking oil company into East Africa\'s largest FMCG manufacturer employing thousands', started_from: 'Family duka in Nairobi\'s industrial area', door: 'entrepreneurship' },
      { name: 'Naivas Supermarkets', what_they_did: 'The Mukuha family grew Naivas from one shop to Kenya\'s largest supermarket chain with 90+ branches', started_from: 'A single shop in Naivasha', door: 'entrepreneurship' },
    ],
    disclaimer: D,
  },

  // ── 7. JOURNALIST / CONTENT CREATOR ──────────────────────────────────────────
  {
    slug: 'journalist-content-creator',
    title: 'Journalist / Content Creator',
    category: 'media',
    pathway: 'Arts',
    description: 'Journalists investigate, report, and explain the world. Content creators build audiences around their ideas, expertise, and personality. In Kenya, the media landscape is shifting fast — from Nation and KBC to YouTube channels, podcasts, and X (Twitter) with hundreds of thousands of followers.',
    doors: [
      {
        type: 'employment',
        title: 'Journalist at Media House',
        description: 'Report for newspapers, TV stations, online publications, or international outlets. Kenya has a vibrant professional journalism ecosystem.',
        salary_tiers: {
          entry:  { min: 35000, max: 65000,  label: 'Junior Reporter (0-2 years)' },
          mid:    { min: 65000, max: 150000, label: 'Senior Reporter / Correspondent (3-5 years)' },
          senior: { min: 150000, max: 400000, label: 'Editor / Bureau Chief (5+ years)' },
          note: 'Media house rates. Top content creators earn 500K–2M+/month through multiple income streams.',
          kenya_context: KC, salary_growth_note: SGN_PROF,
        },
        employers: ['Nation Media Group', 'Standard Group', 'NTV', 'Citizen TV', 'BBC Africa', 'Reuters Africa', 'The Continent'],
        time_to_first_job: '4 years (journalism degree) or immediately with a strong portfolio',
      },
      {
        type: 'self_employment',
        title: 'Freelance Journalist / Independent Creator',
        description: 'Write for multiple publications, build a newsletter, or run a monetized YouTube/podcast. Many Kenyan creators earn above average salaries through their own platforms.',
        startup_cost_kes: { min: 15000, max: 80000 },
        platforms: ['YouTube', 'Substack newsletter', 'TikTok', 'Twitter/X', 'Podcast platforms', 'Freelance on Contently or Journo Portfolio'],
      },
      {
        type: 'entrepreneurship',
        title: 'Start a Media Business',
        description: 'Build a media company, podcast network, YouTube channel network, or digital publication. The barrier to entry has never been lower.',
        kenya_examples: ['Shujaaz Inc (youth media)', 'Kuza Biashara (business content)', 'Churchill Show (talent network)', 'PowerFM Kenya (radio startup)'],
        market_size: 'Kenya digital media advertising KES 15B+ and growing; Africa creator economy worth $4.2B',
        earnings_note: ENTREP_NOTE,
      },
      {
        type: 'ai_era',
        title: 'AI-Augmented Journalist / Data Journalist',
        description: 'Use AI tools to analyze large datasets, transcribe interviews, research stories faster, and produce data visualizations that tell compelling stories.',
        ai_opportunity: 'AI can process thousands of government documents, identify patterns in financial data, and translate sources — tasks that previously needed a team. One journalist with AI tools can do investigative work that previously required five people.',
        skills_needed: ['Data journalism basics', 'AI research and fact-checking tools', 'Data visualization', 'FOIA/public records requests'],
        early_mover_advantage: true,
      },
    ],
    ai_impact: {
      level: 'high',
      replacing: ['Basic news summaries from press releases', 'Sports score reports and financial data reports', 'Transcription of interviews', 'Writing simple event previews and recaps'],
      creating: ['AI-assisted investigative data journalism', 'Real-time multilingual publishing', 'Interactive storytelling formats', 'Personalized news curation products'],
      human_advantage: ['Source cultivation and trust (off-record relationships)', 'Investigative judgment — knowing what to look for', 'Editorial decision-making (what is actually important)', 'Accountability journalism requiring courage and legal exposure', 'Cultural and political context understanding'],
      timeline: 'AI is already writing basic news stories at major outlets (2024). By 2027, most routine content will be AI-generated. Investigative, explanatory, and human-interest journalism will remain human.',
      honest_summary: 'AI writes press releases and basic news summaries. But investigative journalism, source relationships, editorial judgment, and storytelling that moves audiences are deeply human. The threat is to low-skill content churning. The opportunity is for journalists who use AI to produce better, faster, more data-driven stories.',
    },
    kenya_market_outlook: 'Kenya has a vibrant media ecosystem. YouTube monetization works in Kenya. Podcasting is growing. Brands pay Kenyan content creators for sponsorships. Journalism as a social justice tool is growing via organizations like InformAction and Code for Kenya.',
    salary_range_kes: {
      entry:  { min: 35000, max: 65000,  label: 'Junior Reporter (0-2 years)' },
      mid:    { min: 65000, max: 150000, label: 'Senior Reporter / Correspondent (3-5 years)' },
      senior: { min: 150000, max: 400000, label: 'Editor / Bureau Chief (5+ years)' },
      note: 'Media house rates. Top content creators earn 500K–2M+/month through multiple income streams.',
      kenya_context: KC, salary_growth_note: SGN_PROF,
    },
    required_subjects: ['english', 'kiswahili', 'history', 'computer_studies'],
    subject_importance: { english: 'critical', kiswahili: 'important', history: 'helpful', computer_studies: 'helpful' },
    skill_timeline: [
      { age_range: '10–13', phase: 'Foundation', skills: ['Reading widely', 'Telling stories clearly', 'Asking good questions', 'Basic writing'], why: 'Journalists are voracious readers before they become writers. The habit starts here.', parent_action: 'Subscribe to a newspaper (even digital). Read and discuss current events with your child regularly. Curiosity about the world is the raw material.', activities: ['School newspaper club', 'Daily journal writing', 'Interview a family member about their life'] },
      { age_range: '14–16', phase: 'Building', skills: ['Essay writing and argumentation', 'Photography basics', 'School radio or journalism club', 'Social media literacy'], why: 'Craft development. Writing, photography, and media literacy are the tools.', parent_action: 'Encourage the school journalism club or starting a class newsletter. Writing for an audience — even 20 classmates — is genuine practice.', activities: ['School blog', 'Writing competition', 'Basic video editing on phone'] },
      { age_range: '17–19', phase: 'Specializing', skills: ['Investigative research', 'Video production basics', 'Podcast creation', 'Data journalism basics', 'Building an audience'], why: 'Portfolio beats a degree in journalism. Start publishing now.', parent_action: 'Help them set up a free YouTube channel or podcast. The first 10 videos are always rough — normalize that. Consistency over perfection.', activities: ['YouTube channel or podcast', 'Freelance for a local newspaper', 'Cover a community story'] },
      { age_range: '20–24', phase: 'Career Entry', skills: ['Source cultivation and ethics', 'Video editing (Premiere)', 'SEO and analytics', 'Monetization strategies', 'AI fact-checking tools'], why: 'The audience size and portfolio at this age determines career trajectory.', parent_action: 'Help them get their first byline in a real publication — even a community newspaper. The credibility cascade starts with one real credit.', activities: ['Internship at NTV or Nation', 'Google News Initiative training', 'Build to 1,000 YouTube subscribers'] },
    ],
    future_skills: ['Data journalism and visualization', 'AI-assisted research', 'Multimedia storytelling', 'Audience monetization', 'Investigative accountability journalism'],
    kenya_examples: [
      { name: 'John-Allan Namu', what_they_did: 'Built Africa Uncensored, an investigative journalism outlet producing award-winning documentaries on corruption', started_from: 'NTV journalist who went independent', door: 'entrepreneurship' },
      { name: 'NTV investigative team', what_they_did: 'Kenyan investigative journalists have broken major corruption stories that removed officials from office', started_from: 'Daystar and UoN journalism graduates', door: 'employment' },
    ],
    disclaimer: D,
  },

  // ── 8. ENVIRONMENTAL SCIENTIST ────────────────────────────────────────────────
  {
    slug: 'environmental-scientist',
    title: 'Environmental Scientist',
    category: 'environment',
    pathway: 'STEM',
    description: 'Environmental scientists study ecosystems, climate, water, and the impact of human activity on the natural world. Kenya\'s environmental challenges — deforestation, water scarcity, climate change, and plastic pollution — make this one of the most important careers of the 21st century.',
    doors: [
      {
        type: 'employment',
        title: 'Government or NGO Environmental Officer',
        description: 'Work for NEMA, county governments, or international NGOs managing environmental compliance, conservation, and policy.',
        salary_tiers: {
          entry:  { min: 50000,  max: 90000,  label: 'Field Officer / Graduate (0-2 years)' },
          mid:    { min: 90000,  max: 200000, label: 'Environmental Officer (3-5 years)' },
          senior: { min: 200000, max: 450000, label: 'Senior / Programme Manager (5+ years)' },
          note: 'NGO and UN rates are notably higher than government. Carbon credit consultants earn significantly more.',
          kenya_context: KC, salary_growth_note: SGN_PROF,
        },
        employers: ['NEMA (National Environment Management Authority)', 'KWS (Kenya Wildlife Service)', 'UNEP (HQ in Nairobi)', 'WWF Kenya', 'WCS Kenya', 'Nature Kenya'],
        time_to_first_job: '4 years (BSc) or 2 years (diploma)',
      },
      {
        type: 'self_employment',
        title: 'Environmental Impact Assessment Consultant',
        description: 'Conduct EIAs for construction projects (required by law in Kenya). Independent EIA experts are in consistent demand.',
        startup_cost_kes: { min: 80000, max: 300000 },
        platforms: ['NEMA accreditation', 'Government tenders', 'Construction company contracts', 'Professional referral network'],
      },
      {
        type: 'entrepreneurship',
        title: 'Green Business / Carbon Credit Company',
        description: 'Build a business around sustainability: recycling, clean energy, carbon credits, eco-tourism, or organic farming certification.',
        kenya_examples: ['Sanergy (waste management)', 'M-KOPA Solar', 'BURN Manufacturing (clean cookstoves)', 'Africa Eco Travel', 'PureLiving Kenya'],
        market_size: 'Global carbon market KES 5 trillion by 2030 — Kenya is positioned as a key supplier through forests and clean energy',
        earnings_note: ENTREP_NOTE,
      },
      {
        type: 'ai_era',
        title: 'Climate Data Analyst / Remote Sensing Specialist',
        description: 'Use satellite data, AI monitoring tools, and climate models to track environmental change and advise decision-makers.',
        ai_opportunity: 'AI tools process satellite imagery to detect deforestation, water quality changes, and wildlife population shifts faster and cheaper than field surveys. Kenya\'s rich biodiversity makes it a global research priority.',
        skills_needed: ['GIS and satellite data', 'Python or R for data analysis', 'Remote sensing tools (Google Earth Engine)', 'Climate model interpretation'],
        early_mover_advantage: true,
      },
    ],
    ai_impact: {
      level: 'low',
      replacing: ['Manual counting of species in field surveys', 'Basic water quality data entry', 'Standard EIA report templates', 'Simple pollution monitoring reports'],
      creating: ['AI satellite monitoring of deforestation at scale', 'Real-time wildlife tracking and anti-poaching systems', 'Climate adaptation planning using predictive models', 'Carbon credit verification using remote sensing'],
      human_advantage: ['Community trust and cultural engagement', 'Field work in remote areas', 'Environmental policy advocacy and lobbying', 'Ethical decisions in complex conservation trade-offs', 'Local ecological knowledge and relationships'],
      timeline: 'AI environmental monitoring is rapidly expanding in Africa (2025–2028). Field scientists remain essential but will increasingly use AI as a force multiplier.',
      honest_summary: 'AI is used for satellite monitoring of deforestation, climate modelling, wildlife tracking, and water quality analysis. Environmental scientists who can work with these tools will be far more effective. The fieldwork, community engagement, policy advocacy, and ethical dimensions of environmental work remain entirely human.',
    },
    kenya_market_outlook: 'Kenya is a global leader in environmental conservation. UNEP is headquartered in Nairobi. NGOs, government, and the private sector (carbon credits, eco-tourism) all employ environmental scientists. Climate finance is growing rapidly and Kenya is well-positioned to access it.',
    salary_range_kes: {
      entry:  { min: 50000,  max: 90000,  label: 'Field Officer / Graduate (0-2 years)' },
      mid:    { min: 90000,  max: 200000, label: 'Environmental Officer (3-5 years)' },
      senior: { min: 200000, max: 450000, label: 'Senior / Programme Manager (5+ years)' },
      note: 'NGO and UN rates notably higher than government. Carbon credit consultants earn significantly more.',
      kenya_context: KC, salary_growth_note: SGN_PROF,
    },
    required_subjects: ['biology', 'chemistry', 'geography', 'mathematics'],
    subject_importance: { biology: 'critical', chemistry: 'important', geography: 'critical', mathematics: 'helpful' },
    skill_timeline: [
      { age_range: '10–13', phase: 'Foundation', skills: ['Appreciation of nature', 'Understanding ecosystems', 'Recycling habits', 'Curiosity about climate'], why: 'Environmental scientists often trace their careers to a childhood love of nature.', parent_action: 'Visit a national park or nature reserve. Start a home recycling program. Talk about climate change honestly and constructively.', activities: ['School nature club', 'Visit a national park', 'School recycling program'] },
      { age_range: '14–16', phase: 'Building', skills: ['Biology (ecology)', 'Geography (climate, water systems)', 'Chemistry (pollution)', 'Environmental news awareness'], why: 'Science foundation years. Environmental science requires all three sciences plus geography.', parent_action: 'Water quality testing kits are available at hardware stores — doing real tests is memorable science education.', activities: ['Water quality testing project', 'Tree planting initiative', 'Report on a local environmental issue'] },
      { age_range: '17–19', phase: 'Specializing', skills: ['GIS mapping basics', 'Environmental law awareness', 'Field research methods', 'Data collection and analysis', 'Grant writing basics'], why: 'Field skills and policy understanding set you apart.', parent_action: 'Help them volunteer with a local conservation NGO — even one day per month builds connections and a portfolio.', activities: ['Volunteer with a conservation NGO', 'Environmental audit of school', 'Kenya Youth Environmental Network'] },
      { age_range: '20–24', phase: 'Career Entry', skills: ['Environmental Impact Assessment (EIA)', 'Climate data analysis', 'Carbon credit methodology', 'Community engagement', 'Donor report writing'], why: 'EIA certification unlocks most Kenyan environmental jobs. Get it early.', parent_action: 'Help them navigate NEMA internship and accreditation pathways — bureaucratic but essential.', activities: ['NEMA internship', 'Fieldwork with UNEP Kenya', 'Apply for climate finance research grants'] },
    ],
    future_skills: ['Carbon credit assessment and trading', 'Climate adaptation planning', 'Satellite data and remote sensing', 'Environmental finance and ESG reporting', 'Community climate resilience'],
    kenya_examples: [
      { name: 'Wangari Maathai (legacy)', what_they_did: 'Nobel Peace Prize winner who planted 47 million trees through the Green Belt Movement', started_from: 'University of Nairobi Biology lecturer', door: 'entrepreneurship' },
      { name: 'UNEP Kenya scientists', what_they_did: 'Hundreds of Kenyan environmental scientists work at the UN headquarters in Nairobi, influencing global policy', started_from: 'Kenyan university graduates in environmental sciences', door: 'employment' },
    ],
    disclaimer: D,
  },

  // ── 9. GRAPHIC DESIGNER / CREATIVE TECHNOLOGIST ──────────────────────────────
  {
    slug: 'graphic-designer-creative-technologist',
    title: 'Graphic Designer / Creative Technologist',
    category: 'creative',
    pathway: 'Creative',
    description: 'Designers create the visual communication that makes brands, products, and ideas understood. Creative technologists combine design with coding to build interactive experiences. In Kenya, the demand for design spans advertising, packaging, app design, film, and fashion — and it\'s growing.',
    doors: [
      {
        type: 'employment',
        title: 'Designer at Agency or Tech Company',
        description: 'Join an advertising agency, design studio, tech startup, or brand as an in-house designer.',
        salary_tiers: {
          entry:  { min: 40000,  max: 80000,  label: 'Junior Designer (0-2 years)' },
          mid:    { min: 80000,  max: 200000, label: 'Mid-Weight Designer (3-5 years)' },
          senior: { min: 200000, max: 450000, label: 'Senior / Creative Director (5+ years)' },
          note: 'Nairobi agency rates. Top freelancers earn 400K–1M+/month.',
          kenya_context: KC, salary_growth_note: SGN_TECH,
        },
        employers: ['Ogilvy Nairobi', 'Scanad Kenya', 'McCann Nairobi', 'Safaricom design team', 'Equity Bank UX team', 'Nairobi-based startups'],
        time_to_first_job: '4 years (BA design) or 1 year (portfolio-driven self-taught path)',
      },
      {
        type: 'self_employment',
        title: 'Freelance Designer',
        description: 'Work with multiple clients on branding, UI/UX, social media graphics, or motion design. Freelance design is one of the most accessible remote-work careers from Nairobi.',
        startup_cost_kes: { min: 30000, max: 100000 },
        platforms: ['Behance portfolio', 'Dribbble', 'Fiverr', 'Upwork', 'LinkedIn', 'Instagram (design portfolio)'],
      },
      {
        type: 'entrepreneurship',
        title: 'Creative Studio or Design Business',
        description: 'Build a design agency, branded merchandise business, or creative studio. Kenya\'s growing middle class and expanding startup ecosystem are hungry for quality design.',
        kenya_examples: ['Bold Design Studio Nairobi', 'Shujaaz Inc (creative agency)', 'Studio Ang (African print fashion)', 'Pixel8 Creative'],
        market_size: 'Africa creative economy KES 550B+ growing at 12% annually',
        earnings_note: ENTREP_NOTE,
      },
      {
        type: 'ai_era',
        title: 'AI Creative Director / Prompt Artist',
        description: 'Direct AI image generation tools (Midjourney, Adobe Firefly, DALL-E) to create designs faster and pitch more clients. The best designers use AI to amplify, not replace, their creativity.',
        ai_opportunity: 'Brands need AI-generated content at scale — social media, advertising, product visuals. A designer who speaks both human creativity and AI prompting languages can produce more in a day than a team previously produced in a week.',
        skills_needed: ['AI image generation tools (Midjourney, Firefly)', 'Prompt engineering for visuals', 'Brand strategy to direct AI effectively', 'AI video editing tools (Runway ML)'],
        early_mover_advantage: true,
      },
    ],
    ai_impact: {
      level: 'high',
      replacing: ['Generic stock illustration creation', 'Basic logo drafts', 'Simple social media graphics from templates', 'Photo retouching and background removal'],
      creating: ['Art direction of AI-generated campaigns', 'Brand identity systems for AI-native businesses', 'Motion graphics and AI video content', 'African visual identity work (AI trained on Western datasets needs human African context)'],
      human_advantage: ['Brand strategy and positioning', 'Understanding cultural context (Kenyan/African aesthetics)', 'Client relationship and creative direction', 'UI/UX empathy — understanding user behavior', 'Innovation in visual storytelling'],
      timeline: 'AI image generation already disrupting stock photography and basic design (2024). By 2026, designers who cannot use AI tools will be uncompetitive. Senior creative direction roles remain human.',
      honest_summary: 'AI image generation (Midjourney, Adobe Firefly) is changing graphic design. Basic logo creation and stock illustration are automating. But brand strategy, UI/UX design, motion graphics, and creative direction require human judgment and cultural understanding. Designers who use AI tools will produce work faster and charge more.',
    },
    kenya_market_outlook: 'Kenya\'s advertising industry, film sector (growing Nollywood-adjacent), and startup ecosystem all employ designers. Freelance design on Upwork and Fiverr is accessible from Nairobi. The African creative economy is worth $4.2B and growing.',
    salary_range_kes: {
      entry:  { min: 40000,  max: 80000,  label: 'Junior Designer (0-2 years)' },
      mid:    { min: 80000,  max: 200000, label: 'Mid-Weight Designer (3-5 years)' },
      senior: { min: 200000, max: 450000, label: 'Senior / Creative Director (5+ years)' },
      note: 'Nairobi agency rates. Top freelancers earn 400K–1M+/month.',
      kenya_context: KC, salary_growth_note: SGN_TECH,
    },
    required_subjects: ['art_and_design', 'computer_studies', 'english', 'mathematics'],
    subject_importance: { art_and_design: 'critical', computer_studies: 'important', english: 'important', mathematics: 'helpful' },
    skill_timeline: [
      { age_range: '10–13', phase: 'Foundation', skills: ['Drawing and sketching daily', 'Color awareness', 'Photography basics (phone camera)', 'Visual storytelling (comics, posters)'], why: 'Design starts with observation. Children who draw and notice are building the foundation.', parent_action: 'Get a sketchbook. Let them draw every day — even 5 minutes. Hang their posters on the wall. Visual confidence starts at home.', activities: ['Daily sketchbook', 'Design school posters', 'Phone photography projects'] },
      { age_range: '14–16', phase: 'Building', skills: ['Canva and free design tools', 'Typography fundamentals', 'Art classes at school', 'Basic video editing'], why: 'Transition from pen-and-paper to digital tools. Canva is a great starting point.', parent_action: 'Let them redesign the family WhatsApp group photo or create event posters. Real audiences build real skills.', activities: ['Design school and family graphics', 'Art competitions', 'Create a portfolio folder'] },
      { age_range: '17–19', phase: 'Specializing', skills: ['Adobe Photoshop and Illustrator', 'Figma for UI/UX', 'Logo and brand identity', 'Motion graphics basics', 'Client work'], why: 'Portfolio is everything. Designers with 20 real client pieces beat those with a degree and no work.', parent_action: 'Help them offer free designs to local NGOs or businesses — real portfolio pieces, not school assignments.', activities: ['Free designs for NGOs', 'Behance/Dribbble portfolio', 'Freelance on Fiverr'] },
      { age_range: '20–24', phase: 'Career Entry', skills: ['UI/UX and user research', 'Motion graphics (After Effects)', 'Brand strategy', 'AI design tools (Midjourney)', 'Creative direction basics'], why: 'Senior designers understand business and users — not just aesthetics.', parent_action: 'Help them build a 10-piece portfolio that demonstrates range. The first agency hire is based almost entirely on portfolio.', activities: ['Work at a design studio', 'Build a product from design to launch', 'Mentor junior designers'] },
    ],
    future_skills: ['AI-augmented design workflows', 'Motion design and 3D (Blender)', 'UX research', 'Design systems at scale', 'African visual identity work'],
    kenya_examples: [
      { name: 'Bold Design Studio Nairobi', what_they_did: 'Award-winning design studio behind some of East Africa\'s most recognized brand identities', started_from: 'University of Nairobi Fine Art graduates', door: 'entrepreneurship' },
      { name: 'Shujaaz Inc creative team', what_they_did: 'Use comics and media to reach 4M+ young Kenyans with life skills content', started_from: 'Graphic designers who saw a communication gap', door: 'entrepreneurship' },
    ],
    disclaimer: D,
  },

  // ── 10. ACCOUNTANT / FINANCIAL ANALYST ───────────────────────────────────────
  {
    slug: 'accountant-financial-analyst',
    title: 'Accountant / Financial Analyst',
    category: 'finance',
    pathway: 'Social',
    description: 'Accountants and financial analysts manage, analyze, and report on money. Every organization — hospital, NGO, startup, government, or corporation — needs this skill. In Kenya, CPA qualification opens doors in both employment and consulting across East Africa.',
    doors: [
      {
        type: 'employment',
        title: 'Accountant / Finance Manager',
        description: 'Work in finance departments across industries — banking, manufacturing, NGOs, government, tech. Every organization needs financial management.',
        salary_tiers: {
          entry:  { min: 60000,  max: 120000, label: 'Graduate Accountant (0-2 years)' },
          mid:    { min: 120000, max: 300000, label: 'Senior Accountant / Finance Officer (3-5 years)' },
          senior: { min: 300000, max: 600000, label: 'Finance Manager / CFO (5+ years)' },
          note: 'Big 4 and banking sector rates. CFOs at major companies earn 800K–2M.',
          kenya_context: KC, salary_growth_note: SGN_PROF,
        },
        employers: ['KPMG', 'Deloitte', 'EY', 'PwC', 'KCB', 'Equity Bank', 'Safaricom Finance', 'NGOs (USAID, UN)', 'Manufacturing companies'],
        time_to_first_job: '3 years (CPA Foundation through Final) or 4 years (BCom Accounting)',
      },
      {
        type: 'self_employment',
        title: 'Accounting Consultant / Tax Advisor',
        description: 'Provide bookkeeping, tax filing, audit, and financial advisory services to SMEs. Most Kenyan businesses need this but cannot afford a full-time accountant.',
        startup_cost_kes: { min: 30000, max: 100000 },
        platforms: ['KRA iTax (for filing)', 'QuickBooks/Xero client systems', 'LinkedIn professional network', 'Local business associations'],
      },
      {
        type: 'entrepreneurship',
        title: 'Fintech Startup / Financial Services Business',
        description: 'Build a financial technology or advisory business. The gap between where Kenya\'s financial sector is and where it needs to be is enormous.',
        kenya_examples: ['M-KOPA (asset finance)', 'Pezesha (SME lending)', 'Kopo Kopo (merchant payments)', 'Chumz (savings app)'],
        market_size: 'Kenya fintech sector KES 200B+ — one of Africa\'s most active fintech ecosystems',
        earnings_note: ENTREP_NOTE,
      },
      {
        type: 'ai_era',
        title: 'AI Financial Analyst / CFO Advisor',
        description: 'Use AI tools to analyze financial data, build models faster, and provide strategic advisory that previously required a team.',
        ai_opportunity: 'AI tools (QuickBooks AI, CoPilot for Excel) automate bookkeeping and basic reporting. An accountant who pivots to strategic financial advisory — using AI for the routine work — commands premium fees that basic bookkeepers cannot.',
        skills_needed: ['AI accounting software mastery', 'Financial modeling (Excel advanced)', 'ESG and sustainability reporting', 'Business intelligence tools (Power BI)'],
        early_mover_advantage: false,
      },
    ],
    ai_impact: {
      level: 'high',
      replacing: ['Manual ledger bookkeeping', 'Bank reconciliation by hand', 'Basic payroll processing', 'Standard tax computation for simple cases', 'Routine financial statement preparation'],
      creating: ['AI-powered financial forecasting', 'ESG (environmental, social, governance) reporting roles', 'Blockchain and digital asset accounting', 'Real-time financial analytics dashboard management', 'Strategic CFO advisory for SMEs'],
      human_advantage: ['Complex tax planning requiring judgment', 'Audit work requiring professional skepticism', 'Forensic accounting investigations', 'Advising businesses on major financial decisions', 'Building client trust and maintaining confidentiality'],
      timeline: 'AI accounting tools are already used by Kenya\'s Big 4 firms (2024). Basic bookkeeping is automating now. Strategic advisory work will remain human for 10+ years.',
      honest_summary: 'AI and accounting software are automating data entry, bank reconciliation, and basic tax filing. This eliminates low-skill bookkeeping. But financial analysis, strategic advisory, audit work, and forensic accounting require judgment, ethics, and communication that AI cannot replace. The bar has risen, not fallen.',
    },
    kenya_market_outlook: 'Kenya has one of Africa\'s most developed financial sectors: NSE, major commercial banks, Big 4 audit firms, and a growing fintech ecosystem. CPA Kenya qualification is valued across East Africa. Treasury and county government finance departments need thousands of qualified accountants.',
    salary_range_kes: {
      entry:  { min: 60000,  max: 120000, label: 'Graduate Accountant (0-2 years)' },
      mid:    { min: 120000, max: 300000, label: 'Senior Accountant / Finance Officer (3-5 years)' },
      senior: { min: 300000, max: 600000, label: 'Finance Manager / CFO (5+ years)' },
      note: 'Big 4 and banking sector rates. CFOs at major companies earn 800K–2M.',
      kenya_context: KC, salary_growth_note: SGN_PROF,
    },
    required_subjects: ['mathematics', 'english', 'business_studies', 'economics'],
    subject_importance: { mathematics: 'critical', english: 'important', business_studies: 'critical', economics: 'important' },
    skill_timeline: [
      { age_range: '10–13', phase: 'Foundation', skills: ['Basic arithmetic and mental math', 'Money management (budgets)', 'Pocket money tracking', 'Business curiosity'], why: 'Accountants need number fluency. Mental math habits built young are valuable throughout a career.', parent_action: 'Let them manage the household grocery budget for a month. Count change. Explain what profit and loss mean with simple examples.', activities: ['Household budget management', 'Income/expense tracking', 'Junior savings account'] },
      { age_range: '14–16', phase: 'Building', skills: ['Strong Mathematics', 'Business Studies (basic accounting)', 'Excel basics', 'Financial news awareness'], why: 'KCSE Mathematics directly determines accounting career options — this is non-negotiable.', parent_action: 'Build an Excel household budget together. Read the Business Daily financial section weekly. Numbers should feel familiar, not abstract.', activities: ['Accounts club at school', 'Build a budget in Excel', 'Business Daily newspaper'] },
      { age_range: '17–19', phase: 'Specializing', skills: ['CPA Foundation preparation', 'Double-entry bookkeeping', 'Financial statements', 'Kenya VAT and PAYE basics', 'QuickBooks free trial'], why: 'Starting CPA Foundation at 18 means qualifying by 21 — a significant career advantage.', parent_action: 'Starting CPA Foundation while still doing A-levels is possible and smart. KASNEB registration is straightforward.', activities: ['Begin CPA Foundation self-study', 'Help a family business with accounts', 'Internship at a local accounting firm'] },
      { age_range: '20–24', phase: 'Career Entry', skills: ['Financial modelling (Excel advanced)', 'Audit procedures', 'Tax planning', 'AI financial tools', 'Strategic advisory communication'], why: 'Accountants who become CFOs understand business strategy, not just numbers.', parent_action: 'Push for Big 4 internship if possible — the training is excellent and the network is invaluable throughout a career.', activities: ['Big 4 audit internship', 'Complete CPA qualification', 'CFA Level 1 for financial analysis track'] },
    ],
    future_skills: ['Financial modelling and forecasting', 'ESG reporting', 'Blockchain accounting', 'AI finance tool integration', 'Strategic financial advisory'],
    kenya_examples: [
      { name: 'Equity Bank Kenya', what_they_did: 'Built one of Africa\'s most celebrated financial institutions, with Kenyan accountants and analysts holding top regional roles', started_from: 'CPA Kenya and university graduates', door: 'employment' },
      { name: 'M-KOPA finance team', what_they_did: 'Kenyan CPA accountants building the financial systems for a pan-African asset finance company serving 3M+ customers', started_from: 'KASNEB CPA qualification + university', door: 'employment' },
    ],
    disclaimer: D,
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
