// lib/career/clinicReportBuilder.ts
// Builds the in-page clinic report data from student profile + assessments + career matches.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getCareerBySlug, getMatchesForStudent, getCurrentSkillsForAge, getNextSkillsForAge, getAgeRangeLabel } from './careerEngine'
import { generateCareerMatches } from './matchEngine'
import { STANDARD_DISCLAIMER } from './types'
import type { ClinicReport, SubjectScoreRow, Career, SkillTimelineItem } from './types'
import { calculateKJSEAComposite, calculateJuniorPathwayAffinity, calculatePathwayGapAnalysis, PATHWAY_DISCLAIMER, normalizeSubjectScores } from '@/lib/pathwayCalculator'

// ─── Subject display names (Fix 3) ────────────────────────────────────────────

const SUBJECT_DISPLAY_NAMES: Record<string, string> = {
  cre:                          'Christian Religious Education',
  christian_religious_education:'Christian Religious Education',
  pre_technical_studies:        'Pre-Technical Studies',
  pre_technical:                'Pre-Technical Studies',
  creative_arts_sports:         'Creative Arts & Sports',
  creative_arts:                'Creative Arts & Sports',
  agriculture_nutrition:        'Agriculture & Nutrition',
  agriculture:                  'Agriculture',
  social_studies:               'Social Studies',
  integrated_science:           'Integrated Science',
  mathematics:                  'Mathematics',
  core_mathematics:             'Mathematics',
  // Essential Mathematics is distinct — does NOT display as plain "Mathematics"
  essential_mathematics:        'Essential Mathematics',
  'essential maths':            'Essential Mathematics',
  essential_maths:              'Essential Mathematics',
  emat:                         'Essential Mathematics',
  english:                      'English',
  kiswahili:                    'Kiswahili',
  biology:                      'Biology',
  chemistry:                    'Chemistry',
  physics:                      'Physics',
  history:                      'History & Citizenship',
  geography:                    'Geography',
  geo:                          'Geography',
  business_studies:             'Business Studies',
  ire:                          'Islamic Religious Education',
  home_science:                 'Home Science',
  hisc:                         'Home Science',
  community_service_learning:   'Community Service Learning',
  csl:                          'Community Service Learning',
  computer_studies:             'Computer Studies',
}

function displayName(raw: string): string {
  return SUBJECT_DISPLAY_NAMES[raw.toLowerCase()]
    ?? raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// ─── CBC level labels ──────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<number, string> = {
  1: 'Below Expectations',
  2: 'Approaching Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
}

function subjectStatus(score: number): SubjectScoreRow['status'] {
  if (score >= 3.5) return 'strong'
  if (score >= 2.5) return 'meets'
  if (score >= 1.5) return 'needs_work'
  return 'critical'
}

function calcAge(dob: string | null | undefined, grade: number): number {
  if (!dob) return grade + 5   // CBC: Grade 7→12, Age 12→17
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
}

// ─── Subject cluster detection ────────────────────────────────────────────────

// Essential Mathematics is NOT a STEM/science subject — students with emat are on Arts/Social pathway
const SCIENCE_SUBJECTS   = ['biology', 'chemistry', 'physics', 'mathematics', 'core_mathematics', 'integrated_science']
const HUMANITIES_SUBJECTS = [
  'history', 'geography', 'geo', 'social_studies',
  'cre', 'christian_religious_education', 'islamic_religious_education',
  'home_science', 'hisc',
  'community_service_learning', 'csl',
]
const BUSINESS_SUBJECTS  = ['business_studies', 'economics', 'accounting', 'commerce']
const ARTS_SUBJECTS      = ['creative_arts', 'music', 'art_design', 'creative_arts_sports']

function detectSubjectCluster(
  scores: Record<string, number>
): 'science' | 'humanities' | 'business' | 'arts' | 'general' {
  const keys = Object.keys(scores)
  if (keys.filter(s => SCIENCE_SUBJECTS.includes(s)).length >= 2)   return 'science'
  if (keys.filter(s => HUMANITIES_SUBJECTS.includes(s)).length >= 2) return 'humanities'
  if (keys.filter(s => BUSINESS_SUBJECTS.includes(s)).length >= 1)  return 'business'
  if (keys.filter(s => ARTS_SUBJECTS.includes(s)).length >= 1)      return 'arts'
  return 'general'
}

