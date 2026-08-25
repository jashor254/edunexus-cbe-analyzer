// lib/career/careerSignals.ts
//
// Phase 8.1 — Curated Career Signals MVP.
//
// A CareerSignal is a verified, source-backed statement about a change in the
// world of work — never a live feed, never AI-generated at read time, never a
// write path into learner state. See docs/architecture/phase8-career-signals-audit.md
// for the full architecture contract this module implements, and
// docs/architecture/career-signals-mvp-sources.md for the verification record
// behind every signal below.
//
// Architecture guards enforced by lib/career/careerSignals.test.ts:
//   - no import from lib/projection, lib/repositories, or any Supabase/AI client
//   - every signal has at least one source
//   - every relatedCareerSlugs entry exists in the real Career seed corpus
//   - no prescriptive/sensational language in learner-facing copy
import type { CareerCategory, CareerPathway } from './types'

export type CareerSignalType =
  | 'EMERGING_SPECIALISATION'
  | 'TECHNOLOGY_SHIFT'
  | 'SKILL_SHIFT'
  | 'INDUSTRY_CONVERGENCE'
  | 'NEW_WORK_PRACTICE'
  | 'EDUCATION_ROUTE_CHANGE'
  | 'PROFESSIONAL_STANDARD_CHANGE'
  | 'REGIONAL_OPPORTUNITY'
  | 'SCIENTIFIC_TECHNICAL_DEVELOPMENT'

export type CareerSignalGeography = 'KENYA' | 'EAST_AFRICA' | 'AFRICA' | 'GLOBAL'

export type CareerSignalConfidence = 'EARLY' | 'EMERGING' | 'ESTABLISHED'

export type CareerSignalSourceTier = 'tier1' | 'tier2' | 'tier3' | 'tier4'

export type CareerSignalSource = {
  publisher:   string
  url:         string
  sourceType:  CareerSignalSourceTier
  publishedAt: string   // ISO date
  claim:       string   // the specific fact this source supports — not a copied excerpt
}

export type CareerSignal = {
  id:      string
  title:   string
  summary: string

  signalType: CareerSignalType
  geography:  CareerSignalGeography
  confidence: CareerSignalConfidence

  observedAt:     string  // ISO date — when the underlying development happened/was reported
  lastReviewedAt: string  // ISO date — when this record was last checked against its sources

  relatedCareerSlugs: string[]   // must match lib/career/seedCareers.ts `slug` values
  relatedCategories:  CareerCategory[]
  relatedPathways:    CareerPathway[]
  relatedSkills:      string[]

  learnerExplanation: string  // "Why it matters" — plain-language, never prescriptive
  // Phase 8.2 — concrete, non-personalized starting points ("what you could
  // explore"), kept distinct from learnerExplanation ("why it matters") per
  // the WHAT'S CHANGING / WHY IT MATTERS / WHAT YOU COULD EXPLORE structure.
  // Never reasons from a specific learner's capability/risk — that would
  // cross into personalization this module must never perform (§16).
  exploreNext: string[]

  sources: CareerSignalSource[]
}

const CONFIDENCE_RANK: Record<CareerSignalConfidence, number> = {
  ESTABLISHED: 2,
  EMERGING: 1,
  EARLY: 0,
}

