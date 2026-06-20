// seed-cos-batch2.ts — COS metadata for the 25 remaining careers without required_capabilities
import { createServiceClient } from '../utils/supabase/service'
import type { CareerCapabilityRequirements, KCSEMinimum, CostToQualify, SocialReality } from '../lib/career/types'

type COSMeta = {
  required_capabilities:      CareerCapabilityRequirements
  capability_cluster:         string[]
  difficulty:                 'accessible' | 'moderate' | 'hard' | 'very_hard'
  kenya_demand:               'critical_shortage' | 'undersupplied' | 'balanced' | 'saturated'
  saturation_note?:           string
  kcse_minimum:               KCSEMinimum
  time_to_income_years:       number
  cost_to_qualify:            CostToQualify
  risk_level:                 'low' | 'medium' | 'high' | 'variable'
  prestige_level:             1 | 2 | 3 | 4 | 5
  social_reality:             SocialReality
  alternative_career_slugs:   string[]
  complementary_career_slugs: string[]
}

const BATCH2: Record<string, COSMeta> = {

  // ── BUSINESS ──────────────────────────────────────────────────────────────

  'tourism-safari-manager': {
    required_capabilities: {
      social_intelligence:  { minimum: 0.55, ideal: 0.80, weight: 0.30, note: 'Managing diverse guests and local communities requires high EQ and cultural sensitivity' },
      communication:        { minimum: 0.55, ideal: 0.80, weight: 0.25, note: 'Guiding, storytelling, negotiating with lodges and suppliers' },
      analytical_reasoning: { minimum: 0.35, ideal: 0.60, weight: 0.20, note: 'Logistics, route planning, cost management, wildlife pattern reading' },
      resilience:           { minimum: 0.40, ideal: 0.65, weight: 0.15, note: 'Remote camps, unpredictable weather, high-pressure guests demand composure' },
      creative_thinking:    { minimum: 0.35, ideal: 0.60, weight: 0.07, note: 'Designing unique experiences that stand out in a competitive market' },
      technical_aptitude:   { minimum: 0.20, ideal: 0.40, weight: 0.03, note: 'Booking systems, GPS tools, basic vehicle knowledge' },
    },
    capability_cluster:   ['social_intelligence', 'communication'],
    difficulty:           'moderate',
    kenya_demand:         'undersupplied',
    kcse_minimum: {
      overall_grade:  'C+',
      subject_grades: { english: 'B', geography: 'C+' },
      alternative_routes: ['Diploma in Tour Guiding (KWS-accredited)', 'Certificate in Hospitality Management', 'Start as a guide then manage'],
      note: 'Tourism & Hospitality degree or KWS guide certification are the standard paths. English fluency matters more than maths here.',
    },
    time_to_income_years: 2,
    cost_to_qualify: { min: 80000, max: 400000, note: 'Diploma: KES 80K–200K. Degree: KES 300K–800K. KWS guide cert: KES 30K–60K.' },
    risk_level:    'medium',
    prestige_level: 3,
    social_reality: {
      prestige_level: 3,
      common_misconception: 'This is just driving tourists around in a Land Cruiser',
      honest_reality_check: 'Top safari managers earn USD 2,000–5,000/month and operate lodges worth millions. It requires deep wildlife knowledge, business acumen, and world-class hospitality instincts.',
      parent_frame: {
        opening: 'Kenya\'s tourism industry earns over USD 1.5 billion annually — and needs skilled managers badly.',
        key_points: ['Tourism is one of Kenya\'s top foreign exchange earners', 'Safari manager salaries rival banking at senior level', 'Work can take you across East Africa and beyond'],
        honest_challenges: ['Seasonal income — low season can mean pay cuts', 'Remote postings away from family', 'Heavily affected by global events (pandemics, security alerts)'],
      },
    },
    alternative_career_slugs:   ['diplomat', 'event-planner', 'public-administrator'],
    complementary_career_slugs: ['environmental-scientist', 'journalist-content-creator'],
  },

  'human-resources': {
    required_capabilities: {
      social_intelligence:  { minimum: 0.55, ideal: 0.80, weight: 0.35, note: 'Understanding people, resolving conflicts, and building culture are the core of HR' },
      communication:        { minimum: 0.55, ideal: 0.80, weight: 0.30, note: 'Interviews, policy writing, mediation, training — all require precise clear communication' },
      analytical_reasoning: { minimum: 0.40, ideal: 0.65, weight: 0.20, note: 'Workforce planning, compensation benchmarking, and HR analytics need structured thinking' },
      resilience:           { minimum: 0.40, ideal: 0.65, weight: 0.08, note: 'Handling dismissals, conflict, and sensitive personal situations requires emotional steadiness' },
      creative_thinking:    { minimum: 0.30, ideal: 0.55, weight: 0.05, note: 'Designing retention programmes and culture initiatives that actually work' },
      technical_aptitude:   { minimum: 0.20, ideal: 0.40, weight: 0.02, note: 'HRIS systems, payroll software, data dashboards' },
    },
    capability_cluster:   ['social_intelligence', 'communication'],
    difficulty:           'moderate',
    kenya_demand:         'balanced',
    saturation_note:      'Entry-level HR is competitive but senior HR Business Partner and HR Director roles are undersupplied.',
    kcse_minimum: {
      overall_grade:  'C+',
      subject_grades: { english: 'B', business_studies: 'C+' },
      alternative_routes: ['CHRP Kenya (Certified HR Professional)', 'Diploma in HRM', 'Business degree + IHRM membership'],
      note: 'IHRM (Institute of Human Resource Management) certification is the Kenya professional standard. A degree opens corporate doors.',
    },
    time_to_income_years: 3,
    cost_to_qualify: { min: 150000, max: 600000, note: 'Business/HRM degree: KES 300K–800K. CHRP cert: KES 50K–100K. Diploma: KES 100K–200K.' },
    risk_level:    'low',
    prestige_level: 3,
    social_reality: {
      prestige_level: 3,
      common_misconception: 'HR just hires and fires people',
      honest_reality_check: 'Modern HR is a strategic business function. HR Directors sit on executive teams and influence how companies attract, develop, and retain talent — their biggest asset.',
      parent_frame: {
        opening: 'Every company with more than 10 employees eventually needs an HR professional to keep things running.',
        key_points: ['Stable employment across all industries', 'HR Director salary: KES 150K–400K/month in multinationals', 'Growing demand as Kenyan corporates professionalise'],
        honest_challenges: ['Entry-level HR can be administrative and slow-moving', 'Requires patience — culture change takes years', 'Dealing with people\'s problems daily can be emotionally draining'],
      },
    },
    alternative_career_slugs:   ['public-administrator', 'counselling-psychologist', 'social-worker-community-developer'],
    complementary_career_slugs: ['economist-policy-analyst', 'entrepreneur-business'],
  },

  'supply-chain-manager': {
    required_capabilities: {
      analytical_reasoning: { minimum: 0.55, ideal: 0.80, weight: 0.35, note: 'Optimising routes, forecasting demand, and solving logistics puzzles require rigorous analysis' },
      technical_aptitude:   { minimum: 0.45, ideal: 0.70, weight: 0.25, note: 'ERP systems, inventory software, procurement databases, and data analytics tools' },
      communication:        { minimum: 0.45, ideal: 0.70, weight: 0.20, note: 'Coordinating across suppliers, warehouses, customs agents, and internal teams' },
      resilience:           { minimum: 0.45, ideal: 0.70, weight: 0.12, note: 'Supply chains break — port delays, supplier failures, demand spikes. Composure is critical.' },
      social_intelligence:  { minimum: 0.35, ideal: 0.60, weight: 0.05, note: 'Negotiating with suppliers and managing cross-cultural vendor relationships' },
      creative_thinking:    { minimum: 0.30, ideal: 0.50, weight: 0.03, note: 'Finding alternative routes and solutions when the primary chain breaks' },
    },
    capability_cluster:   ['analytical_reasoning', 'technical_aptitude'],
    difficulty:           'moderate',
    kenya_demand:         'undersupplied',
    kcse_minimum: {
      overall_grade:  'C+',
      subject_grades: { mathematics: 'C+', business_studies: 'C+' },
      alternative_routes: ['Diploma in Procurement & Supply Chain', 'CIPS (Chartered Institute of Procurement & Supply)', 'Logistics degree'],
      note: 'CIPS qualification is globally recognised and highly valued in Kenya. Can enter via diploma then professionalise with CIPS.',
    },
    time_to_income_years: 3,
    cost_to_qualify: { min: 100000, max: 500000, note: 'Degree: KES 300K–700K. CIPS diploma: KES 80K–150K. Procurement diploma: KES 60K–120K.' },
    risk_level:    'low',
    prestige_level: 3,
    social_reality: {
      prestige_level: 3,
      common_misconception: 'Supply chain is just about warehouses and trucks',
      honest_reality_check: 'Supply chain managers control billions of shillings in goods movement. One good decision — or bad one — can save or cost a company millions. It\'s strategic, global, and increasingly digital.',
      parent_frame: {
        opening: 'Every product you buy — food, medicine, electronics — passed through a supply chain. Someone managed that.',
        key_points: ['One of the fastest-growing fields globally post-COVID', 'Kenya\'s position as East Africa\'s logistics hub creates huge demand', 'Senior SCM managers earn KES 200K–500K/month in multinationals'],
        honest_challenges: ['Can involve long hours during supply disruptions', 'Lots of coordination work before getting to strategy roles', 'Needs comfort with data and systems'],
      },
    },
    alternative_career_slugs:   ['accountant-financial-analyst', 'quantity-surveyor', 'economist-policy-analyst'],
    complementary_career_slugs: ['entrepreneur-business', 'agricultural-scientist'],
  },

  'diplomat': {
    required_capabilities: {
      communication:        { minimum: 0.65, ideal: 0.90, weight: 0.35, note: 'Diplomatic communication is the job — every word matters in negotiations' },
      social_intelligence:  { minimum: 0.65, ideal: 0.90, weight: 0.30, note: 'Reading rooms, building trust across cultures, and navigating political sensitivities' },
      analytical_reasoning: { minimum: 0.55, ideal: 0.80, weight: 0.20, note: 'Analysing geopolitical situations, economic treaties, and policy implications' },
      resilience:           { minimum: 0.50, ideal: 0.75, weight: 0.08, note: 'Postings to difficult environments, frequent relocation, and high-pressure negotiations' },
      creative_thinking:    { minimum: 0.40, ideal: 0.65, weight: 0.05, note: 'Finding compromise positions and creative solutions in deadlocked negotiations' },
      technical_aptitude:   { minimum: 0.20, ideal: 0.40, weight: 0.02, note: 'Report writing, research tools, and understanding technical domains in negotiations' },
    },
    capability_cluster:   ['communication', 'social_intelligence'],
    difficulty:           'very_hard',
    kenya_demand:         'balanced',
    saturation_note:      'Foreign Service entry is extremely competitive. Kenya has ~200 diplomatic posts globally. Quality over quantity.',
    kcse_minimum: {
      overall_grade:  'A-',
      subject_grades: { english: 'A-', history: 'B+', geography: 'B+' },
      alternative_routes: ['International Relations degree', 'Law degree + Foreign Service exam', 'Civil Service + internal transfer'],
      note: 'Kenyan Foreign Service entry requires competitive PSCK exams. A degree in IR, Law, or Political Science is standard. Languages (French, Kiswahili, Arabic) add significant advantage.',
    },
    time_to_income_years: 5,
    cost_to_qualify: { min: 400000, max: 1200000, note: 'University degree (IR/Law): KES 400K–1.2M over 4 years. Language training additional.' },
    risk_level:    'low',
    prestige_level: 5,
    social_reality: {
      prestige_level: 5,
      common_misconception: 'Diplomats just attend fancy dinners and parties',
      honest_reality_check: 'Diplomats negotiate trade deals, protect Kenyan citizens abroad, manage crises, and shape foreign policy. The social functions are 5% of the job. The other 95% is research, reporting, and negotiations.',
      parent_frame: {
        opening: 'Kenya\'s diplomats represent 55 million people on the world stage — it is one of the most respected careers in the country.',
        key_points: ['Government salary plus housing, school fees, and travel allowances abroad', 'Career path from Third Secretary to Ambassador takes 20–30 years', 'Exposure to global networks, languages, and cultures'],
        honest_challenges: ['Extremely competitive entry — hundreds apply per post', 'Frequent international relocation disrupts family life', 'Promotion is slow and politically influenced'],
      },
    },
    alternative_career_slugs:   ['public-administrator', 'advocate-lawyer', 'journalist-media-producer'],
    complementary_career_slugs: ['economist-policy-analyst', 'social-worker-community-developer'],
  },

  // ── CREATIVE ──────────────────────────────────────────────────────────────

  'film-director': {
    required_capabilities: {
      creative_thinking:    { minimum: 0.65, ideal: 0.90, weight: 0.35, note: 'Visual storytelling, concept development, and artistic vision are the entire job' },
      communication:        { minimum: 0.55, ideal: 0.80, weight: 0.25, note: 'Directing actors, briefing crew, pitching to producers — all require precise communication' },
      social_intelligence:  { minimum: 0.50, ideal: 0.75, weight: 0.20, note: 'Getting the best performance from actors and managing large creative teams' },
      resilience:           { minimum: 0.55, ideal: 0.80, weight: 0.12, note: 'Film sets are high-pressure, budgets collapse, shoots run over — you must stay composed' },
      analytical_reasoning: { minimum: 0.35, ideal: 0.60, weight: 0.05, note: 'Script analysis, budget planning, and post-production problem-solving' },
      technical_aptitude:   { minimum: 0.35, ideal: 0.60, weight: 0.03, note: 'Camera knowledge, editing software, and understanding audio-visual production chains' },
    },
    capability_cluster:   ['creative_thinking', 'communication'],
    difficulty:           'hard',
    kenya_demand:         'undersupplied',
    kcse_minimum: {
      overall_grade:  'C',
      subject_grades: { english: 'B', art: 'B' },
      alternative_routes: ['Film school (AFDA, KFCB-accredited)', 'Self-taught via YouTube + short films', 'Start as PA or camera operator and work up'],
      note: 'Kenya Film Classification Board (KFCB) and Kenya Film Commission are the industry bodies. Film school matters less than your portfolio/showreel.',
    },
    time_to_income_years: 4,
    cost_to_qualify: { min: 100000, max: 600000, note: 'Film school: KES 200K–600K. Self-taught with a camera and laptop: KES 50K–150K for equipment.' },
    risk_level:    'high',
    prestige_level: 4,
    social_reality: {
      prestige_level: 4,
      common_misconception: 'Kenyan film has no industry or money in it',
      honest_reality_check: 'Nairobi is becoming East Africa\'s content hub. Netflix, YouTube, and streaming platforms are paying Kenyan creators real money. The industry is nascent but growing fast — early movers win.',
      parent_frame: {
        opening: 'The global film and content industry is worth over USD 2 trillion. Kenya is beginning to carve its share.',
        key_points: ['Successful Kenyan filmmakers earn KES 200K–500K per project', 'YouTube and streaming open global audiences without big studios', 'Kenya Film Commission offers funding and grants'],
        honest_challenges: ['Income is very irregular, especially early on', 'Most start with zero pay projects to build a reel', 'Requires personal discipline and a very high tolerance for rejection'],
      },
    },
    alternative_career_slugs:   ['journalist-media-producer', 'journalist-content-creator', 'musician'],
    complementary_career_slugs: ['graphic-designer-creative-director', 'ux-ui-designer'],
  },

  'animator-game-developer': {
    required_capabilities: {
      technical_aptitude:   { minimum: 0.55, ideal: 0.80, weight: 0.30, note: 'Game engines (Unity, Unreal), 3D software, and programming fundamentals are essential' },
      creative_thinking:    { minimum: 0.60, ideal: 0.85, weight: 0.30, note: 'Game design, world-building, character creation — pure creative output' },
      analytical_reasoning: { minimum: 0.45, ideal: 0.70, weight: 0.20, note: 'Game logic, physics systems, and optimisation require systematic thinking' },
      resilience:           { minimum: 0.45, ideal: 0.70, weight: 0.12, note: 'Game development has brutal deadlines and frequent creative pivots' },
      communication:        { minimum: 0.30, ideal: 0.55, weight: 0.05, note: 'Collaborating with writers, sound designers, and project managers' },
      social_intelligence:  { minimum: 0.20, ideal: 0.40, weight: 0.03, note: 'Understanding what players want and enjoy' },
    },
    capability_cluster:   ['creative_thinking', 'technical_aptitude'],
    difficulty:           'hard',
    kenya_demand:         'undersupplied',
    kcse_minimum: {
      overall_grade:  'C+',
      subject_grades: { mathematics: 'B', computer_studies: 'B', art: 'C+' },
      alternative_routes: ['Online courses (Unity, Blender, Unreal)', 'Game dev bootcamp', 'Computer Science degree + self-taught animation'],
      note: 'Portfolio is everything. A GitHub with playable demos beats a degree from a school nobody knows. Start building games now.',
    },
    time_to_income_years: 3,
    cost_to_qualify: { min: 50000, max: 400000, note: 'Self-taught with online courses: KES 20K–60K. CS degree + tools: KES 300K–700K. Most essential tools have free tiers.' },
    risk_level:    'medium',
    prestige_level: 3,
    social_reality: {
      prestige_level: 3,
      common_misconception: 'Game development in Kenya has no market',
      honest_reality_check: 'African game developers are increasingly exporting to global markets. Mobile gaming is exploding across the continent. Kenya has produced internationally recognised studios — and the space is wide open.',
      parent_frame: {
        opening: 'The global gaming industry is worth USD 200 billion — bigger than film and music combined.',
        key_points: ['Mobile game developers can publish globally from a laptop', 'African gaming market growing at 12% annually', 'Animation skills also apply to advertising, education, and film'],
        honest_challenges: ['Highly competitive global market', 'Takes 2–3 years to build the skills to ship professional work', 'Solo indie development is financially unstable'],
      },
    },
    alternative_career_slugs:   ['software-engineer', 'ux-ui-designer', 'graphic-designer-creative-technologist'],
    complementary_career_slugs: ['film-director', 'data-scientist'],
  },

  'creative-director': {
    required_capabilities: {
      creative_thinking:    { minimum: 0.70, ideal: 0.90, weight: 0.35, note: 'Brand strategy, campaign concepting, and visual direction — all require top-tier creative output' },
      communication:        { minimum: 0.60, ideal: 0.85, weight: 0.25, note: 'Pitching to clients, directing teams, and articulating creative vision precisely' },
      social_intelligence:  { minimum: 0.55, ideal: 0.80, weight: 0.20, note: 'Reading client needs, managing creative egos, and building lasting brand relationships' },
      analytical_reasoning: { minimum: 0.40, ideal: 0.65, weight: 0.12, note: 'Brief analysis, market research, and measuring campaign effectiveness' },
      resilience:           { minimum: 0.45, ideal: 0.70, weight: 0.05, note: 'Client rejection, tight deadlines, and managing perfectionist standards under pressure' },
      technical_aptitude:   { minimum: 0.35, ideal: 0.60, weight: 0.03, note: 'Creative software, production tools, and emerging AI design tools' },
    },
    capability_cluster:   ['creative_thinking', 'communication'],
    difficulty:           'hard',
    kenya_demand:         'undersupplied',
    kcse_minimum: {
      overall_grade:  'C+',
      subject_grades: { english: 'B+', art: 'B' },
      alternative_routes: ['Graphic design diploma + portfolio', 'Marketing degree + agency experience', 'Self-built brand portfolio via social media'],
      note: 'Creative Directors are made, not born. The path is: design/copy → senior creative → art director → CD. Portfolio quality beats credentials every time.',
    },
    time_to_income_years: 5,
    cost_to_qualify: { min: 100000, max: 500000, note: 'Design/marketing degree: KES 300K–700K. Diploma: KES 80K–200K. Self-taught with tools: KES 30K–80K.' },
    risk_level:    'medium',
    prestige_level: 4,
    social_reality: {
      prestige_level: 4,
      common_misconception: 'Creative Directors just come up with logos',
      honest_reality_check: 'CDs run the creative strategy for entire brands — multi-million shilling campaigns, brand identity, advertising direction. They are senior leaders who happen to think visually.',
      parent_frame: {
        opening: 'Every brand you recognise was shaped by a creative director. It\'s one of advertising\'s most senior and best-paid roles.',
        key_points: ['CD salaries in Nairobi agencies: KES 150K–400K/month', 'Path to freelance or founding own agency is very achievable', 'Skills transfer across advertising, tech, and entertainment'],
        honest_challenges: ['10+ years of experience typically required to reach CD level', 'Agency culture can be high-pressure and long-hours', 'Client taste doesn\'t always match creative vision'],
      },
    },
    alternative_career_slugs:   ['graphic-designer-creative-director', 'journalist-content-creator', 'ux-ui-designer'],
    complementary_career_slugs: ['film-director', 'entrepreneur-business'],
  },

  'musician': {
    required_capabilities: {
      creative_thinking:    { minimum: 0.70, ideal: 0.90, weight: 0.40, note: 'Songwriting, composition, and artistic identity require deep creative expression' },
      resilience:           { minimum: 0.65, ideal: 0.90, weight: 0.25, note: 'Years of rejection, financial hardship, and creative setbacks before any commercial success' },
      communication:        { minimum: 0.45, ideal: 0.70, weight: 0.15, note: 'Performing, interviews, collaborating with producers, and building a fanbase' },
      social_intelligence:  { minimum: 0.45, ideal: 0.70, weight: 0.12, note: 'Reading audiences, industry networking, and building genuine fan relationships' },
      analytical_reasoning: { minimum: 0.25, ideal: 0.50, weight: 0.05, note: 'Music theory, business contracts, and managing a music career as a small business' },
      technical_aptitude:   { minimum: 0.30, ideal: 0.55, weight: 0.03, note: 'DAWs, recording software, and home studio production skills' },
    },
    capability_cluster:   ['creative_thinking', 'resilience'],
    difficulty:           'very_hard',
    kenya_demand:         'saturated',
    saturation_note:      'Consumer-facing music performance is very competitive. Production, session work, music tech, and sync licensing offer steadier income paths.',
    kcse_minimum: {
      overall_grade:  'C',
      subject_grades: { english: 'C+', music: 'B' },
      alternative_routes: ['Kenya Conservatoire of Music', 'Self-taught + online production courses', 'Music teacher qualification as backup income'],
      note: 'Formal music education helps with theory and networking but most successful Kenyan artists are self-taught. Business skills matter as much as musical talent.',
    },
    time_to_income_years: 5,
    cost_to_qualify: { min: 30000, max: 300000, note: 'Home studio setup: KES 50K–200K. Music school: KES 50K–200K/year. Core investment is time, not money.' },
    risk_level:    'high',
    prestige_level: 4,
    social_reality: {
      prestige_level: 4,
      common_misconception: 'You either make it big or make nothing in music',
      honest_reality_check: 'Most successful Kenyan musicians earn through multiple streams: live performance, production for others, brand deals, content creation, and music licensing — not just album sales.',
      parent_frame: {
        opening: 'Kenya\'s music industry is growing and increasingly connects to global streaming platforms.',
        key_points: ['Successful artists earn from performances, sync deals, YouTube, and brand partnerships', 'Music production skills are in high demand across advertising and film', 'Teaching music is a reliable backup income while building a music career'],
        honest_challenges: ['Very few artists achieve financial stability from music alone', 'Career is genuinely unpredictable — talent is necessary but not sufficient', 'Requires strong personal discipline without institutional structure'],
      },
    },
    alternative_career_slugs:   ['film-director', 'journalist-content-creator', 'event-planner'],
    complementary_career_slugs: ['graphic-designer-creative-director', 'teacher-education-technologist'],
  },

  'interior-designer': {
    required_capabilities: {
      creative_thinking:    { minimum: 0.65, ideal: 0.85, weight: 0.35, note: 'Spatial design, colour theory, and translating client vision into functional beauty' },
      technical_aptitude:   { minimum: 0.45, ideal: 0.70, weight: 0.25, note: 'AutoCAD, SketchUp, 3D rendering software, and understanding structural constraints' },
      communication:        { minimum: 0.50, ideal: 0.75, weight: 0.20, note: 'Client consultations, contractor coordination, and presenting design concepts' },
      analytical_reasoning: { minimum: 0.40, ideal: 0.65, weight: 0.12, note: 'Budget management, space planning calculations, and project timelines' },
      social_intelligence:  { minimum: 0.40, ideal: 0.65, weight: 0.05, note: 'Understanding what clients really want vs what they say they want' },
      resilience:           { minimum: 0.35, ideal: 0.60, weight: 0.03, note: 'Managing demanding clients and contractor delays without losing composure' },
    },
    capability_cluster:   ['creative_thinking', 'technical_aptitude'],
    difficulty:           'moderate',
    kenya_demand:         'undersupplied',
    kcse_minimum: {
      overall_grade:  'C+',
      subject_grades: { art: 'B', mathematics: 'C+', geography: 'C+' },
      alternative_routes: ['Diploma in Interior Design', 'Architecture degree (broader)', 'Short courses + portfolio building'],
      note: 'KAI (Kenya Association of Interior Designers) membership is the professional standard. Strong portfolio matters more than institution for winning clients.',
    },
    time_to_income_years: 3,
    cost_to_qualify: { min: 80000, max: 500000, note: 'Diploma: KES 80K–200K. Architecture degree: KES 500K–1.2M. Software training: KES 20K–50K.' },
    risk_level:    'medium',
    prestige_level: 3,
    social_reality: {
      prestige_level: 3,
      common_misconception: 'Interior design is just choosing nice curtains',
      honest_reality_check: 'Interior designers manage complex projects worth millions of shillings — space planning, structural coordination, material specification, contractor management, and client psychology.',
      parent_frame: {
        opening: 'Kenya\'s real estate and hospitality boom is driving huge demand for interior designers who can deliver world-class spaces.',
        key_points: ['Nairobi apartment and hotel design market is growing rapidly', 'Freelance interior designers can earn KES 100K–500K per project', 'Skills applicable in hospitality, residential, and corporate sectors'],
        honest_challenges: ['Building a client base takes 3–5 years', 'Income is project-based and can be inconsistent', 'Demanding clients and contractor unreliability are constant challenges'],
      },
    },
    alternative_career_slugs:   ['architect', 'urban-planner', 'graphic-designer-creative-director'],
    complementary_career_slugs: ['architect', 'quantity-surveyor'],
  },

  'fashion-designer': {
    required_capabilities: {
      creative_thinking:    { minimum: 0.70, ideal: 0.90, weight: 0.40, note: 'Pattern design, aesthetic vision, and trend forecasting are entirely creative domains' },
      technical_aptitude:   { minimum: 0.45, ideal: 0.70, weight: 0.25, note: 'Pattern making, sewing construction, textile knowledge, and design software' },
      resilience:           { minimum: 0.55, ideal: 0.80, weight: 0.15, note: 'Fashion is brutal — collections fail, clients are demanding, competition is intense' },
      communication:        { minimum: 0.40, ideal: 0.65, weight: 0.10, note: 'Pitching collections, managing clients, and building a brand story' },
      social_intelligence:  { minimum: 0.40, ideal: 0.65, weight: 0.07, note: 'Understanding what customers want to wear and how to build a loyal client base' },
      analytical_reasoning: { minimum: 0.30, ideal: 0.55, weight: 0.03, note: 'Costing garments, managing inventory, and business planning' },
    },
    capability_cluster:   ['creative_thinking', 'technical_aptitude'],
    difficulty:           'hard',
    kenya_demand:         'undersupplied',
    kcse_minimum: {
      overall_grade:  'C',
      subject_grades: { art: 'B', home_science: 'B' },
      alternative_routes: ['Diploma in Fashion Design (KCA, TDC)', 'Self-taught with apprenticeship', 'Online courses + personal brand building'],
      note: 'Textile Design Centre (TDC) Nairobi is the leading local institution. Instagram and social commerce have created entirely new routes to market.',
    },
    time_to_income_years: 3,
    cost_to_qualify: { min: 60000, max: 400000, note: 'Diploma: KES 60K–180K. Equipment (sewing machine + tools): KES 30K–100K. Materials for first collection: KES 20K–80K.' },
    risk_level:    'high',
    prestige_level: 3,
    social_reality: {
      prestige_level: 3,
      common_misconception: 'Fashion design in Kenya means making curtains and school uniforms',
      honest_reality_check: 'Kenyan designers are showing at global fashion weeks and selling to diaspora customers worldwide. African prints and sustainable fashion are two of the fastest-growing niches globally.',
      parent_frame: {
        opening: 'Kenyan fashion is going global — designers like Adele Dejak and SAWA are proof that African design commands international prices.',
        key_points: ['Social media enables selling directly to global customers', 'African fashion market growing at 15% annually', 'Skills transfer to costume design, textile business, and retail buying'],
        honest_challenges: ['Building a viable income from design takes 3–7 years', 'Production costs and fabric prices are high', 'Global fast-fashion competition is brutal for small designers'],
      },
    },
    alternative_career_slugs:   ['graphic-designer-creative-director', 'interior-designer', 'entrepreneur-business'],
    complementary_career_slugs: ['creative-director', 'journalist-content-creator'],
  },

  'event-planner': {
    required_capabilities: {
      social_intelligence:  { minimum: 0.60, ideal: 0.85, weight: 0.30, note: 'Reading client vision, managing vendor relationships, and keeping guests happy' },
      communication:        { minimum: 0.60, ideal: 0.85, weight: 0.25, note: 'Client briefs, vendor negotiations, on-site coordination, and crisis communication' },
      analytical_reasoning: { minimum: 0.45, ideal: 0.70, weight: 0.20, note: 'Budget management, logistics planning, timeline creation, and contingency thinking' },
      resilience:           { minimum: 0.55, ideal: 0.80, weight: 0.15, note: 'Things go wrong at every event. The planner must fix it invisibly and stay calm.' },
      creative_thinking:    { minimum: 0.40, ideal: 0.65, weight: 0.07, note: 'Theming, decor concepts, and designing memorable experiences' },
      technical_aptitude:   { minimum: 0.20, ideal: 0.40, weight: 0.03, note: 'Event management software, AV understanding, and digital RSVPs' },
    },
    capability_cluster:   ['social_intelligence', 'communication'],
    difficulty:           'moderate',
    kenya_demand:         'balanced',
    saturation_note:      'Basic event planning is competitive. Niche specialisation (weddings, corporate, conferences) and high-end execution command premium prices.',
    kcse_minimum: {
      overall_grade:  'C',
      subject_grades: { english: 'B', business_studies: 'C+' },
      alternative_routes: ['Hospitality Management diploma', 'Start as event assistant', 'Certificate in Event Management (KIMC)'],
      note: 'No strict academic requirement — experience, portfolio, and client referrals matter most. Many successful planners are entirely self-taught.',
    },
    time_to_income_years: 1,
    cost_to_qualify: { min: 20000, max: 200000, note: 'Start with almost nothing. Build through assistant roles. Diploma adds credibility: KES 60K–150K. Main cost is building client trust.' },
    risk_level:    'medium',
    prestige_level: 3,
    social_reality: {
      prestige_level: 3,
      common_misconception: 'Event planning is just decorating a hall',
      honest_reality_check: 'Top Nairobi event planners manage budgets of KES 5M–50M per corporate event. It\'s logistics, people management, vendor negotiation, and creative direction rolled into one high-stakes role.',
      parent_frame: {
        opening: 'Kenya\'s events industry — weddings, corporate conferences, concerts — generates billions annually and is growing.',
        key_points: ['Low barrier to entry allows starting young and building experience fast', 'Corporate events can earn KES 50K–500K per event for established planners', 'Builds transferable skills in hospitality, business, and project management'],
        honest_challenges: ['Income is very inconsistent — feast or famine between events', 'Working weekends and holidays is unavoidable', 'One bad event can damage reputation significantly'],
      },
    },
    alternative_career_slugs:   ['tourism-safari-manager', 'human-resources', 'journalist-media-producer'],
    complementary_career_slugs: ['creative-director', 'musician'],
  },

  // ── ENVIRONMENT ────────────────────────────────────────────────────────────

  'renewable-energy-engineer': {
    required_capabilities: {
      technical_aptitude:   { minimum: 0.60, ideal: 0.85, weight: 0.35, note: 'Solar, wind, and geothermal systems require deep engineering and physics knowledge' },
      analytical_reasoning: { minimum: 0.60, ideal: 0.85, weight: 0.30, note: 'Energy modelling, grid integration, and system optimisation are mathematically intensive' },
      resilience:           { minimum: 0.40, ideal: 0.65, weight: 0.15, note: 'Field deployments in remote areas, long project timelines, and policy delays' },
      communication:        { minimum: 0.40, ideal: 0.65, weight: 0.12, note: 'Community engagement, donor reporting, and cross-disciplinary team coordination' },
      creative_thinking:    { minimum: 0.35, ideal: 0.60, weight: 0.05, note: 'Designing off-grid systems for unique local contexts' },
      social_intelligence:  { minimum: 0.25, ideal: 0.50, weight: 0.03, note: 'Working with rural communities and government stakeholders' },
    },
    capability_cluster:   ['technical_aptitude', 'analytical_reasoning'],
    difficulty:           'hard',
    kenya_demand:         'critical_shortage',
    kcse_minimum: {
      overall_grade:  'B',
      subject_grades: { mathematics: 'B+', physics: 'B+', chemistry: 'B' },
      alternative_routes: ['Electrical Engineering degree + renewable focus', 'ERC (Energy Regulatory Commission) internship', 'Online certifications (IRENA, GOGLA)'],
      note: 'Kenya is a global leader in geothermal and off-grid solar. ERC and KETRACO are major employers. Engineering degree is standard but practical skills in solar installation open doors faster.',
    },
    time_to_income_years: 4,
    cost_to_qualify: { min: 300000, max: 800000, note: 'Engineering degree: KES 400K–900K. Technical cert in solar: KES 30K–80K. Field experience is invaluable.' },
    risk_level:    'low',
    prestige_level: 4,
    social_reality: {
      prestige_level: 4,
      common_misconception: 'Renewable energy is a niche idealistic field with few jobs',
      honest_reality_check: 'Kenya is building the largest wind farm in Africa (Lake Turkana), runs 80% of its grid on renewables, and needs hundreds of engineers. Climate finance is pouring billions into African clean energy.',
      parent_frame: {
        opening: 'Kenya is a world leader in renewable energy — geothermal, solar, and wind are all major and growing sectors.',
        key_points: ['Government target: 100% renewable electricity by 2030 — massive hiring ahead', 'International organisations (World Bank, AfDB) fund projects and pay well', 'Salaries: KES 100K–400K for experienced engineers'],
        honest_challenges: ['Field work often in remote and challenging environments', 'Project-based work can mean contract gaps', 'Policy and regulation can slow project timelines significantly'],
      },
    },
    alternative_career_slugs:   ['electrical-engineer', 'environmental-scientist', 'civil-engineer'],
    complementary_career_slugs: ['urban-planner', 'data-scientist'],
  },

  // ── FINANCE ───────────────────────────────────────────────────────────────

  'actuary': {
    required_capabilities: {
      analytical_reasoning: { minimum: 0.75, ideal: 0.95, weight: 0.45, note: 'Actuarial work is applied mathematics — probability, statistics, and financial modelling at the highest level' },
      technical_aptitude:   { minimum: 0.65, ideal: 0.90, weight: 0.30, note: 'Statistical software (R, SAS), Excel modelling, and programming for data pipelines' },
      resilience:           { minimum: 0.50, ideal: 0.75, weight: 0.12, note: 'Actuarial exams take 8–10 years to complete while working full-time — extreme persistence required' },
      communication:        { minimum: 0.40, ideal: 0.65, weight: 0.08, note: 'Translating complex risk calculations into business recommendations for non-technical executives' },
      creative_thinking:    { minimum: 0.25, ideal: 0.45, weight: 0.03, note: 'Building novel risk models for emerging products or markets' },
      social_intelligence:  { minimum: 0.20, ideal: 0.40, weight: 0.02, note: 'Working with underwriters, executives, and regulators' },
    },
    capability_cluster:   ['analytical_reasoning', 'technical_aptitude'],
    difficulty:           'very_hard',
    kenya_demand:         'critical_shortage',
    kcse_minimum: {
      overall_grade:  'A-',
      subject_grades: { mathematics: 'A', statistics: 'A-', physics: 'B+' },
      alternative_routes: ['Actuarial Science degree (UoN, Strathmore)', 'Statistics degree + IFoA exams', 'Maths degree + self-study for professional papers'],
      note: 'Professional qualification through IFoA (UK) or SOA (US) is required. Kenya has fewer than 100 fully qualified actuaries — extreme shortage and very high salaries.',
    },
    time_to_income_years: 5,
    cost_to_qualify: { min: 500000, max: 1500000, note: 'University: KES 400K–900K. IFoA exam fees: KES 200K–600K over 8–10 years. Entry-level jobs start while still studying.' },
    risk_level:    'low',
    prestige_level: 5,
    social_reality: {
      prestige_level: 5,
      common_misconception: 'Actuaries just crunch numbers in insurance offices',
      honest_reality_check: 'Actuaries are the highest-paid professionals in financial services globally. They model pandemics, climate risk, pension collapses, and bank failures. In Kenya, a qualified actuary earns KES 300K–800K/month.',
      parent_frame: {
        opening: 'Kenya has fewer than 100 fully qualified actuaries. The country needs thousands. This is one of the rarest and best-paid qualifications in Africa.',
        key_points: ['Globally portable qualification — work anywhere in the world', 'Salary: KES 300K–800K/month at senior level', 'Insurance, banking, government, and consulting all compete for actuaries'],
        honest_challenges: ['8–10 years of exams while working full-time is genuinely gruelling', 'Requires exceptional mathematical ability from the start', 'Social life during exam years is heavily compromised'],
      },
    },
    alternative_career_slugs:   ['accountant-financial-analyst', 'data-scientist', 'economist-policy-analyst'],
    complementary_career_slugs: ['economist-policy-analyst', 'insurance-specialist'],
  },

  'insurance-specialist': {
    required_capabilities: {
      analytical_reasoning: { minimum: 0.50, ideal: 0.75, weight: 0.30, note: 'Risk assessment, underwriting decisions, and claims analysis require structured thinking' },
      communication:        { minimum: 0.55, ideal: 0.80, weight: 0.28, note: 'Selling policies, explaining complex products, and negotiating claims settlements' },
      social_intelligence:  { minimum: 0.50, ideal: 0.75, weight: 0.22, note: 'Client relationships are the foundation of insurance distribution' },
      resilience:           { minimum: 0.45, ideal: 0.70, weight: 0.12, note: 'Rejection in sales, claims disputes, and market downturns require persistence' },
      technical_aptitude:   { minimum: 0.30, ideal: 0.55, weight: 0.05, note: 'Insurance software, actuarial tables, and regulatory reporting systems' },
      creative_thinking:    { minimum: 0.20, ideal: 0.40, weight: 0.03, note: 'Designing new products for underserved market segments' },
    },
    capability_cluster:   ['analytical_reasoning', 'communication'],
    difficulty:           'moderate',
    kenya_demand:         'undersupplied',
    kcse_minimum: {
      overall_grade:  'C+',
      subject_grades: { mathematics: 'C+', english: 'B', business_studies: 'C+' },
      alternative_routes: ['AIIK (Association of Insurance Institute of Kenya) diploma', 'CII (Chartered Insurance Institute) qualification', 'Business degree + IRA registration'],
      note: 'AIIK diploma or CII qualification are the standard credentials. IRA (Insurance Regulatory Authority) registration required to practice. Entry via sales roles is common.',
    },
    time_to_income_years: 2,
    cost_to_qualify: { min: 60000, max: 400000, note: 'AIIK diploma: KES 30K–80K. Business degree: KES 300K–700K. Many enter via sales commission roles with minimal upfront cost.' },
    risk_level:    'medium',
    prestige_level: 3,
    social_reality: {
      prestige_level: 3,
      common_misconception: 'Insurance is boring and just about selling life policies',
      honest_reality_check: 'Insurance specialists underwrite everything from satellites to crops to cyber attacks. The industry is being transformed by technology and Kenya\'s insurance penetration rate is still very low — huge growth ahead.',
      parent_frame: {
        opening: 'Kenya\'s insurance penetration is 2.4% — one of the lowest in the world. As it grows toward global averages, demand for professionals will surge.',
        key_points: ['Commission-based income can be very high for strong performers', 'Senior underwriters and claims managers: KES 150K–400K/month', 'Transferable skills across banking, reinsurance, and fintech'],
        honest_challenges: ['Commission-only entry positions mean uncertain early income', 'Public trust in insurance is low — overcoming scepticism is daily work', 'Heavy regulatory compliance requirements'],
      },
    },
    alternative_career_slugs:   ['accountant-financial-analyst', 'actuary', 'economist-policy-analyst'],
    complementary_career_slugs: ['actuary', 'human-resources'],
  },

  // ── HEALTH ────────────────────────────────────────────────────────────────

  'digital-health-specialist': {
    required_capabilities: {
      technical_aptitude:   { minimum: 0.55, ideal: 0.80, weight: 0.30, note: 'Health IT systems, EHR platforms, data analysis, and health informatics fundamentals' },
      analytical_reasoning: { minimum: 0.55, ideal: 0.80, weight: 0.28, note: 'Health data analysis, system evaluation, and evidence-based implementation decisions' },
      communication:        { minimum: 0.50, ideal: 0.75, weight: 0.20, note: 'Bridging clinicians and technologists — translating between two different worlds' },
      social_intelligence:  { minimum: 0.45, ideal: 0.70, weight: 0.12, note: 'Change management in healthcare settings requires high EQ and patience' },
      resilience:           { minimum: 0.40, ideal: 0.65, weight: 0.07, note: 'Healthcare system change is slow and politically complex' },
      creative_thinking:    { minimum: 0.35, ideal: 0.60, weight: 0.03, note: 'Designing health tech solutions that actually get used in resource-constrained settings' },
    },
    capability_cluster:   ['technical_aptitude', 'analytical_reasoning'],
    difficulty:           'hard',
    kenya_demand:         'critical_shortage',
    kcse_minimum: {
      overall_grade:  'B',
      subject_grades: { biology: 'B', mathematics: 'B', computer_studies: 'B' },
      alternative_routes: ['Health Informatics degree', 'Clinical background + IT upskilling', 'Public Health degree + data science cert'],
      note: 'Emerging field with no fixed path. Clinical experience (nursing, clinical medicine) + tech skills is the most valued combination. WHO, AMREF, and MOH are major employers.',
    },
    time_to_income_years: 4,
    cost_to_qualify: { min: 300000, max: 900000, note: 'Degree: KES 400K–900K. Short courses in health informatics: KES 30K–100K. Clinical base degree adds cost.' },
    risk_level:    'low',
    prestige_level: 4,
    social_reality: {
      prestige_level: 4,
      common_misconception: 'You have to choose between medicine and technology',
      honest_reality_check: 'Digital health specialists are among the most sought-after professionals globally. WHO projects a 40% shortfall in health workers by 2030 — technology is the only scalable solution, and Kenya is a hub for health innovation.',
      parent_frame: {
        opening: 'Digital health is where medicine meets technology — and Kenya is one of Africa\'s leading innovation hubs for it.',
        key_points: ['NGOs, WHO, government, and startups all hire digital health specialists', 'Salaries: KES 150K–500K/month depending on employer', 'M-TIBA and similar platforms show Kenya is at the frontier of health tech'],
        honest_challenges: ['Field is still defining itself — roles vary widely', 'Healthcare institutions are slow to change', 'Requires keeping up with both health knowledge and technology simultaneously'],
      },
    },
    alternative_career_slugs:   ['medical-doctor', 'data-scientist', 'pharmacist'],
    complementary_career_slugs: ['software-engineer', 'data-scientist'],
  },

  'veterinarian': {
    required_capabilities: {
      analytical_reasoning: { minimum: 0.60, ideal: 0.85, weight: 0.30, note: 'Diagnosing animal disease requires the same systematic reasoning as medicine' },
      technical_aptitude:   { minimum: 0.55, ideal: 0.80, weight: 0.28, note: 'Surgical procedures, pharmacology, laboratory diagnostics, and equipment operation' },
      social_intelligence:  { minimum: 0.50, ideal: 0.75, weight: 0.20, note: 'Working with anxious animal owners and livestock farmers who may be losing livelihoods' },
      communication:        { minimum: 0.45, ideal: 0.70, weight: 0.12, note: 'Explaining diagnoses, treatment plans, and public health risks clearly' },
      resilience:           { minimum: 0.50, ideal: 0.75, weight: 0.07, note: 'Animal suffering, death, zoonotic disease risk, and long hours in challenging conditions' },
      creative_thinking:    { minimum: 0.25, ideal: 0.50, weight: 0.03, note: 'Diagnosing unusual presentations with limited diagnostic equipment' },
    },
    capability_cluster:   ['analytical_reasoning', 'technical_aptitude'],
    difficulty:           'very_hard',
    kenya_demand:         'critical_shortage',
    kcse_minimum: {
      overall_grade:  'A-',
      subject_grades: { biology: 'A-', chemistry: 'A-', physics: 'B+', mathematics: 'B' },
      alternative_routes: ['Veterinary Technology diploma (para-vet)', 'Animal Health degree (Kenya school of Agriculture)', 'Community Animal Health Worker route'],
      note: 'BVM (Bachelor of Veterinary Medicine) at UoN is 5 years. Extremely competitive admission. Kenya Veterinary Board regulates practice. Animal health diploma is a faster alternative path.',
    },
    time_to_income_years: 6,
    cost_to_qualify: { min: 800000, max: 2000000, note: 'BVM at UoN: KES 800K–1.5M (5 years). Private: KES 1.5M–2.5M. Animal health diploma: KES 100K–200K.' },
    risk_level:    'low',
    prestige_level: 4,
    social_reality: {
      prestige_level: 4,
      common_misconception: 'Vets just treat pets for rich families in Nairobi',
      honest_reality_check: 'Kenya\'s livestock sector is worth KES 1.2 trillion annually. Government and NGO vets work across the country on food security, zoonotic disease control, and wildlife conservation. The majority of work is agricultural, not companion animals.',
      parent_frame: {
        opening: 'Livestock is Kenya\'s second largest agricultural sector. Veterinarians protect it — and by extension, the food security of millions.',
        key_points: ['Government employment available through Ministry of Agriculture', 'Private practice in Nairobi can be very lucrative', 'Wildlife veterinary work connects to conservation and research careers'],
        honest_challenges: ['5-year degree with very competitive entry', 'Rural posting is often mandatory for government vets', 'Physical and emotional demands of large animal work are significant'],
      },
    },
    alternative_career_slugs:   ['medical-doctor', 'agricultural-scientist', 'environmental-scientist'],
    complementary_career_slugs: ['agricultural-scientist', 'environmental-scientist'],
  },

  'pharmacist': {
    required_capabilities: {
      analytical_reasoning: { minimum: 0.60, ideal: 0.85, weight: 0.35, note: 'Drug interactions, dosing calculations, and clinical decision-making require rigorous analysis' },
      technical_aptitude:   { minimum: 0.55, ideal: 0.80, weight: 0.30, note: 'Pharmacology, biochemistry, and pharmacy management systems are heavily technical' },
      communication:        { minimum: 0.50, ideal: 0.75, weight: 0.18, note: 'Patient counselling, prescriber collaboration, and medication safety communication' },
      social_intelligence:  { minimum: 0.40, ideal: 0.65, weight: 0.10, note: 'Patient trust and recognising when clinical presentation needs a referral' },
      resilience:           { minimum: 0.35, ideal: 0.60, weight: 0.05, note: 'High workload, patient adherence challenges, and regulatory pressures' },
      creative_thinking:    { minimum: 0.20, ideal: 0.40, weight: 0.02, note: 'Compounding, formulation, and clinical pharmacy innovation' },
    },
    capability_cluster:   ['analytical_reasoning', 'technical_aptitude'],
    difficulty:           'hard',
    kenya_demand:         'undersupplied',
    kcse_minimum: {
      overall_grade:  'B+',
      subject_grades: { chemistry: 'A-', biology: 'A-', mathematics: 'B+', physics: 'B' },
      alternative_routes: ['Pharmaceutical Technology diploma', 'Clinical Medicine + pharmacy upskilling', 'Pharmacy Technologist route (3-year diploma)'],
      note: 'Bachelor of Pharmacy (4–5 years) is required for full pharmacist registration with PPB (Pharmacy and Poisons Board). Pharmacy technologist diploma is a faster alternative.',
    },
    time_to_income_years: 5,
    cost_to_qualify: { min: 500000, max: 1200000, note: 'B.Pharm at public universities: KES 500K–800K. Private: KES 1M–1.5M. Pharmacy tech diploma: KES 150K–300K.' },
    risk_level:    'low',
    prestige_level: 4,
    social_reality: {
      prestige_level: 4,
      common_misconception: 'Pharmacists just count tablets and dispense medicine',
      honest_reality_check: 'Clinical pharmacists are medication safety experts who prevent dangerous drug combinations, optimise treatment regimens, and manage complex chronic disease. In hospitals, they are the drug authority.',
      parent_frame: {
        opening: 'Every hospital, clinic, and pharmacy chain in Kenya needs pharmacists — and supply is far behind demand.',
        key_points: ['Stable employment across public health, hospitals, retail pharmacy, and pharma industry', 'Salary: KES 80K–250K/month depending on sector', 'Pharmaceutical manufacturing (Cosmos, Dawa) also hires pharmacists at senior levels'],
        honest_challenges: ['Competitive university entry — chemistry and biology grades must be excellent', 'Long hours in retail pharmacy, especially on night shifts', 'PPB licensing requirements add regulatory overhead'],
      },
    },
    alternative_career_slugs:   ['medical-doctor', 'digital-health-specialist', 'veterinarian'],
    complementary_career_slugs: ['medical-doctor', 'data-scientist'],
  },

  // ── TECHNOLOGY ────────────────────────────────────────────────────────────

  'cybersecurity-analyst': {
    required_capabilities: {
      analytical_reasoning: { minimum: 0.60, ideal: 0.85, weight: 0.35, note: 'Threat modelling, forensic investigation, and attack pattern analysis are deeply analytical' },
      technical_aptitude:   { minimum: 0.65, ideal: 0.90, weight: 0.35, note: 'Networks, operating systems, programming, and security tooling are the technical core' },
      resilience:           { minimum: 0.45, ideal: 0.70, weight: 0.15, note: 'Attacks happen at 3am. Incident response is high-pressure with no room for panic.' },
      creative_thinking:    { minimum: 0.40, ideal: 0.65, weight: 0.10, note: 'Thinking like an attacker requires creative adversarial thinking' },
      communication:        { minimum: 0.35, ideal: 0.60, weight: 0.03, note: 'Incident reports, board briefings, and security awareness training' },
      social_intelligence:  { minimum: 0.20, ideal: 0.40, weight: 0.02, note: 'Social engineering attacks require understanding human psychology' },
    },
    capability_cluster:   ['technical_aptitude', 'analytical_reasoning'],
    difficulty:           'hard',
    kenya_demand:         'critical_shortage',
    kcse_minimum: {
      overall_grade:  'C+',
      subject_grades: { mathematics: 'B', computer_studies: 'B', physics: 'C+' },
      alternative_routes: ['CompTIA Security+, CEH, CISSP certifications', 'Self-taught via HackTheBox, TryHackMe', 'CS degree + security specialisation', 'Cyber bootcamps (iLabAfrica, Zetech)'],
      note: 'Certifications (CEH, CISSP, CompTIA) matter more than degrees in cybersecurity. A portfolio of CTF (Capture The Flag) wins and bug bounties is worth more than most degrees.',
    },
    time_to_income_years: 2,
    cost_to_qualify: { min: 50000, max: 400000, note: 'Self-study + cert exams: KES 50K–150K. CS degree + security focus: KES 300K–700K. Most platforms have free labs.' },
    risk_level:    'low',
    prestige_level: 4,
    social_reality: {
      prestige_level: 4,
      common_misconception: 'Cybersecurity is just about hacking',
      honest_reality_check: 'Cybersecurity is the fastest growing tech field globally. Banks, telcos, hospitals, and governments are all under daily attack. Kenya loses billions to cybercrime annually — demand for defenders has never been higher.',
      parent_frame: {
        opening: 'Kenya loses KES 30 billion to cybercrime every year. The people stopping those attacks are cybersecurity analysts.',
        key_points: ['One of the highest-demand tech roles globally — 3.5 million unfilled jobs worldwide', 'Starting salary in Kenya: KES 80K–150K. Senior: KES 300K–600K', 'Remote work means access to international salaries while based in Nairobi'],
        honest_challenges: ['Continuous learning is mandatory — threats evolve every month', 'High-stress during incidents — cyberattacks don\'t respect business hours', 'Entry requires strong self-discipline for self-study'],
      },
    },
    alternative_career_slugs:   ['software-engineer', 'data-scientist', 'digital-health-specialist'],
    complementary_career_slugs: ['software-engineer', 'data-scientist'],
  },

  'drone-pilot-gis': {
    required_capabilities: {
      technical_aptitude:   { minimum: 0.55, ideal: 0.80, weight: 0.35, note: 'Drone operation, GIS software, remote sensing, and spatial data processing' },
      analytical_reasoning: { minimum: 0.55, ideal: 0.80, weight: 0.30, note: 'Interpreting spatial data, map analysis, and flight path planning require precise reasoning' },
      creative_thinking:    { minimum: 0.35, ideal: 0.60, weight: 0.15, note: 'Designing survey methodologies and identifying patterns in aerial imagery' },
      resilience:           { minimum: 0.35, ideal: 0.60, weight: 0.10, note: 'Field work in challenging terrain and weather; regulatory approvals can be slow' },
      communication:        { minimum: 0.35, ideal: 0.60, weight: 0.07, note: 'Briefing clients on data outputs and writing technical reports' },
      social_intelligence:  { minimum: 0.20, ideal: 0.40, weight: 0.03, note: 'Community engagement when surveying land in sensitive areas' },
    },
    capability_cluster:   ['technical_aptitude', 'analytical_reasoning'],
    difficulty:           'moderate',
    kenya_demand:         'critical_shortage',
    kcse_minimum: {
      overall_grade:  'C+',
      subject_grades: { mathematics: 'B', geography: 'B', physics: 'C+' },
      alternative_routes: ['KCAA Remote Pilot Certificate', 'GIS certificate (Survey of Kenya training)', 'Geospatial Engineering degree', 'Land Survey diploma'],
      note: 'KCAA (Kenya Civil Aviation Authority) licence is legally required to operate commercially. GIS skills can be self-taught via QGIS and open data. Combine both for maximum employability.',
    },
    time_to_income_years: 2,
    cost_to_qualify: { min: 80000, max: 400000, note: 'KCAA drone licence: KES 30K–60K. Commercial drone (DJI Mavic): KES 100K–300K. GIS degree: KES 300K–600K. Certificate: KES 50K–100K.' },
    risk_level:    'medium',
    prestige_level: 3,
    social_reality: {
      prestige_level: 3,
      common_misconception: 'Drones are just toys or for photography',
      honest_reality_check: 'Drone and GIS professionals map land for infrastructure, agriculture, mining, conservation, and disaster response. Kenya\'s National Land Commission, construction companies, and NGOs are all major clients.',
      parent_frame: {
        opening: 'Drone and GIS technology is revolutionising agriculture, land mapping, construction, and conservation across Africa.',
        key_points: ['Kenya\'s ongoing land digitisation drive needs hundreds of GIS professionals', 'Aerial survey contracts can earn KES 100K–500K per project', 'Applications span agriculture, mining, real estate, and infrastructure'],
        honest_challenges: ['KCAA regulations are strict and equipment is expensive', 'Market still developing — early movers have advantage but must build awareness', 'Weather and terrain limit operational days'],
      },
    },
    alternative_career_slugs:   ['urban-planner', 'environmental-scientist', 'civil-engineer'],
    complementary_career_slugs: ['agricultural-scientist', 'urban-planner'],
  },

  'data-scientist': {
    required_capabilities: {
      analytical_reasoning: { minimum: 0.70, ideal: 0.90, weight: 0.40, note: 'Statistical modelling, hypothesis testing, and causal inference are the core analytical tasks' },
      technical_aptitude:   { minimum: 0.65, ideal: 0.85, weight: 0.35, note: 'Python/R programming, SQL, machine learning frameworks, and data engineering pipelines' },
      creative_thinking:    { minimum: 0.40, ideal: 0.65, weight: 0.12, note: 'Framing the right question, choosing the right model, and designing useful visualisations' },
      communication:        { minimum: 0.40, ideal: 0.65, weight: 0.08, note: 'Presenting findings to non-technical stakeholders in ways that drive decisions' },
      resilience:           { minimum: 0.35, ideal: 0.60, weight: 0.03, note: 'Data is messy, models fail, and hypotheses are often wrong — persistence is essential' },
      social_intelligence:  { minimum: 0.20, ideal: 0.40, weight: 0.02, note: 'Understanding business context and what decision-makers actually need' },
    },
    capability_cluster:   ['analytical_reasoning', 'technical_aptitude'],
    difficulty:           'hard',
    kenya_demand:         'critical_shortage',
    kcse_minimum: {
      overall_grade:  'B',
      subject_grades: { mathematics: 'A-', physics: 'B+', computer_studies: 'B' },
      alternative_routes: ['Statistics/Maths degree + self-taught Python', 'Online bootcamps (Moringa, Dataquest)', 'Actuarial Science degree pivot', 'Computer Science + statistics minor'],
      note: 'Kenya is producing data scientists but demand is far outpacing supply. Strong maths + Python + SQL portfolio beats most academic credentials. Kaggle competitions are taken seriously by employers.',
    },
    time_to_income_years: 3,
    cost_to_qualify: { min: 80000, max: 600000, note: 'Self-taught (courses + tools): KES 50K–150K. Bootcamp: KES 80K–200K. Statistics/CS degree: KES 300K–700K.' },
    risk_level:    'low',
    prestige_level: 4,
    social_reality: {
      prestige_level: 4,
      common_misconception: 'Data science is only for people with PhDs',
      honest_reality_check: 'The majority of working data scientists have bachelor\'s degrees and self-taught skills. What matters is: can you take a real dataset, answer a business question, and present the findings clearly? If yes, you get hired.',
      parent_frame: {
        opening: 'The World Economic Forum ranks Data Scientist as the #1 emerging job globally for the next decade.',
        key_points: ['Starting salary in Nairobi: KES 100K–200K. Senior: KES 300K–600K', 'Remote work opens access to global salaries while based in Kenya', 'Skills applicable across every industry — finance, health, agriculture, government'],
        honest_challenges: ['First 1–2 years requires significant self-directed learning', 'Domain expertise (e.g. finance or health) makes you much more valuable', 'Competition from international remote workers in the same talent pool'],
      },
    },
    alternative_career_slugs:   ['software-engineer', 'actuary', 'cybersecurity-analyst'],
    complementary_career_slugs: ['software-engineer', 'economist-policy-analyst'],
  },

  'ux-ui-designer': {
    required_capabilities: {
      creative_thinking:    { minimum: 0.60, ideal: 0.85, weight: 0.30, note: 'Interface design, user flow architecture, and visual problem-solving are creative at the core' },
      social_intelligence:  { minimum: 0.55, ideal: 0.80, weight: 0.28, note: 'User research, empathy mapping, and understanding how people actually behave (vs how they say they behave)' },
      analytical_reasoning: { minimum: 0.50, ideal: 0.75, weight: 0.22, note: 'Usability testing analysis, A/B testing, and data-driven design decisions' },
      technical_aptitude:   { minimum: 0.40, ideal: 0.65, weight: 0.12, note: 'Figma, Sketch, prototyping tools, and basic front-end understanding' },
      communication:        { minimum: 0.45, ideal: 0.70, weight: 0.05, note: 'Presenting design rationale to stakeholders and advocating for users' },
      resilience:           { minimum: 0.30, ideal: 0.55, weight: 0.03, note: 'Designs get critiqued, rejected, and reworked constantly — take it professionally' },
    },
    capability_cluster:   ['creative_thinking', 'social_intelligence'],
    difficulty:           'moderate',
    kenya_demand:         'critical_shortage',
    kcse_minimum: {
      overall_grade:  'C+',
      subject_grades: { art: 'B', english: 'B', computer_studies: 'C+' },
      alternative_routes: ['Self-taught via Figma + free courses', 'Graphic design background + UX upskilling', 'HCD (Human-Centred Design) bootcamp', 'Psychology/sociology degree + design tools'],
      note: 'Portfolio is everything. No employer cares where you studied — they care what you\'ve designed. Build 3 strong case studies showing your process, not just your output.',
    },
    time_to_income_years: 2,
    cost_to_qualify: { min: 20000, max: 300000, note: 'Figma is free. Courses: KES 10K–50K. Bootcamp: KES 80K–200K. Portfolio = your most important investment.' },
    risk_level:    'low',
    prestige_level: 3,
    social_reality: {
      prestige_level: 3,
      common_misconception: 'UX designers just make things look pretty',
      honest_reality_check: 'UX designers determine whether a product works or fails in the market. A badly designed banking app loses customers. A well-designed one wins them. UX is a business-critical role, not an aesthetic one.',
      parent_frame: {
        opening: 'Every app, website, and digital product your child uses was designed by a UX/UI designer. Kenya\'s tech sector needs hundreds more.',
        key_points: ['Entry salary: KES 60K–120K. Senior: KES 200K–450K', 'Remote work is standard — many Kenyan UX designers work for global clients', 'Fintech, health tech, and e-commerce are the biggest hiring sectors in Kenya'],
        honest_challenges: ['Portfolio building requires significant upfront project work (often unpaid)', 'Feedback and critique culture can be harsh', 'Must continuously learn new tools as the field evolves'],
      },
    },
    alternative_career_slugs:   ['graphic-designer-creative-technologist', 'software-engineer', 'data-scientist'],
    complementary_career_slugs: ['software-engineer', 'graphic-designer-creative-director'],
  },

  // ── TRADES ────────────────────────────────────────────────────────────────

  'architect': {
    required_capabilities: {
      creative_thinking:    { minimum: 0.60, ideal: 0.85, weight: 0.30, note: 'Architectural design is one of the purest creative + technical synthesis disciplines' },
      technical_aptitude:   { minimum: 0.60, ideal: 0.85, weight: 0.30, note: 'AutoCAD, Revit, structural understanding, materials science, and building systems' },
      analytical_reasoning: { minimum: 0.55, ideal: 0.80, weight: 0.22, note: 'Building codes, structural calculations, cost analysis, and project management' },
      communication:        { minimum: 0.50, ideal: 0.75, weight: 0.10, note: 'Client presentations, planning authority submissions, and contractor coordination' },
      social_intelligence:  { minimum: 0.40, ideal: 0.65, weight: 0.05, note: 'Reading what clients really want and managing community expectations in large projects' },
      resilience:           { minimum: 0.40, ideal: 0.65, weight: 0.03, note: 'Projects face delays, client changes, contractor failures — composure is essential' },
    },
    capability_cluster:   ['creative_thinking', 'technical_aptitude'],
    difficulty:           'hard',
    kenya_demand:         'undersupplied',
    kcse_minimum: {
      overall_grade:  'B+',
      subject_grades: { mathematics: 'B+', physics: 'B+', art: 'B', geography: 'B' },
      alternative_routes: ['Architectural Technology diploma', 'Building Technology degree + architecture top-up', 'Part 1 qualification abroad then return'],
      note: 'AAK (Architectural Association of Kenya) registration required to practice. B.Arch is 5 years. UoN and Strathmore are the main local schools. Mandatory 2-year internship before registration.',
    },
    time_to_income_years: 6,
    cost_to_qualify: { min: 600000, max: 1500000, note: 'B.Arch UoN: KES 600K–1M (5 years). Private: KES 1M–2M. Software training + equipment additional KES 50K–100K.' },
    risk_level:    'medium',
    prestige_level: 4,
    social_reality: {
      prestige_level: 4,
      common_misconception: 'Architects just draw beautiful buildings that contractors build',
      honest_reality_check: 'Architects are project leaders who manage millions of shillings, dozens of contractors, local authorities, structural engineers, and demanding clients — simultaneously. The drawing is 20% of the job.',
      parent_frame: {
        opening: 'Kenya\'s construction sector is growing at 8% annually. Every new building, estate, and infrastructure project needs an architect.',
        key_points: ['Established architects earn KES 150K–600K/month in consulting firms', 'Own practice gives earning potential of KES 500K+ per project', 'Kenya\'s real estate boom means consistent demand for decades ahead'],
        honest_challenges: ['5-year degree is a serious time and financial commitment', '2-year mandatory internship before you can practise independently', 'Cash flow in private practice can be very irregular'],
      },
    },
    alternative_career_slugs:   ['urban-planner', 'interior-designer', 'civil-engineer'],
    complementary_career_slugs: ['urban-planner', 'quantity-surveyor', 'interior-designer'],
  },

  'urban-planner': {
    required_capabilities: {
      analytical_reasoning: { minimum: 0.55, ideal: 0.80, weight: 0.30, note: 'Population projections, land use analysis, transport modelling, and policy evaluation' },
      social_intelligence:  { minimum: 0.55, ideal: 0.80, weight: 0.25, note: 'Community engagement, political navigation, and understanding diverse stakeholder needs' },
      communication:        { minimum: 0.50, ideal: 0.75, weight: 0.22, note: 'Public participation, planning authority presentations, and report writing' },
      creative_thinking:    { minimum: 0.45, ideal: 0.70, weight: 0.15, note: 'Designing cities that are functional, equitable, and sustainable' },
      technical_aptitude:   { minimum: 0.40, ideal: 0.65, weight: 0.05, note: 'GIS software, planning software, and urban data analysis tools' },
      resilience:           { minimum: 0.35, ideal: 0.60, weight: 0.03, note: 'Planning processes are slow and politically complex — projects span years or decades' },
    },
    capability_cluster:   ['analytical_reasoning', 'social_intelligence'],
    difficulty:           'moderate',
    kenya_demand:         'undersupplied',
    kcse_minimum: {
      overall_grade:  'C+',
      subject_grades: { mathematics: 'B', geography: 'B', english: 'B' },
      alternative_routes: ['Urban and Regional Planning degree', 'Architecture + planning specialisation', 'Geography degree + planning masters'],
      note: 'Physical Planning Act requires ISUD (Institute of Surveyors of Uganda and Developers) or KIPS (Kenya Institute of Planners) membership. County governments are the biggest employers.',
    },
    time_to_income_years: 4,
    cost_to_qualify: { min: 300000, max: 800000, note: 'Urban Planning degree: KES 350K–700K. Masters in planning: KES 200K–500K additional. Government internship often paid.' },
    risk_level:    'low',
    prestige_level: 3,
    social_reality: {
      prestige_level: 3,
      common_misconception: 'Urban planning is a government desk job with no real impact',
      honest_reality_check: 'Urban planners decide where hospitals, roads, slums, and green spaces go. With 70% of Kenya\'s population expected to live in cities by 2050, the decisions planners make today will shape millions of lives for generations.',
      parent_frame: {
        opening: 'Nairobi is growing at 4% annually. Every county in Kenya needs urban planners to manage that growth intelligently.',
        key_points: ['County governments hire planners at every level', 'International organisations (UN-Habitat is based in Nairobi) pay very well', 'Private sector (real estate, consulting) offers alternative career path'],
        honest_challenges: ['Government employment can mean slow promotions and bureaucracy', 'Planning decisions are political — requires navigating pressure with integrity', 'Public often blames planners for urban problems outside their control'],
      },
    },
    alternative_career_slugs:   ['architect', 'civil-engineer', 'drone-pilot-gis'],
    complementary_career_slugs: ['architect', 'environmental-scientist', 'drone-pilot-gis'],
  },

  'electrical-engineer': {
    required_capabilities: {
      technical_aptitude:   { minimum: 0.65, ideal: 0.90, weight: 0.40, note: 'Circuit design, power systems, electronics, and control systems are technically intensive' },
      analytical_reasoning: { minimum: 0.65, ideal: 0.90, weight: 0.35, note: 'Engineering mathematics, load calculations, fault analysis, and system modelling' },
      resilience:           { minimum: 0.40, ideal: 0.65, weight: 0.12, note: 'Field work in high-voltage environments, demanding project deadlines, and safety pressure' },
      communication:        { minimum: 0.35, ideal: 0.60, weight: 0.08, note: 'Technical drawings, client reports, and coordinating with other engineering disciplines' },
      creative_thinking:    { minimum: 0.30, ideal: 0.55, weight: 0.03, note: 'Designing efficient and innovative power or control solutions' },
      social_intelligence:  { minimum: 0.20, ideal: 0.40, weight: 0.02, note: 'Working with contractors and site teams from diverse backgrounds' },
    },
    capability_cluster:   ['technical_aptitude', 'analytical_reasoning'],
    difficulty:           'hard',
    kenya_demand:         'critical_shortage',
    kcse_minimum: {
      overall_grade:  'B',
      subject_grades: { mathematics: 'A-', physics: 'B+', chemistry: 'B' },
      alternative_routes: ['Electrical Engineering Technology diploma (TVET)', 'Power Systems Engineering degree', 'ERC-accredited internship route'],
      note: 'EBK (Engineers Board of Kenya) registration required to practise. B.Eng is 4–5 years. TVET diploma is a faster, practical alternative that Kenya desperately needs.',
    },
    time_to_income_years: 4,
    cost_to_qualify: { min: 300000, max: 900000, note: 'University: KES 400K–900K. TVET diploma: KES 80K–200K. EBK registration fees: KES 10K–30K.' },
    risk_level:    'low',
    prestige_level: 4,
    social_reality: {
      prestige_level: 4,
      common_misconception: 'Electrical engineers just fix wiring',
      honest_reality_check: 'Electrical engineers design the national grid, renewable energy plants, industrial automation systems, and the electronics in every device. Kenya\'s electrification drive and renewable energy buildout are creating hundreds of new positions annually.',
      parent_frame: {
        opening: 'Kenya is electrifying the country and building Africa\'s largest renewable energy plants. Electrical engineers are at the centre of it.',
        key_points: ['KETRACO, KenGen, and KPLC are major employers with good salaries and benefits', 'Starting salary: KES 80K–150K. Senior: KES 250K–500K', 'EBK registration enables private consulting at premium rates'],
        honest_challenges: ['Degree is mathematically demanding — physics and maths must be strong', 'Field work involves safety risks that must be taken seriously', 'EBK registration process can take time after graduation'],
      },
    },
    alternative_career_slugs:   ['renewable-energy-engineer', 'civil-engineer', 'software-engineer'],
    complementary_career_slugs: ['renewable-energy-engineer', 'civil-engineer'],
  },

  'quantity-surveyor': {
    required_capabilities: {
      analytical_reasoning: { minimum: 0.60, ideal: 0.85, weight: 0.40, note: 'Bill of quantities, cost planning, value engineering, and financial control are mathematically intensive' },
      technical_aptitude:   { minimum: 0.50, ideal: 0.75, weight: 0.28, note: 'QS software, AutoCAD reading, measurement tools, and procurement systems' },
      communication:        { minimum: 0.45, ideal: 0.70, weight: 0.18, note: 'Contractor negotiations, client cost reports, and dispute resolution documentation' },
      resilience:           { minimum: 0.40, ideal: 0.65, weight: 0.08, note: 'Construction projects overrun, costs escalate, and disputes are common — equanimity is essential' },
      social_intelligence:  { minimum: 0.35, ideal: 0.60, weight: 0.03, note: 'Navigating contractor relationships and building client trust through financial accuracy' },
      creative_thinking:    { minimum: 0.25, ideal: 0.45, weight: 0.03, note: 'Value engineering — finding cheaper ways to achieve the same outcome without compromising quality' },
    },
    capability_cluster:   ['analytical_reasoning', 'technical_aptitude'],
    difficulty:           'moderate',
    kenya_demand:         'undersupplied',
    kcse_minimum: {
      overall_grade:  'C+',
      subject_grades: { mathematics: 'B', physics: 'C+', english: 'C+' },
      alternative_routes: ['BSc Quantity Surveying (UoN, JKUAT)', 'Building Economics diploma', 'Construction Management degree'],
      note: 'BORAQS (Board of Registration of Architects and Quantity Surveyors) registration required. QS is one of the most in-demand construction professionals in Kenya\'s building boom.',
    },
    time_to_income_years: 4,
    cost_to_qualify: { min: 250000, max: 700000, note: 'BSc QS: KES 300K–700K. Diploma: KES 100K–200K. BORAQS registration: KES 10K–20K.' },
    risk_level:    'low',
    prestige_level: 3,
    social_reality: {
      prestige_level: 3,
      common_misconception: 'Quantity surveyors are just accountants for buildings',
      honest_reality_check: 'QSs control the financial health of construction projects worth hundreds of millions. They prevent cost overruns, manage contracts, and ensure contractors are paid fairly. Without them, most large projects would fail financially.',
      parent_frame: {
        opening: 'Kenya\'s construction boom — SGR, Expressway, affordable housing — is creating massive demand for quantity surveyors.',
        key_points: ['Government infrastructure projects ensure consistent employment', 'Private sector QSs on major projects can earn KES 150K–400K/month', 'RICS (UK) qualification opens international markets'],
        honest_challenges: ['Degree requires strong mathematics from the start', 'Site work involves challenging conditions and contractor pressure', 'Career progression requires BORAQS registration which takes time'],
      },
    },
    alternative_career_slugs:   ['civil-engineer', 'architect', 'urban-planner'],
    complementary_career_slugs: ['architect', 'civil-engineer'],
  },

}