const CLUSTER_CAREER_CANDIDATES: Record<string, string[]> = {
  science:    ['medical-doctor', 'environmental-scientist', 'agricultural-scientist', 'civil-engineer', 'software-engineer'],
  humanities: ['journalist-content-creator', 'teacher-education-technologist', 'accountant-financial-analyst', 'entrepreneur-business'],
  business:   ['accountant-financial-analyst', 'entrepreneur-business', 'journalist-content-creator'],
  arts:       ['graphic-designer-creative-technologist', 'journalist-content-creator', 'teacher-education-technologist'],
  general:    ['teacher-education-technologist', 'entrepreneur-business', 'journalist-content-creator'],
}

// ─── Fix 1: Pathway-based skill timeline defaults ──────────────────────────────
// Used for junior students when no career match exists.

type PathwayTimeline = {
  now:  { ageRange: string; phase: string; skills: string[]; why: string; parentAction: string }
  next: { ageRange: string; phase: string; skills: string[]; why: string; parentAction: string }
}

const PATHWAY_TIMELINES: Record<string, PathwayTimeline> = {
  'STEM': {
    now: {
      ageRange: '14–16',
      phase: 'STEM Foundation',
      skills: [
        'Strengthen Biology and Chemistry foundations',
        'Practice mathematical reasoning — not just computation',
        'Start reading science articles (BBC Science, Nation Science)',
        'Join or start a science or coding club',
        'Build curiosity about how things work',
      ],
      why: 'Age 14–16 is when STEM subjects either click or become difficult. What happens here determines university subject choices.',
      parentAction: 'Ensure Science subjects are not dropped. Exposure to real STEM applications matters more than extra tuition right now.',
    },
    next: {
      ageRange: '16–18',
      phase: 'STEM Specialisation',
      skills: [
        'Choose specialist Science combination (e.g. Physics + Chemistry)',
        'Enter science competitions and fairs',
        'Begin KCSE subject selection with STEM focus',
        'Explore university entry requirements for target careers',
        'Develop research and experimental skills',
      ],
      why: 'Senior school subject choices lock in career options. STEM students who specialise early reach university better prepared.',
      parentAction: 'Research university Science requirements together. Visit science fairs or STEM events. The choice made at 16 matters.',
    },
  },
  'Social Sciences': {
    now: {
      ageRange: '14–16',
      phase: 'Humanities Foundation',
      skills: [
        'Debate and public speaking practice',
        'Reading newspapers — Nation, Standard',
        'Understanding Kenya current affairs',
        'Creative writing and storytelling',
        'Community involvement and leadership',
      ],
      why: 'Critical thinking and communication skills developed now will define career options in law, education, and public service.',
      parentAction: 'Encourage reading and discussion of current events. Ask for their opinion on news stories — this builds analytical thinking.',
    },
    next: {
      ageRange: '16–18',
      phase: 'Social Sciences Depth',
      skills: [
        'Study History, Geography, and CRE in depth',
        'Develop essay writing and argument skills',
        'Follow national politics and policy',
        'Explore law, diplomacy, and social work careers',
        'Build leadership roles in school',
      ],
      why: 'University courses in law, social work, and education reward students who can write well and think critically about society.',
      parentAction: 'Encourage writing beyond school — journals, letters, opinion pieces. Exposure to courts, NGOs, or government offices is powerful.',
    },
  },
  'Arts & Sports Science': {
    now: {
      ageRange: '14–16',
      phase: 'Creative Development',
      skills: [
        'Practice chosen art form or sport daily',
        'Study successful Kenyan creatives and athletes',
        'Build a portfolio — even small works count',
        'Learn basic digital tools (Canva, video editing)',
        'Enter school competitions and showcases',
      ],
      why: 'The creative and sports industries are growing in Kenya. Building a track record early sets the foundation.',
      parentAction: 'Support practice time and find local competitions or exhibitions. Creative work needs an audience to develop.',
    },
    next: {
      ageRange: '16–18',
      phase: 'Portfolio Building',
      skills: [
        'Develop a professional portfolio or performance record',
        'Explore KFCB, Sports Kenya, and arts institutions',
        'Consider technical qualifications (TVET arts/sports)',
        'Build social media presence around your craft',
        'Enter national competitions and talent searches',
      ],
      why: 'Arts and sports careers reward those who have demonstrable work by the time they finish school.',
      parentAction: 'Invest in tools, lessons, or competition entry fees. A serious portfolio opens doors that grades alone cannot.',
    },
  },
  'Business': {
    now: {
      ageRange: '14–16',
      phase: 'Business Foundations',
      skills: [
        'Basic accounting and money management',
        'Identifying problems and business opportunities',
        'Customer service and communication',
        'Understanding Kenya\'s economy and markets',
        'Starting a small school-based business project',
      ],
      why: 'Entrepreneurial thinking starts with observation. Now is the time to develop commercial awareness and financial literacy.',
      parentAction: 'Give small financial responsibilities — budgeting, market visits. Discuss family financial decisions at an age-appropriate level.',
    },
    next: {
      ageRange: '16–18',
      phase: 'Commercial Awareness',
      skills: [
        'Study Business Studies in depth for KCSE',
        'Understand basic financial statements and tax',
        'Research Kenya startup ecosystem',
        'Develop a business idea with a real plan',
        'Learn digital marketing and e-commerce basics',
      ],
      why: 'Kenya\'s growing economy rewards young people with practical business skills. Theory plus experience is the winning combination.',
      parentAction: 'Encourage small business experiments — even selling at school. Business skills built young compound over time.',
    },
  },
}

