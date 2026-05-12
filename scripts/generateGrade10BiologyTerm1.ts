/**
 * Grade 10 Biology — Term 1 Scheme of Work Generator
 *
 * Strand covered: Cell Biology and Biodiversity (25 substrands, 52 lessons)
 * Schedule:       13 weeks × 4 lessons/week = 52 teaching slots
 * Curriculum:     CBC Senior (cbc_senior)
 *
 * Run:  npx tsx scripts/generateGrade10BiologyTerm1.ts
 */

// Load env FIRST — before any module that reads process.env
import * as dotenv from 'dotenv'
dotenv.config({ path: '/home/the-dev/Desktop/edunexus-cbe-analyzer/.env.local' })

import * as fs from 'fs'
import * as path from 'path'
import { generateSchemePipeline } from '../lib/sow/lessonPipeline'
import { generateSOWHtml } from '../lib/sow/pdfGenerator'
import type { SelectedSubstrand, TimelineSlot, SOWContext, SOWPreviewData } from '../lib/sow/types'

// ─── Term 1 context ──────────────────────────────────────────────────────────

const CONTEXT: SOWContext = {
  school: 'Your School',
  grade: '10',
  gradeName: 'Grade 10',
  learningArea: 'biology',
  learningAreaName: 'Biology',
  term: 1,
  year: new Date().getFullYear(),
  curriculumMode: 'cbc_senior',
  textbook: 'Biology Student Book Grade 10 — KICD Approved',
}

// ─── Term schedule: 13 weeks × 4 lessons = 52 slots ────────────────────────

const LESSONS_PER_WEEK = 4
const TOTAL_WEEKS = 13

function buildTimeline(): TimelineSlot[] {
  const slots: TimelineSlot[] = []
  let idx = 1
  for (let week = 1; week <= TOTAL_WEEKS; week++) {
    for (let lesson = 1; lesson <= LESSONS_PER_WEEK; lesson++) {
      slots.push({ slotIndex: idx++, week, lesson, isBreak: false })
    }
  }
  return slots
}

// ─── Term 1 substrands (Strand: Cell Biology and Biodiversity) ───────────────
// Sourced from KICD Grade 10 Biology syllabus.
// 25 substrands × varied lesson counts = 52 total lessons.

const TERM1_SUBSTRANDS: SelectedSubstrand[] = [
  // ── Introduction to Biology (6 topics, 12 lessons) ──────────────────────
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss1',
    substrandTitle: 'Introduction to Biology — Meaning and application of Biology',
    lessonsRequired: 2,
    orderIndex: 1,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss2',
    substrandTitle: 'Introduction to Biology — Application of Biology in everyday life',
    lessonsRequired: 2,
    orderIndex: 2,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss3',
    substrandTitle: 'Introduction to Biology — Fields of study in Biology',
    lessonsRequired: 2,
    orderIndex: 3,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss4',
    substrandTitle: 'Introduction to Biology — Careers related to fields of study in Biology',
    lessonsRequired: 2,
    orderIndex: 4,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss5',
    substrandTitle: 'Introduction to Biology — Factors influencing career choices',
    lessonsRequired: 2,
    orderIndex: 5,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss6',
    substrandTitle: 'Introduction to Biology — Importance of Biology in everyday life',
    lessonsRequired: 2,
    orderIndex: 6,
  },

  // ── Specimen Collection and Preservation (10 topics, 21 lessons) ─────────
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss7',
    substrandTitle: 'Specimen Collection and Preservation — Apparatus for collecting specimen',
    lessonsRequired: 2,
    orderIndex: 7,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss8',
    substrandTitle: 'Specimen Collection and Preservation — Apparatus for processing and preserving specimen',
    lessonsRequired: 2,
    orderIndex: 8,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss9',
    substrandTitle: 'Specimen Collection and Preservation — Sorting, pressing and drying of specimen',
    lessonsRequired: 2,
    orderIndex: 9,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss10',
    substrandTitle: 'Specimen Collection and Preservation — Mounting, labelling, storage and protection',
    lessonsRequired: 2,
    orderIndex: 10,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss11',
    substrandTitle: 'Specimen Collection and Preservation — Making a herbarium',
    lessonsRequired: 2,
    orderIndex: 11,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss12',
    substrandTitle: 'Specimen Collection and Preservation — Improvising apparatus for collecting specimen',
    lessonsRequired: 2,
    orderIndex: 12,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss13',
    substrandTitle: 'Specimen Collection and Preservation — Improvising a sweep net and other apparatus',
    lessonsRequired: 2,
    orderIndex: 13,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss14',
    substrandTitle: 'Specimen Collection and Preservation — Collecting, processing and preserving an animal specimen',
    lessonsRequired: 2,
    orderIndex: 14,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss15',
    substrandTitle: 'Specimen Collection and Preservation — Project on collecting and preserving biological specimen',
    lessonsRequired: 3,
    orderIndex: 15,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss16',
    substrandTitle: 'Specimen Collection and Preservation — Importance of collecting and preserving biological specimen',
    lessonsRequired: 2,
    orderIndex: 16,
  },

  // ── Cell Structure and Specialisation (9 topics, 19 lessons) ────────────
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss17',
    substrandTitle: 'Cell Structure and Specialisation — Differences between light and electron microscope',
    lessonsRequired: 2,
    orderIndex: 17,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss18',
    substrandTitle: 'Cell Structure and Specialisation — Preparation of temporary slides',
    lessonsRequired: 2,
    orderIndex: 18,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss19',
    substrandTitle: 'Cell Structure and Specialisation — Estimation of cell size during microscopy',
    lessonsRequired: 2,
    orderIndex: 19,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss20',
    substrandTitle: 'Cell Structure and Specialisation — Plant and animal cell structure under the electron microscope',
    lessonsRequired: 2,
    orderIndex: 20,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss21',
    substrandTitle: 'Cell Structure and Specialisation — Structures and functions of cell organelles',
    lessonsRequired: 3,
    orderIndex: 21,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss22',
    substrandTitle: 'Cell Structure and Specialisation — Modelling plant and animal cells',
    lessonsRequired: 2,
    orderIndex: 22,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss23',
    substrandTitle: 'Cell Structure and Specialisation — Specialised cells in plants',
    lessonsRequired: 2,
    orderIndex: 23,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss24',
    substrandTitle: 'Cell Structure and Specialisation — Specialised cells in animals',
    lessonsRequired: 2,
    orderIndex: 24,
  },
  {
    strandId: 's1',
    strandTitle: 'Cell Biology and Biodiversity',
    substrandId: 'ss25',
    substrandTitle: 'Cell Structure and Specialisation — Cell organisation: Organelles, cells and tissues',
    lessonsRequired: 2,
    orderIndex: 25,
  },
]