export const CAREER_SIGNALS: CareerSignal[] = [
  {
    id: 'kenya-agriculture-digital-policy-2026',
    title: 'Kenya is building a national digital farming system',
    summary:
      "Kenya's Ministry of Agriculture and Livestock Development has drafted a national " +
      'policy and bill to coordinate AI, drones, sensors and farm data, building on a farmer ' +
      'registry that already covers over 7 million households.',
    signalType: 'TECHNOLOGY_SHIFT',
    geography: 'KENYA',
    confidence: 'EARLY',
    observedAt: '2026-03-26',
    lastReviewedAt: '2026-08-24',
    relatedCareerSlugs: ['agricultural-scientist', 'environmental-scientist'],
    relatedCategories: ['agriculture', 'environment'],
    relatedPathways: ['STEM'],
    relatedSkills: ['data analysis', 'drone and sensor tools', 'digital record-keeping'],
    learnerExplanation:
      'Farming in Kenya is connecting more with data, drones and digital systems. ' +
      'Careers in agriculture increasingly overlap with technology and environmental science.',
    exploreNext: [
      'Learn how drones and sensors collect data on crops and soil',
      'Look into basic GIS and satellite-mapping tools',
      'Explore how a farm data registry like KIAMIS actually works',
    ],
    sources: [
      {
        publisher: 'TechAfrica News',
        url: 'https://techafricanews.com/2026/03/26/kenya-unveils-draft-agricultural-data-and-digital-policy-to-transform-farming-sector/',
        sourceType: 'tier2',
        publishedAt: '2026-03-26',
        claim:
          "Kenya's Ministry of Agriculture and Livestock Development released a draft " +
          'Agricultural Data, Information and Digital Policy and Digital Agricultural ' +
          'Information Bill establishing a national digital agriculture centre (KADIC) to ' +
          'coordinate AI, drone, IoT and blockchain use in farming, building on a farmer ' +
          'registry (KIAMIS) already covering over 7.2 million registered farmers.',
      },
    ],
  },
  {
    id: 'kenya-green-buildings-roadmap-2026',
    title: 'Kenya has a 15-year plan for lower-carbon buildings',
    summary:
      'The State Department for Public Works launched a National Buildings & Construction ' +
      'Decarbonization Roadmap (2026-2040), starting with phased building-code revisions this ' +
      'year and mandatory minimum energy-performance standards for new public buildings by 2030.',
    signalType: 'PROFESSIONAL_STANDARD_CHANGE',
    geography: 'KENYA',
    confidence: 'EARLY',
    observedAt: '2026-02-27',
    lastReviewedAt: '2026-08-24',
    relatedCareerSlugs: ['civil-engineer', 'environmental-scientist'],
    relatedCategories: ['trades', 'environment'],
    relatedPathways: ['STEM'],
    relatedSkills: ['low-carbon materials', 'energy-efficient design', 'lifecycle carbon assessment'],
    learnerExplanation:
      'How buildings get designed and built in Kenya is starting to change, with new rules ' +
      'about energy use and materials. Civil engineering is connecting more with environmental science.',
    exploreNext: [
      'Compare traditional building materials with low-carbon alternatives',
      'Learn what "energy-efficient design" means for a real building',
      'Look into how a building\'s lifecycle carbon footprint gets measured',
    ],
    sources: [
      {
        publisher: 'Big3Africa',
        url: 'https://big3africa.org/2026/02/27/kenya-launches-2026-2040-green-buildings-roadmap/',
        sourceType: 'tier2',
        publishedAt: '2026-02-27',
        claim:
          "Kenya's State Department for Public Works formally launched the National Buildings " +
          '& Construction Decarbonization Roadmap (2026-2040), setting phased building-code ' +
          'revisions from 2026 and mandatory minimum energy-performance standards for new ' +
          'public buildings by 2030.',
      },
    ],
  },
  {
    id: 'kenya-accounting-audit-analytics-2026',
    title: "Kenya's accounting regulator is pushing data-analytics skills",
    summary:
      'ICPAK, the body that regulates accountants in Kenya, runs its own audit-automation ' +
      'platform and continuing-education programmes in data analytics, reflecting a shift ' +
      'toward automated, data-driven auditing.',
    signalType: 'SKILL_SHIFT',
    geography: 'KENYA',
    confidence: 'EARLY',
    observedAt: '2026-08-24',
    lastReviewedAt: '2026-08-24',
    relatedCareerSlugs: ['accountant-financial-analyst'],
    relatedCategories: ['finance'],
    relatedPathways: ['Social Sciences'],
    relatedSkills: ['data analytics', 'audit automation software'],
    learnerExplanation:
      'Accounting increasingly involves using software and data analysis, not just manual ' +
      "bookkeeping. Kenya's accounting body is actively training its members in these tools.",
    exploreNext: [
      'Try a beginner spreadsheet or data-analysis exercise',
      'Learn what audit-automation software actually does',
      'Explore how accountants use data beyond bookkeeping today',
    ],
    sources: [
      {
        publisher: 'ICPAK (Institute of Certified Public Accountants of Kenya)',
        url: 'https://www.icpak.com/',
        sourceType: 'tier1',
        publishedAt: '2026-08-24',
        claim:
          "ICPAK, Kenya's statutory accountancy regulator, operates the myAudit audit-automation " +
          'platform for members and runs continuing professional development programmes in data ' +
          'analytics, including a Risk Management and Data Analytics seminar (South Rift Branch, ' +
          '27 August 2026).',
      },
    ],
  },
  {
    id: 'kenya-ai-strategy-tvet-ict-2026',
    title: 'Kenya is training more people for AI and software jobs through TVET',
    summary:
      "Kenya's national AI Strategy (2025-2030) is pairing government policy with industry " +
      'partnerships — including a plan to expand ICT training to 150 TVET academies producing ' +
      'about 1,000 professional certifications a year.',
    signalType: 'EDUCATION_ROUTE_CHANGE',
    geography: 'KENYA',
    confidence: 'EMERGING',
    observedAt: '2026-08-02',
    lastReviewedAt: '2026-08-24',
    relatedCareerSlugs: ['software-engineer'],
    relatedCategories: ['technology'],
    relatedPathways: ['STEM'],
    relatedSkills: ['software engineering', 'data science', 'cloud computing'],
    learnerExplanation:
      'Kenya is putting real training capacity behind software and AI skills through TVET ' +
      'colleges and industry partnerships — software engineering is connecting more with ' +
      'formal AI training routes.',
    exploreNext: [
      'Look into TVET ICT academy training options near you',
      'Try a beginner coding or data-science course',
      'Learn what "cloud computing" actually means in practice',
    ],
    sources: [
      {
        publisher: 'The Standard',
        url: 'https://www.standardmedia.co.ke/education/article/2001554397/government-roots-kenyas-ai-ambitions-in-industry-led-digital-skills',
        sourceType: 'tier2',
        publishedAt: '2026-08-02',
        claim:
          "Kenya's AI Strategy (2025-2030) centres industry-led digital-skills training; " +
          'Ministry officials describe digital-skills development as a key enabler of economic ' +
          'growth and job creation.',
      },
      {
        publisher: 'Capital FM Africa',
        url: 'https://capitalfm.africa/kenyas-ai-skills-gap-how-universities-are-preparing-the-next-generation/',
        sourceType: 'tier2',
        publishedAt: '2026-08-14',
        claim:
          'A State Department–Huawei partnership targets 150 ICT Academies across Kenyan TVET ' +
          'institutions, aiming for about 1,000 professional certifications and 150 trained ' +
          'instructors annually.',
      },
    ],
  },
  {
    id: 'ai-radiology-augmentation-2026',
    title: 'AI is changing how X-rays and scans get reviewed, worldwide',
    summary:
      'Radiology is the medical specialty where regulators have cleared the most AI tools ' +
      'globally — most are designed to assist doctors in reviewing images faster, not replace them.',
    signalType: 'TECHNOLOGY_SHIFT',
    geography: 'GLOBAL',
    confidence: 'EMERGING',
    observedAt: '2025-12-31',
    lastReviewedAt: '2026-08-24',
    relatedCareerSlugs: ['medical-doctor'],
    relatedCategories: ['health'],
    relatedPathways: ['STEM'],
    relatedSkills: ['medical imaging software', 'AI-assisted diagnostics'],
    learnerExplanation:
      'Doctors who specialise in reading scans increasingly use AI software as a second pair ' +
      'of eyes. This makes the technical side of medicine more important, but a trained doctor ' +
      'still makes the final call.',
    exploreNext: [
      'Learn how medical imaging (X-ray, MRI, CT scan) actually works',
      'Explore what "AI-assisted diagnosis" means in plain terms',
      'Compare the training path for a radiologist with a general doctor',
    ],
    sources: [
      {
        publisher: 'The Imaging Wire',
        url: 'https://theimagingwire.com/2026/03/11/numbers-from-the-fda-show-radiology-is-maintaining-its-lead/',
        sourceType: 'tier2',
        publishedAt: '2026-03-12',
        claim:
          'Of 1,451 AI-enabled medical devices authorized by the US FDA since 1995, 1,104 (76%) ' +
          'are radiology devices, and radiology accounted for roughly three-quarters of new AI ' +
          'device clearances through 2025.',
      },
      {
        publisher: 'IntuitionLabs',
        url: 'https://intuitionlabs.ai/articles/ai-radiology-trends-2025',
        sourceType: 'tier3',
        publishedAt: '2026-08-08',
        claim:
          "Industry surveys and expert commentary describe current AI imaging tools as " +
          "augmenting radiologists' work rather than replacing them; a 2024 European survey " +
          'found 48% of radiologists actively using AI tools, up from 20% in 2018.',
      },
    ],
  },

  // ── Phase 8.2 additions (curated 2026-08-24) ────────────────────────────────

  {
    id: 'kenya-newsroom-ai-policy-2026',
    title: 'Kenyan newsrooms are writing their own rules for AI',
    summary:
      "Nation Media Group introduced a formal AI policy for its editorial and business " +
      'operations in 2026, and journalism training programmes are now teaching fact-checking ' +
      'and AI-verification skills as standard practice, not an afterthought.',
    signalType: 'NEW_WORK_PRACTICE',
    geography: 'KENYA',
    confidence: 'EMERGING',
    observedAt: '2026-06-02',
    lastReviewedAt: '2026-08-24',
    relatedCareerSlugs: ['journalist-content-creator', 'journalist-media-producer'],
    relatedCategories: ['media'],
    relatedPathways: ['Social Sciences', 'Arts & Sports Science'],
    relatedSkills: ['fact-checking', 'AI-verification', 'data literacy'],
    learnerExplanation:
      'Journalism increasingly means knowing how to check whether information (including ' +
      'AI-generated content) is actually true. Newsrooms are building this into how they work, ' +
      'not treating it as optional.',
    exploreNext: [
      'Try a basic fact-checking exercise on a real news story',
      'Learn how to spot AI-generated text or images',
      'Explore what a newsroom AI policy actually restricts or allows',
    ],
    sources: [
      {
        publisher: 'Reuters Institute for the Study of Journalism',
        url: 'https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/kenya',
        sourceType: 'tier1',
        publishedAt: '2026-06-16',
        claim:
          'Nation Media Group implemented a formal AI policy framework covering editorial and ' +
          'business operations in 2026; sector-wide AI adoption in Kenyan newsrooms remains ' +
          'uneven due to resource constraints and concerns about accuracy, ethics and job security.',
      },
      {
        publisher: 'The Star (Kenya)',
        url: 'https://www.the-star.co.ke/sasa/technology/2026-06-02-fact-checking-skills-gain-urgency-as-ai-reshapes-journalism',
        sourceType: 'tier2',
        publishedAt: '2026-06-02',
        claim:
          'A National Fact-Checking Bootcamp at Zetech University (with Africa Check and DIMLIS ' +
          'Africa) trained university students on ethical fact-checking and responsible AI use ' +
          'in journalism.',
      },
    ],
  },

  {
    id: 'kenya-jss-teacher-digital-training-2026',
    title: 'Kenya is training over 62,000 teachers in digital skills',
    summary:
      "The Teachers Service Commission and ICT Authority are training 62,565 Junior Secondary " +
      'School teachers across 20,855 schools in all 47 counties in digital skills for ' +
      'Competency-Based Education, using a cascade model of trained trainers.',
    signalType: 'EDUCATION_ROUTE_CHANGE',
    geography: 'KENYA',
    confidence: 'EMERGING',
    observedAt: '2026-06-26',
    lastReviewedAt: '2026-08-24',
    relatedCareerSlugs: ['teacher-education-technologist'],
    relatedCategories: ['education'],
    relatedPathways: ['Social Sciences'],
    relatedSkills: ['digital literacy instruction', 'ICT-integrated teaching', 'CBE digital tools'],
    learnerExplanation:
      'Teaching in Kenya now includes real digital-skills training, not just subject content. ' +
      'Teachers who combine subject expertise with technology skills are increasingly the norm, ' +
      'not the exception.',
    exploreNext: [
      'Look into what a "digital literacy" lesson actually involves',
      'Explore free tools teachers use for CBE-aligned digital lessons',
      'Learn what an ICT Champion Teacher does in a school',
    ],
    sources: [
      {
        publisher: 'EduTimes Africa',
        url: 'https://edutimesafrica.com/kenya-to-train-over-62000-jss-teachers-in-nationwide-digital-skills/',
        sourceType: 'tier2',
        publishedAt: '2026-06-26',
        claim:
          'TSC and the ICT Authority are training 62,565 JSS teachers across 20,855 schools in ' +
          'all 47 counties, using 3,754 Trainers of Trainers, as part of the Kenya Digital ' +
          'Economy Acceleration Project (KDEAP).',
      },
    ],
  },

  {
    id: 'kenya-fintech-digital-economy-2026',
    title: "Kenya's digital finance sector keeps growing fast",
    summary:
      'About 450 fintech companies now operate in Kenya across payments, lending, insurance ' +
      'and agri-finance, with 85% of adults holding a formal financial account — and the ' +
      'Central Bank now formally regulates digital lenders under new rules.',
    signalType: 'REGIONAL_OPPORTUNITY',
    geography: 'KENYA',
    confidence: 'EMERGING',
    observedAt: '2026-08-24',
    lastReviewedAt: '2026-08-24',
    relatedCareerSlugs: ['entrepreneur-business', 'economist-policy-analyst'],
    relatedCategories: ['finance', 'business'],
    relatedPathways: ['Social Sciences'],
    relatedSkills: ['digital payments', 'financial regulation basics', 'mobile-money systems'],
    learnerExplanation:
      "Kenya's mobile-money and digital-lending sector is large and still expanding, with real " +
      'regulation now in place. Business and economics careers increasingly involve understanding ' +
      'digital financial systems, not just traditional banking.',
    exploreNext: [
      'Learn how mobile money (like M-Pesa) actually moves funds',
      'Explore what a digital lending regulation is meant to protect against',
      'Look into what a fintech startup does differently from a bank',
    ],
    sources: [
      {
        publisher: 'The Fintech Times',
        url: 'https://thefintechtimes.com/the-fintech-and-wider-digital-ecosystem-of-kenya-in-2026/',
        sourceType: 'tier2',
        publishedAt: '2026-08-24',
        claim:
          'Roughly 450 fintech companies operate in Kenya; about 85% of adults have formal ' +
          'financial accounts (up from ~26% in 2006); the Central Bank of Kenya now regulates ' +
          'digital lenders under Digital Credit Providers Regulations.',
      },
      {
        publisher: 'Statista',
        url: 'https://www.statista.com/outlook/dmo/fintech/kenya',
        sourceType: 'tier3',
        publishedAt: '2026-08-24',
        claim:
          "Kenya's digital assets/fintech market shows continued year-on-year growth, and mobile " +
          'money account numbers continued rising through early 2026.',
      },
    ],
  },

  {
    id: 'kenya-mental-health-act-2026',
    title: 'Kenyan law now requires mental health support in schools and clinics',
    summary:
      "Kenya's Mental Health Act now requires counties to provide outpatient mental health " +
      'services and requires mental health education to be built into the school curriculum — ' +
      'and government is actively recruiting more counselling psychologists to meet the need.',
    signalType: 'PROFESSIONAL_STANDARD_CHANGE',
    geography: 'KENYA',
    confidence: 'EMERGING',
    observedAt: '2023-12-11',
    lastReviewedAt: '2026-08-24',
    relatedCareerSlugs: ['counselling-psychologist', 'social-worker-community-developer'],
    relatedCategories: ['health', 'education'],
    relatedPathways: ['Social Sciences'],
    relatedSkills: ['mental health literacy', 'counselling practice', 'community outreach'],
    learnerExplanation:
      'Mental health support is becoming a required part of Kenyan schools and healthcare, not ' +
      'an optional extra. This is creating real, government-backed demand for counsellors, ' +
      'social workers and psychologists.',
    exploreNext: [
      'Learn what a counselling psychologist actually does day to day',
      'Explore how mental health education could look in a school setting',
      'Look into the qualifications needed to become a counsellor in Kenya',
    ],
    sources: [
      {
        publisher: 'Kenya Law (official Mental Health Act, Cap. 248)',
        url: 'https://new.kenyalaw.org/akn/ke/act/1989/10/eng@2023-12-11',
        sourceType: 'tier1',
        publishedAt: '2023-12-11',
        claim:
          "Kenya's Mental Health Act requires counties to provide outpatient mental health " +
          'services at multiple facility levels and requires the mental health board to work ' +
          'with education authorities to integrate mental health content into school curricula.',
      },
      {
        publisher: 'Kenya News Agency',
        url: 'https://www.kenyanews.go.ke/government-to-improve-counseling-services-to-its-employees/',
        sourceType: 'tier1',
        publishedAt: '2026-08-24',
        claim:
          'The Ministry of Health aims to recruit 60 more counsellors by the end of the ' +
          'financial year, following a supervision workshop for 18 newly employed counselling ' +
          'psychologists in the public service.',
      },
    ],
  },

  {
    id: 'kenya-sports-science-analytics-2026',
    title: 'Sports careers in Kenya increasingly involve data, not just training',
    summary:
      'Kenyan sports science degree programmes now include performance-data analytics, ' +
      'biomechanics labs and technology units alongside coaching and physiology, and the Kenya ' +
      'Academy of Sports is running research workshops with international sports-science partners.',
    signalType: 'SKILL_SHIFT',
    geography: 'KENYA',
    confidence: 'EARLY',
    observedAt: '2026-08-24',
    lastReviewedAt: '2026-08-24',
    relatedCareerSlugs: ['sports-coach-athlete-development'],
    relatedCategories: ['education', 'health'],
    relatedPathways: ['Arts & Sports Science'],
    relatedSkills: ['performance data analytics', 'sports biomechanics', 'injury-prevention science'],
    learnerExplanation:
      'Coaching and athlete-development careers are connecting more with science and data — ' +
      'understanding how the body performs and recovers matters alongside coaching skill itself.',
    exploreNext: [
      'Learn what sports biomechanics actually studies',
      'Explore how performance-tracking data helps an athlete improve',
      'Look into what a sports science degree covers beyond coaching',
    ],
    sources: [
      {
        publisher: 'Kenyatta University',
        url: 'https://www.ku.ac.ke/course/bachelor-of-science-exercise-and-sports-science/',
        sourceType: 'tier1',
        publishedAt: '2026-08-24',
        claim:
          "Kenyatta University's Exercise and Sports Science programme includes dedicated units " +
          'in sports data analytics, computer technology applications and laboratory-based ' +
          'performance testing, alongside coaching and physiology.',
      },
      {
        publisher: 'Kenya Academy of Sports',
        url: 'https://kas.or.ke/sports-science-training-workshop-and-research-seminar/',
        sourceType: 'tier1',
        publishedAt: '2026-08-24',
        claim:
          'The Kenya Academy of Sports ran a joint Sports Science Training Workshop and Research ' +
          'Seminar with the Hungarian University of Sports Science, covering athlete performance ' +
          'and research innovation.',
      },
    ],
  },

  {
    id: 'kenya-creative-economy-bill-2026',
    title: "Kenya is putting real money and law behind its creative industries",
    summary:
      "Kenya's 2026/27 budget allocated Ksh 8.6 billion to digital and creative-economy " +
      'programmes, including new film hubs in three counties, while the proposed Creative ' +
      'Economy Bill would create a national commission to support film, music, fashion and ' +
      'content creation.',
    signalType: 'REGIONAL_OPPORTUNITY',
    geography: 'KENYA',
    confidence: 'EMERGING',
    observedAt: '2026-06-11',
    lastReviewedAt: '2026-08-24',
    relatedCareerSlugs: [
      'graphic-designer-creative-director',
      'graphic-designer-creative-technologist',
      'journalist-content-creator',
      'journalist-media-producer',
    ],
    relatedCategories: ['creative', 'media'],
    relatedPathways: ['Arts & Sports Science', 'Social Sciences'],
    relatedSkills: ['content production', 'film/media production', 'creative entrepreneurship'],
    learnerExplanation:
      "Kenya's creative industries (film, design, content, music) are getting formal government " +
      'investment and legal structure, not just informal hustle. That means more organised paths ' +
      'into creative careers, alongside the entrepreneurial ones that already exist.',
    exploreNext: [
      'Learn what a film hub or production incentive programme actually does',
      'Explore the different roles behind making a film or ad campaign',
      'Look into what "content classification and licensing" means for creators',
    ],
    sources: [
      {
        publisher: 'KBC Digital',
        url: 'https://www.kbc.co.ke/budget-2026-creative-economy-digital-infrastructure-receive-ksh8-6-billion/',
        sourceType: 'tier2',
        publishedAt: '2026-06-11',
        claim:
          "Treasury CS John Mbadi's 2026/27 budget allocated Ksh 8.6 billion to digital economy " +
          'and creative-sector programmes, citing film, music and fashion as growth engines for ' +
          'youth employment.',
      },
      {
        publisher: 'AllAfrica',
        url: 'https://allafrica.com/stories/202509230616.html',
        sourceType: 'tier3',
        publishedAt: '2025-09-23',
        claim:
          'Government and private-sector partners are working to grow Kenya\'s creative economy ' +
          'and youth jobs, alongside the proposed Creative Economy Bill establishing a Kenya ' +
          'Audio-Visual and Cinema Commission.',
      },
    ],
  },
]

/**
 * Deterministic, pure lookup — no DB, no network, no learner state.
 * Selection is by explicit curated mapping only (no keyword matching, no ranking
 * by learner capability/interest). Capped at 3 cards, most-recently-reviewed
 * first, ties broken by confidence — never by engagement.
 */
export function getCareerSignalsForCareer(careerSlug: string): CareerSignal[] {
  return CAREER_SIGNALS.filter((signal) => signal.relatedCareerSlugs.includes(careerSlug))
    .sort((a, b) => {
      if (a.lastReviewedAt !== b.lastReviewedAt) {
        return b.lastReviewedAt.localeCompare(a.lastReviewedAt)
      }
      return CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]
    })
    .slice(0, 3)
}

export function getCareerSignalsForCategory(category: CareerCategory): CareerSignal[] {
  return CAREER_SIGNALS.filter((signal) => signal.relatedCategories.includes(category))
}