function getPathwayTimeline(pathway: string | null, age: number): {
  current: SkillTimelineItem | null
  next: SkillTimelineItem | null
} {
  const pw = pathway ?? 'STEM'
  const t = PATHWAY_TIMELINES[pw] ?? PATHWAY_TIMELINES['STEM']
  // Pick now vs next based on age
  const current: SkillTimelineItem = {
    age_range:     t.now.ageRange,
    phase:         t.now.phase,
    skills:        t.now.skills,
    why:           t.now.why,
    parent_action: t.now.parentAction,
  }
  const next: SkillTimelineItem = {
    age_range:     t.next.ageRange,
    phase:         t.next.phase,
    skills:        t.next.skills,
    why:           t.next.why,
    parent_action: t.next.parentAction,
  }
  return { current, next }
}

// ─── Fix 4: Specific parent actions ───────────────────────────────────────────

function subjectPathwayWhy(subject: string, pathway: string | null): string {
  const p = pathway ?? ''
  const reasons: Record<string, Record<string, string>> = {
    STEM: {
      mathematics:        'Mathematics is the core of every STEM career. Grade 9 is the last chance to build a solid foundation before harder topics arrive in Grade 10.',
      integrated_science: 'Integrated Science at Grade 9 directly feeds into Biology, Chemistry, and Physics in senior school — all critical for STEM pathways.',
      social_studies:     'For STEM careers like medicine and engineering, understanding geography and history builds the analytical thinking that separates good scientists from great ones.',
      english:            'Scientific writing and communication are career skills. Strong English means clearer thinking and better exam performance across all subjects.',
    },
    'Social Sciences': {
      mathematics:     'Quantitative reasoning is increasingly expected even in social science careers — economics, policy, and research all need it.',
      english:         'English is the primary tool of law, journalism, and public service careers. Every mark gained here compounds later.',
      kiswahili:       'For community-facing careers in Kenya, Kiswahili fluency opens doors that English alone cannot.',
      social_studies:  'This is the core subject for a Social Sciences pathway. Strong performance here directly strengthens the university application.',
    },
  }
  return (reasons[p] ?? {})[subject]
    ?? `Strengthening ${displayName(subject)} builds the well-rounded analytical skills needed for any pathway.`
}

function levelTarget(score: number): string {
  const current = Math.round(score)
  const target = Math.min(4, current + 1)
  const LABELS: Record<number, string> = { 1: 'Below', 2: 'Approaching', 3: 'Meets', 4: 'Exceeds' }
  return `Currently Level ${current} (${LABELS[current] ?? ''}) — target Level ${target} (${LABELS[target] ?? ''}) this term`
}

