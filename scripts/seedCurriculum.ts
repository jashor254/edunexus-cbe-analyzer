import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEEPSEEK_KEY = process.env.DEEPSEEK_AI_API_KEY

async function callDeepSeek(prompt: string): Promise<any> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'Kenya curriculum expert. Return ONLY valid JSON. No markdown. No explanation. No code blocks. Pure JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 3000,
    }),
  })
  const data = await res.json()
  const content = data.choices[0].message.content
  const cleaned = content
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim()
  return JSON.parse(cleaned)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Curriculum Structure ───────────────────────────────────────────────────

const CURRICULUM_STRUCTURE = {
  cbc_junior: {
    levelName: 'CBC Junior Secondary',
    grades: [
      { name: 'Grade 7', numeric: 7 },
      { name: 'Grade 8', numeric: 8 },
      { name: 'Grade 9', numeric: 9 },
    ],
    subjects: [
      'Mathematics',
      'English',
      'Kiswahili',
      'Integrated Science',
      'Social Studies',
      'Pre-Technical Studies',
      'Agriculture and Nutrition',
      'Creative Arts and Sports',
      'Christian Religious Education',
      'Islamic Religious Education',
    ],
    suggestedLessonsPerSubstrand: 4,
  },
  cbc_senior: {
    levelName: 'CBC Senior Secondary',
    grades: [{ name: 'Grade 10', numeric: 10 }],
    subjects: [
      'Mathematics',
      'English',
      'Kiswahili',
      'Biology',
      'Chemistry',
      'Physics',
      'History and Government',
      'Geography',
      'Business Studies',
      'Computer Science',
      'Agriculture',
      'Christian Religious Education',
      'Islamic Religious Education',
    ],
    suggestedLessonsPerSubstrand: 4,
  },
  form3: {
    levelName: '8-4-4 Form 3',
    grades: [{ name: 'Form 3', numeric: 11 }],
    subjects: [
      'Mathematics',
      'English',
      'Kiswahili',
      'Biology',
      'Chemistry',
      'Physics',
      'History and Government',
      'Geography',
      'Business Studies',
      'Computer Studies',
      'Agriculture',
      'Christian Religious Education',
      'Islamic Religious Education',
      'Home Science',
      'Art and Design',
    ],
    suggestedLessonsPerSubstrand: 6,
  },
  form4: {
    levelName: '8-4-4 Form 4',
    grades: [{ name: 'Form 4', numeric: 12 }],
    subjects: [
      'Mathematics',
      'English',
      'Kiswahili',
      'Biology',
      'Chemistry',
      'Physics',
      'History and Government',
      'Geography',
      'Business Studies',
      'Computer Studies',
      'Agriculture',
      'Christian Religious Education',
      'Islamic Religious Education',
      'Home Science',
      'Art and Design',
    ],
    suggestedLessonsPerSubstrand: 6,
  },
} as const

type CurriculumKey = keyof typeof CURRICULUM_STRUCTURE

// ─── Prompt Builders ─────────────────────────────────────────────────────────

function buildCBCPrompt(subject: string, grade: string): string {
  return `
Generate complete KICD CBC rationalized curriculum strands and substrands for:
Subject: ${subject}
${grade}
Curriculum: Kenya CBC Competency-Based

Return ONLY this JSON structure:
{
  "strands": [
    {
      "title": "Strand title here",
      "order": 1,
      "substrands": [
        {
          "title": "Substrand title",
          "suggested_lessons": 4,
          "order": 1
        }
      ]
    }
  ]
}

Rules:
- Use EXACT KICD rationalized 2024 strand titles
- Include ALL strands for this subject and grade
- Each strand should have 3-6 substrands
- suggested_lessons = 4 for most substrands
- Return ONLY valid JSON, nothing else
  `
}

function build844Prompt(subject: string, form: string): string {
  return `
Generate complete Kenya 8-4-4 KCSE syllabus topics and subtopics for:
Subject: ${subject}
${form}
Curriculum: Kenya 8-4-4 KCSE

Return ONLY this JSON structure:
{
  "strands": [
    {
      "title": "Topic/Chapter title",
      "order": 1,
      "substrands": [
        {
          "title": "Subtopic title",
          "suggested_lessons": 6,
          "order": 1
        }
      ]
    }
  ]
}

Rules:
- Use EXACT KCSE syllabus topic titles
- Include ALL topics for this subject and form
- Each topic should have 3-8 subtopics
- suggested_lessons = 6 for most subtopics
- Return ONLY valid JSON, nothing else
  `
}