async function main() {
  const db = createServiceClient()
  let updated = 0
  const errors: string[] = []

  for (const [slug, meta] of Object.entries(BATCH2)) {
    const { error } = await db
      .from('careers')
      .update({
        required_capabilities:      meta.required_capabilities,
        capability_cluster:         meta.capability_cluster,
        difficulty:                 meta.difficulty,
        kenya_demand:               meta.kenya_demand,
        saturation_note:            meta.saturation_note ?? null,
        kcse_minimum:               meta.kcse_minimum,
        time_to_income_years:       meta.time_to_income_years,
        cost_to_qualify:            meta.cost_to_qualify,
        risk_level:                 meta.risk_level,
        prestige_level:             meta.prestige_level,
        social_reality:             meta.social_reality,
        alternative_career_slugs:   meta.alternative_career_slugs,
        complementary_career_slugs: meta.complementary_career_slugs,
      })
      .eq('slug', slug)

    if (error) {
      errors.push(`${slug}: ${error.message}`)
      console.error(`  ✗ ${slug}:`, error.message)
    } else {
      updated++
      console.log(`  ✓ ${slug}`)
    }
  }

  console.log(`\nDone — updated: ${updated}, errors: ${errors.length}`)
  if (errors.length > 0) {
    console.log('Errors:', errors)
    process.exit(1)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