function concreteAction(subject: string, score: number, firstName: string = 'your child'): { action: string; time: string } {
  const actions: Record<string, { action: string; time: string }> = {
    mathematics:        { action: 'Mental maths daily — not textbook, just real life: market prices, distances, time calculations. No pen needed.', time: '10 minutes daily' },
    integrated_science: { action: 'Pick one science concept per week and look it up in real life. How does a fridge work? Why does bread rise? Curiosity drives retention.', time: '20 minutes, twice a week' },
    social_studies:     { action: `Read one newspaper article together each week and discuss it. Ask ${firstName}: "What caused this? What would you do differently?"`, time: '30 minutes, once a week' },
    english:            { action: 'Read aloud together for 10 minutes each evening — any book, newspaper, or story. Discuss what was read. Vocabulary grows through exposure.', time: '10 minutes daily' },
    kiswahili:          { action: 'Watch Kiswahili news together and encourage responses in Kiswahili. Casual conversation in Kiswahili builds fluency faster than revision.', time: '15 minutes daily' },
    biology:            { action: 'Walk outside and name 5 living things. Discuss how they work. Real observation beats memorisation every time.', time: '20 minutes, twice a week' },
    chemistry:          { action: 'Simple kitchen experiments: salt dissolving, vinegar + baking soda. Connect to class topics. Makes abstract concepts real.', time: '20 minutes, once a week' },
    physics:            { action: 'Spot physics in daily life: a bicycle, a door hinge, light through a window. Ask "why does this work?" before looking up the answer.', time: '10 minutes daily' },
    geography:          { action: 'Look at Kenya on Google Maps together once a week. Explore a different county: its features, economy, and climate.', time: '20 minutes, once a week' },
    history:            { action: 'Watch a short documentary or YouTube clip about Kenya history or world events. Discuss — "What would you have done?"', time: '30 minutes, once a week' },
  }
  return actions[subject.toLowerCase()]
    ?? { action: `Dedicate focused practice time to ${displayName(subject)} each week — even 20 minutes of undistracted study beats two hours of passive reading.`, time: '20 minutes, 3x a week' }
}

// ─── Main builder ──────────────────────────────────────────────────────────────