// ─── Output helpers ──────────────────────────────────────────────────────────

const OUT_DIR = path.join(process.cwd(), 'output')

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Grade 10 Biology — Term 1 SOW Generator')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Subject : Biology`)
  console.log(`  Grade   : 10  (CBC Senior)`)
  console.log(`  Term    : 1`)
  console.log(`  Weeks   : ${TOTAL_WEEKS}   (${TOTAL_WEEKS * LESSONS_PER_WEEK} lesson slots)`)
  console.log(`  Topics  : ${TERM1_SUBSTRANDS.length} substrands`)
  const totalLessons = TERM1_SUBSTRANDS.reduce((s, ss) => s + ss.lessonsRequired, 0)
  console.log(`  Lessons : ${totalLessons}`)
  console.log('═══════════════════════════════════════════════════\n')

  const timeline = buildTimeline()

  console.log(`📅 Timeline built: ${timeline.length} slots\n`)
  console.log('🤖 Starting AI generation...')
  console.log('   (This takes ~5-10 min — each substrand calls DeepSeek)\n')

  const startedAt = Date.now()

  const result = await generateSchemePipeline({
    timeline,
    selectedSubstrands: TERM1_SUBSTRANDS,
    context: CONTEXT,
  })

  const elapsed = ((Date.now() - startedAt) / 1000 / 60).toFixed(1)

  console.log('\n═══════════════════════════════════════════════════')
  console.log('  GENERATION COMPLETE')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Status    : ${result.status}`)
  console.log(`  Generated : ${result.summary.generated} / ${result.summary.totalSlots} lessons`)
  console.log(`  Failed    : ${result.summary.failed}`)
  console.log(`  Time      : ${elapsed} min`)
  console.log('═══════════════════════════════════════════════════\n')

  if (result.failures.length > 0) {
    console.log('⚠️  Failed lessons:')
    result.failures.forEach(f =>
      console.log(`   Week ${f.week} Lesson ${f.lesson}: ${f.substrand} — ${f.error}`)
    )
    console.log()
  }

  ensureOutDir()
  const ts = timestamp()

  // ── Save raw JSON ────────────────────────────────────────────────────────
  const jsonPath = path.join(OUT_DIR, `SOW_Grade10_Biology_Term1_${ts}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`📄 JSON saved → ${jsonPath}`)

  // ── Build SOWPreviewData ──────────────────────────────────────────────────
  const avgConf =
    result.lessons.reduce((s, l) => s + l._confidence, 0) /
    Math.max(result.lessons.length, 1)

  const previewData: SOWPreviewData = {
    meta: {
      school: CONTEXT.school,
      grade: CONTEXT.gradeName,
      learningArea: CONTEXT.learningAreaName,
      term: `Term ${CONTEXT.term}`,
      year: CONTEXT.year,
      textbook: CONTEXT.textbook || '',
      totalLessons: result.lessons.length,
      totalWeeks: TOTAL_WEEKS,
      generatedDate: new Date().toLocaleDateString('en-KE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      curriculumMode: CONTEXT.curriculumMode,
      averageConfidence: Math.round(avgConf * 100),
    },
    lessons: result.lessons,
    breaks: [],
  }

  // ── Save HTML ─────────────────────────────────────────────────────────────
  const html = generateSOWHtml(previewData)
  const htmlPath = path.join(OUT_DIR, `SOW_Grade10_Biology_Term1_${ts}.html`)
  fs.writeFileSync(htmlPath, html, 'utf-8')
  console.log(`🌐 HTML saved → ${htmlPath}`)
  console.log('\n✅ Open the HTML file in a browser and use Ctrl+P → Save as PDF\n')
}

main().catch(err => {
  console.error('❌ Generation failed:', err)
  process.exit(1)
})