// ─── Seed Subject ─────────────────────────────────────────────────────────────

async function seedSubject(
  learningAreaId: string,
  subject: string,
  grade: string,
  curriculumType: string,
  suggestedLessons: number
): Promise<number> {
  const isCBC = curriculumType.startsWith('cbc')

  const prompt = isCBC
    ? buildCBCPrompt(subject, grade)
    : build844Prompt(subject, grade)

  let result: any
  try {
    result = await callDeepSeek(prompt)
  } catch (err) {
    console.error(`  Failed to generate ${subject} ${grade}:`, err)
    return 0
  }

  const strands: any[] = result.strands || []
  let totalSubstrands = 0

  for (const [si, strand] of strands.entries()) {
    const { data: strandRow, error: strandErr } = await supabase
      .from('sow_strands')
      .insert({
        learning_area_id: learningAreaId,
        title: strand.title,
        order_index: strand.order || si + 1,
      })
      .select()
      .single()

    if (strandErr || !strandRow) {
      console.error(`  Strand insert error:`, strandErr)
      continue
    }

    for (const [ssi, substrand] of (strand.substrands as any[]).entries()) {
      const { error: subErr } = await supabase.from('sow_substrands').insert({
        strand_id: strandRow.id,
        title: substrand.title,
        suggested_lessons: substrand.suggested_lessons || suggestedLessons,
        order_index: substrand.order || ssi + 1,
      })

      if (!subErr) totalSubstrands++
    }
  }

  return totalSubstrands
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Starting EduNexus curriculum seed...')
  console.log('='.repeat(50))

  let totalSubjects = 0
  let totalSubstrands = 0

  const levelOrderMap: Record<CurriculumKey, number> = {
    cbc_junior: 1,
    cbc_senior: 2,
    form3: 3,
    form4: 4,
  }

  for (const [currType, curr] of Object.entries(CURRICULUM_STRUCTURE) as [
    CurriculumKey,
    (typeof CURRICULUM_STRUCTURE)[CurriculumKey],
  ][]) {
    console.log(`\n  ${curr.levelName}`)
    console.log('-'.repeat(40))

    const { data: level } = await supabase
      .from('sow_levels')
      .insert({
        curriculum_type: currType,
        name: curr.levelName,
        order_index: levelOrderMap[currType],
      })
      .select()
      .single()

    if (!level) {
      console.error('  Failed to insert level:', curr.levelName)
      continue
    }

    for (const grade of curr.grades) {
      const { data: gradeRow } = await supabase
        .from('sow_grades')
        .insert({
          level_id: level.id,
          name: grade.name,
          numeric_grade: grade.numeric,
          order_index: grade.numeric,
        })
        .select()
        .single()

      if (!gradeRow) continue

      for (const [si, subject] of (curr.subjects as readonly string[]).entries()) {
        const { data: la } = await supabase
          .from('sow_learning_areas')
          .insert({
            grade_id: gradeRow.id,
            name: subject,
            short_name: subject
              .split(' ')
              .map((w) => w[0])
              .join(''),
            order_index: si + 1,
          })
          .select()
          .single()

        if (!la) continue

        const subCount = await seedSubject(
          la.id,
          subject,
          grade.name,
          currType,
          curr.suggestedLessonsPerSubstrand
        )

        console.log(`  ${subject} ${grade.name} — ${subCount} substrands`)

        totalSubjects++
        totalSubstrands += subCount

        await sleep(800)
      }
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('SEED COMPLETE!')
  console.log('='.repeat(50))
  console.log('Summary:')
  console.log(`   Subjects seeded: ${totalSubjects}`)
  console.log(`   Total substrands: ${totalSubstrands}`)
  console.log(`   CBC Junior (G7-9): 30 subjects`)
  console.log(`   CBC Senior (G10): 13 subjects`)
  console.log(`   8-4-4 Form 3: 15 subjects`)
  console.log(`   8-4-4 Form 4: 15 subjects`)
  console.log('='.repeat(50))
  console.log('EduNexus curriculum DB is ready!')
}

main().catch(console.error)