export async function buildClinicReport(
  studentId: string,
  db: SupabaseClient
): Promise<ClinicReport> {

  // 1. Student profile
  const { data: student, error: studentError } = await db
    .from('students')
    .select('id, name, grade, curriculum_type, date_of_birth')
    .eq('id', studentId)
    .single()

  if (studentError || !student) throw new Error('Student not found')

  const grade = student.grade as number
  const curriculum = (student.curriculum_type as string) ?? 'cbc'
  const age = calcAge(student.date_of_birth as string | null, grade)
  const ageRange = getAgeRangeLabel(age)

  // Junior: Grade 7-9 CBC; Senior: Grade 10+, IGCSE, Form 1-4
  const section: 'junior' | 'senior' =
    curriculum === 'igcse' || grade >= 10 ? 'senior' : 'junior'

  // 2. Latest assessment scores — stored as JSONB in subject_scores column
  const { data: assessments } = await db
    .from('assessments')
    .select('subject_scores, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Use the most recent assessment's subject_scores JSONB
  const subjectMap: Record<string, number> = {}
  if (assessments?.length) {
    const scores = (assessments[0].subject_scores as Record<string, number>) ?? {}
    // Normalise shorthand keys (emat→essential_mathematics, geo→geography, etc.)
    // so all downstream pathway logic, display names, and career matching are consistent.
    const rawMap: Record<string, number> = {}
    Object.entries(scores).forEach(([k, v]) => {
      if (typeof v === 'number') rawMap[k.toLowerCase()] = v
    })
    Object.assign(subjectMap, normalizeSubjectScores(rawMap))
  }

  const subjectRows: SubjectScoreRow[] = Object.entries(subjectMap).map(([subj, score]) => ({
    subject:      subj,
    display_name: displayName(subj),
    score,
    status:       subjectStatus(score),
  }))

  const sorted = [...subjectRows].sort((a, b) => b.score - a.score)
  const topSubjects  = sorted.slice(0, 3)
  const weakSubjects = sorted.slice(-2).reverse()

  const overall_score =
    subjectRows.length > 0
      ? subjectRows.reduce((s, r) => s + r.score, 0) / subjectRows.length
      : 0
  const overall_level = Math.max(1, Math.min(4, Math.round(overall_score))) as 1 | 2 | 3 | 4
  const overall_label = LEVEL_LABELS[overall_level]

  const topName  = topSubjects[0]?.display_name ?? 'key subjects'
  const weakName = weakSubjects[0]?.display_name ?? 'a few areas'
  const summary_sentence = `${student.name} is performing at ${overall_label} overall, with strong ${topName} skills and room to grow in ${weakName}.`

  // 3. Learning context (pathway, first_subject, session_goal)
  const { data: ctx } = await db
    .from('student_learning_context')
    .select('recommended_pathway, first_subject, session_goal, overall_tier')
    .eq('student_id', studentId)
    .maybeSingle()

  const recommended_pathway = ctx?.recommended_pathway as string | null
  const kjsea_composite     = section === 'junior' ? calculateKJSEAComposite(subjectMap) : undefined
  const stem_viable         = section === 'junior'
    ? calculateJuniorPathwayAffinity(subjectMap).stem_viable
    : undefined

  // 4. Dream career — check student_interests first (from assessment form), then career_interests
  const { data: studentInterests } = await db
    .from('student_interests')
    .select('interests')
    .eq('student_id', studentId)
    .maybeSingle()

  const dreamCareerFreeText = (studentInterests?.interests as Record<string, string> | null)?.dream_career ?? null

  const { data: careerInterests } = await db
    .from('student_career_interests')
    .select('career_slug, notes')
    .eq('student_id', studentId)
    .order('interest_level', { ascending: false })
    .limit(1)

  const dream_career = dreamCareerFreeText ?? careerInterests?.[0]?.career_slug ?? null

  // 5. Top career match (senior only) — generate fresh if missing
  let top_career = null
  let top_career_detail: Career | null = null

  if (section === 'senior') {
    let matches = await getMatchesForStudent(studentId)

    if (matches.length === 0 && Object.keys(subjectMap).length > 0) {
      // No match on file — generate one now via AI
      console.log('  No career matches found — generating via AI...')
      try {
        const cluster = detectSubjectCluster(subjectMap)
        const candidateSlugs = CLUSTER_CAREER_CANDIDATES[cluster]
        console.log(`  Subject cluster: ${cluster} → candidates: ${candidateSlugs.join(', ')}`)
        await generateCareerMatches({
          student_id:      studentId,
          student_name:    student.name as string,
          grade,
          age,
          subject_scores:  subjectMap,
          interests:       [],
          dream_career:    dream_career ?? undefined,
          candidate_slugs: candidateSlugs,
        })
        matches = await getMatchesForStudent(studentId)
        console.log(`  ✓ Generated ${matches.length} career matches`)
      } catch (err) {
        console.warn('  ⚠ Career match generation failed:', (err as Error).message)
      }
    }

    if (matches.length > 0) {
      top_career = matches[0]
      top_career_detail = await getCareerBySlug(top_career.career.slug)

      // Enrich subject gap rows with required scores
      if (top_career_detail) {
        const importance = top_career_detail.subject_importance ?? {}
        for (const row of subjectRows) {
          const imp = importance[row.subject]
          if (imp === 'critical') {
            row.required = 3
            row.gap = row.score < 3 ? 3 - row.score : 0
          } else if (imp === 'important') {
            row.required = 2
            row.gap = row.score < 2 ? 2 - row.score : 0
          }
        }
      }
    }
  }

  // Build career-relevant gap table (career required subjects × student scores)
  const career_gap_rows: typeof subjectRows = top_career_detail
    ? (top_career_detail.required_subjects ?? []).map(subject => {
        const imp      = (top_career_detail.subject_importance ?? {})[subject]
        const required = imp === 'critical' ? 3 : 2
        // If career needs core mathematics but student only has essential_mathematics, use that score
        // so the row shows "Essential Mathematics L2 / Need 3" rather than "Mathematics: Not studied"
        const resolvedSubject =
          subject === 'mathematics' && !subjectMap[subject] && subjectMap['essential_mathematics']
            ? 'essential_mathematics'
            : subject
        const score    = subjectMap[resolvedSubject] ?? 0
        const gap      = Math.max(0, required - score)
        const status: 'strong' | 'meets' | 'needs_work' | 'critical' =
          score >= required + 1 ? 'strong'
          : score >= required   ? 'meets'
          : gap >= 2            ? 'critical'
          : 'needs_work'
        return {
          subject:      resolvedSubject,
          display_name: displayName(resolvedSubject),
          score,
          required,
          gap,
          status,
        }
      }).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
    : []

  // 6. Fix 1 — Skill timeline: use career data if available, else pathway defaults
  const careerTimeline = top_career_detail?.skill_timeline ?? []
  const careerCurrentPhase = getCurrentSkillsForAge(careerTimeline, age)
  const careerNextPhase    = getNextSkillsForAge(careerTimeline, age)

  let current_phase: SkillTimelineItem | null = careerCurrentPhase
  let next_phase: SkillTimelineItem | null    = careerNextPhase

  if (!current_phase && section === 'junior') {
    // No career match — fall back to pathway-based timeline
    const pathwayTimeline = getPathwayTimeline(recommended_pathway, age)
    current_phase = pathwayTimeline.current
    next_phase    = pathwayTimeline.next
  }

  // 6b. Pathway gap analysis (junior only)
  const pathwayGapAnalysis = section === 'junior'
    ? calculatePathwayGapAnalysis(subjectMap, recommended_pathway)
    : undefined

  // 7. Fix 4 — Specific parent actions
  const parent_actions: ClinicReport['parent_actions'] = []
  const studentFirstName = (student.name as string).split(' ')[0]

  // Action 1: weakest subject — specific with level, why, concrete activity, time
  if (weakSubjects.length > 0) {
    const weak  = weakSubjects[0]
    const { action, time } = concreteAction(weak.subject, weak.score, studentFirstName)
    const why = top_career_detail
      ? `${weak.display_name} is ${top_career_detail.subject_importance?.[weak.subject] ?? 'important'} for ${top_career_detail.title}. ${levelTarget(weak.score)}.`
      : `${subjectPathwayWhy(weak.subject, recommended_pathway)} ${levelTarget(weak.score)}.`
    parent_actions.push({
      title:  `Strengthen ${weak.display_name}`,
      why,
      action: `${action} (${time})`,
    })
  }

  // Action 2: skill timeline for current age
  if (current_phase) {
    parent_actions.push({
      title:  `Build Age-Appropriate Skills (Ages ${ageRange})`,
      why:    current_phase.why,
      action: current_phase.parent_action,
    })
  } else {
    parent_actions.push({
      title:  'Explore Interests This Term',
      why:    'At this stage, broad exposure matters more than specialisation.',
      action: 'Encourage trying at least one new activity — debate, coding club, gardening, drama. Interests discovered at this age often become careers.',
    })
  }

  // Action 3: Career Explorer CTA (Section 2 — after career description)
  const careerCtaTitle = top_career
    ? `Explore ${top_career.career.title} and Other Matches`
    : 'Explore Career Options'
  const careerCtaWhy = top_career
    ? `${student.name as string}'s top career match is ${top_career.career.title} (${top_career.match_score}% match). The Career Explorer shows the full picture — salary ranges, what the job actually involves, Kenyan examples, and the exact subjects and skills needed to get there.`
    : 'Exploring careers early helps students make subject choices with purpose. The Career Explorer shows realistic Kenyan salary data, what each career actually involves day-to-day, and what it takes to get there.'
  parent_actions.push({
    title:  careerCtaTitle,
    why:    careerCtaWhy,
    action: 'Open the Career Explorer together. Read the full career profile — the salary tiers, Kenyan success stories, and the skill timeline. Ask your child: "Does this excite you?" That conversation matters more than the match score.',
    link:   '/career',
  })

  // Action 4: Learning Compass session
  const rawFirstSubject = ctx?.first_subject as string ?? topSubjects[0]?.subject ?? ''
  const firstSubject = rawFirstSubject ? displayName(rawFirstSubject) : (topSubjects[0]?.display_name ?? 'their strongest subject')
  parent_actions.push({
    title:  'Start a Learning Compass Session',
    why:    `The Learning Compass already knows ${student.name as string}'s exact level and will start precisely where they are — no wasted time.`,
    action: `Open the Learning Compass in ${firstSubject}. It will greet them by name, explain what they\'re working on, and adapt in real time. First session takes 10 minutes.`,
    link:   '/learn',
  })

  return {
    student_id:        studentId,
    student_name:      student.name as string,
    grade,
    age,
    curriculum_type:   curriculum,
    section,
    generated_at:      new Date().toISOString(),
    overall_score,
    overall_level,
    overall_label,
    top_subjects:      topSubjects,
    weak_subjects:     weakSubjects,
    summary_sentence,
    recommended_pathway,
    kjsea_composite,
    stem_viable,
    pathwayGapAnalysis,
    top_career,
    career_gap_rows: career_gap_rows.length > 0 ? career_gap_rows : undefined,
    top_career_detail,
    dream_career,
    skill_timeline:    careerTimeline,
    current_age_range: ageRange,
    current_phase,
    next_phase,
    parent_actions,
    disclaimer: `This report reflects ${student.name as string}'s actual assessment scores. Sit with your child and read it together — they should know where they stand and where they're going.`,
  }
}
