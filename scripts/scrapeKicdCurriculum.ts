/**
 * scripts/scrapeKicdCurriculum.ts
 *
 * Downloads official KICD Grade 10 curriculum design PDFs, parses them with
 * DeepSeek AI, and upserts the structured data into the DB.
 *
 * Prerequisites:
 *   1. Run supabase/kicd_curriculum_migration.sql in the Supabase SQL editor first.
 *   2. pdftotext must be installed (apt: poppler-utils).
 *
 * Run:
 *   npx tsx scripts/scrapeKicdCurriculum.ts
 *   npx tsx scripts/scrapeKicdCurriculum.ts --subject "General Science"  (single subject)
 *   npx tsx scripts/scrapeKicdCurriculum.ts --dry-run                    (parse only, no DB write)
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import * as https from 'https'

dotenv.config({ path: '/home/the-dev/Desktop/edunexus-cbe-analyzer/.env.local' })

// ─── config ──────────────────────────────────────────────────────────────────

const GRADE10_ID   = 'b422d9f5-7ad3-4fc1-aac7-0eb71b795051'
const PDF_DIR      = path.join(__dirname, '../data/kicd-pdfs')
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_KEY = process.env.DEEPSEEK_AI_API_KEY!
const DRY_RUN      = process.argv.includes('--dry-run')
const ONLY_SUBJECT = (() => {
  const i = process.argv.indexOf('--subject')
  return i !== -1 ? process.argv[i + 1] : null
})()

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

fs.mkdirSync(PDF_DIR, { recursive: true })

// ─── subject → Google Drive file ID + DB name mapping ────────────────────────

const SUBJECTS: { name: string; driveId: string; pdfFile: string }[] = [
  { name: 'Agriculture',                   driveId: '1YBqULxVng8F7ShfF5vAF7RmUyNP64tAf', pdfFile: 'agriculture.pdf' },
  { name: 'Arabic Language',               driveId: '1e8CWeQZCrqAxGXCb0tDCiax6bUsRZaIw', pdfFile: 'arabic.pdf' },
  { name: 'Aviation',                      driveId: '1XWPyKA_DVNIcfqlMC7Y5NYXXdQEAiPC7', pdfFile: 'aviation.pdf' },
  { name: 'Biology',                       driveId: '1exwOYzxEe2b0Kf5Er7gVg38M_zWLCRRc', pdfFile: 'biology.pdf' },
  { name: 'Building Construction',         driveId: '1d2fF7eFSPYs6oWQDeuR88hwBHv8hH11O', pdfFile: 'building-construction.pdf' },
  { name: 'Business Studies',              driveId: '1r89jn_6LlQ9Dud_05xUZYW2pLnG8z72U', pdfFile: 'business-studies.pdf' },
  { name: 'Chemistry',                     driveId: '1nxRMErNRxtGUpPELbvGI3zSXu7EqcGax', pdfFile: 'chemistry.pdf' },
  { name: 'Computer Studies',              driveId: '1wUSy3wljUhjmYAglcvYbymfagHQlSTdF', pdfFile: 'computer-studies.pdf' },
  { name: 'Christian Religious Education', driveId: '1XJNNYDBsByYdNNtCKF4X67mXT8XTtP9t', pdfFile: 'cre.pdf' },
  { name: 'Electricity',                   driveId: '1OQmt_wa3NVfiHo509tx9MsWRob5i8-yj', pdfFile: 'electricity.pdf' },
  { name: 'English',                       driveId: '1FuBp8_gQjHCwSf_ZxAewW9K9LQll1uUw', pdfFile: 'english.pdf' },
  { name: 'Kiswahili Fasihi',              driveId: '16DqlD8aiaBdWhI7K_rwrspsb_HzlehOr', pdfFile: 'kiswahili-fasihi.pdf' },
  { name: 'Fine Arts',                     driveId: '1kJuGf1OcwlVLW7UYuFhjAVfGWXh5jkni', pdfFile: 'fine-arts.pdf' },
  { name: 'French Language',               driveId: '1wUd22nTlYL-Gk_hp9vcXtrE_vuPiRH6F', pdfFile: 'french.pdf' },
  { name: 'General Science',               driveId: '1afBTTI_ZX7d99Y4VNCNpzHD5mvWcxhhB', pdfFile: 'general-science.pdf' },
  { name: 'Geography',                     driveId: '1kVE7pf5hMDA-qQWc-Uf3FkDZGSuXWO78', pdfFile: 'geography.pdf' },
  { name: 'German Language',               driveId: '119stfxgRnDHe7pzXzzIOQ-XcmBtuP6v3', pdfFile: 'german.pdf' },
  { name: 'History and Citizenship',       driveId: '1PNgIqDrGg3Bukyk2PKkCLqpzPdInaawu', pdfFile: 'history.pdf' },
  { name: 'Home Science',                  driveId: '1hVzxDVBrYCeyrIdR_H1hBVcGKP3L-6vu', pdfFile: 'home-science.pdf' },
  { name: 'Hindu Religious Education',     driveId: '1yaC29Z--hdpP4-0Dqt0MvQOpDKZGQveF', pdfFile: 'hre.pdf' },
  { name: 'ICT',                           driveId: '1PwqwpwiyNE-4puT7I-dp7eW563NSCJvX', pdfFile: 'ict.pdf' },
  { name: 'Indigenous Languages',          driveId: '1j1KvIa_81U0vvl9JOKigBkI0OiTVyEF4', pdfFile: 'indigenous-languages.pdf' },
  { name: 'Islamic Religious Education',   driveId: '1Bot9idatIq0amgFVO-NicyAEEjYvtzOs', pdfFile: 'ire.pdf' },
  { name: 'Kiswahili Lugha',               driveId: '1054jgAayFJP-QWsNzSz8GjQzI-ju-yA2', pdfFile: 'kiswahili-lugha.pdf' },
  { name: 'Literature in English',         driveId: '182y7Sto-E7y7edzkd1r_w1bga0wfWfVZ', pdfFile: 'literature-in-english.pdf' },
  { name: 'Mandarin Language',             driveId: '1j8PoxHwOSV6xJkvsKOeqPDvlK5rT5CnA', pdfFile: 'mandarin.pdf' },
  { name: 'Core Mathematics',              driveId: '1yls9qWKteVZ9LM6CmbzJGLR9BGwxwlMr', pdfFile: 'mathematics.pdf' },
  { name: 'Essential Mathematics',         driveId: '1yls9qWKteVZ9LM6CmbzJGLR9BGwxwlMr', pdfFile: 'mathematics.pdf' },  // same PDF
  { name: 'Metalwork',                     driveId: '1RlsOms7zQHJ5DGJCs3d_C_e2yY5etq9t', pdfFile: 'metalwork.pdf' },
  { name: 'Music and Dance',               driveId: '1x6NEuzuE8ExBeLfSRinnBQpAvgsa9YBt', pdfFile: 'music-dance.pdf' },
  { name: 'Physical Education',            driveId: '1Gpw9s5_bSOaRp-UTXeedQyfWzkNVkVem', pdfFile: 'physical-education.pdf' },
  { name: 'Physics',                       driveId: '19BzWsR_hg2RG5irlAIA0pFQk2v4kEzFI', pdfFile: 'physics.pdf' },
  { name: 'Power Mechanics',               driveId: '1HQntU9OJ5ompmsybwBbfMNARmzGq',     pdfFile: 'power-mechanics.pdf' },
  { name: 'Sports and Recreation',         driveId: '1KHid6OUhVGO7bZ8wmUF4kAm-SgjStU4M', pdfFile: 'sports-recreation.pdf' },
  { name: 'Theatre and Film',              driveId: '1HILsg_ljz9xWB6LsR6OekicOwlwNCO9m', pdfFile: 'theatre-film.pdf' },
  { name: 'Woodwork',                      driveId: '1b1yUqeY0QMN73_RHrbSTR3TTLlWMyr2U', pdfFile: 'woodwork.pdf' },
]

// ─── types ───────────────────────────────────────────────────────────────────

interface KicdSubStrand {
  title: string
  suggested_lessons: number
  learning_outcomes: string[]
  learning_experiences: string[]
  key_inquiry_questions: string[]
}

interface KicdStrand {
  strand_title: string
  sub_strands: KicdSubStrand[]
}

interface KicdSubjectData {
  assessment_methods: string[]
  learning_resources: string[]
  non_formal_activities: string[]
  strands: KicdStrand[]
}

// ─── pdf download ─────────────────────────────────────────────────────────────

async function downloadPdf(driveId: string, destFile: string): Promise<void> {
  if (fs.existsSync(destFile)) {
    const size = fs.statSync(destFile).size
    if (size > 10_000) {
      process.stdout.write(` (cached)\n`)
      return
    }
  }

  const url = `https://drive.usercontent.google.com/download?id=${driveId}&export=download`

  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(destFile)
    https.get(url, (res) => {
      // Handle Google Drive virus-scan confirmation redirect
      if (res.statusCode === 303 || res.statusCode === 302) {
        const location = res.headers.location!
        https.get(location, (res2) => {
          res2.pipe(file)
          file.on('finish', () => { file.close(); resolve() })
          res2.on('error', reject)
        }).on('error', reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
      res.on('error', reject)
    }).on('error', reject)
  })

  const size = fs.statSync(destFile).size
  if (size < 10_000) {
    fs.unlinkSync(destFile)
    throw new Error(`Download too small (${size} bytes) — likely a login page, not the PDF`)
  }
  process.stdout.write(` (${Math.round(size / 1024)}KB)\n`)
}

// ─── pdf text extraction ──────────────────────────────────────────────────────

function extractText(pdfPath: string): string {
  try {
    // -layout preserves column positions; easier for AI to parse table content
    return execSync(`pdftotext -layout "${pdfPath}" -`, { maxBuffer: 10 * 1024 * 1024 }).toString()
  } catch {
    throw new Error(`pdftotext failed for ${pdfPath} — is poppler-utils installed?`)
  }
}

// ─── AI parsing ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a KICD curriculum expert. Extract structured data from KICD Kenya Senior School curriculum design PDFs.
Return ONLY valid JSON — no markdown, no explanation, no code fences.`

async function callAI(prompt: string): Promise<string> {
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DeepSeek API error ${res.status}: ${err}`)
  }

  const data = await res.json() as any
  const raw: string = data.choices[0].message.content
  return raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
}

/** Split raw PDF text into sections — one per STRAND heading + the APPENDIX */
function splitIntoSections(pdfText: string): { title: string; text: string }[] {
  const lines = pdfText.split('\n')
  const sections: { title: string; startLine: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    // Match: "STRAND 1.0: TITLE" (content lines, not TOC dotted lines)
    if (/^STRAND\s+\d+\.\d+\s*:/.test(l) && !l.includes('....')) {
      sections.push({ title: l.replace(/^STRAND\s+\d+\.\d+\s*:\s*/i, '').trim(), startLine: i })
    }
    // Match APPENDIX
    if (/^APPENDIX\s*:/i.test(l)) {
      sections.push({ title: '__APPENDIX__', startLine: i })
    }
  }

  return sections.map((sec, idx) => {
    const end = idx + 1 < sections.length ? sections[idx + 1].startLine : lines.length
    return {
      title: sec.title,
      text: lines.slice(sec.startLine, end).join('\n'),
    }
  })
}

async function parseAppendix(appendixText: string): Promise<Pick<KicdSubjectData, 'assessment_methods' | 'learning_resources' | 'non_formal_activities'>> {
  const prompt = `Extract assessment and resource data from this KICD curriculum appendix section.

Return ONLY this JSON (no extra keys):
{
  "assessment_methods": ["method1", ...],
  "learning_resources": ["resource1", ...],
  "non_formal_activities": ["activity1", ...]
}

Rules:
- assessment_methods: bullet items from "Assessment Methods" column
- learning_resources: bullet items from "Learning Resources" column
- non_formal_activities: bullet items from "Non-Formal Activities" column
- Clean up: remove bullet symbols (●, •), keep text only
- If a column is missing use []

APPENDIX TEXT:
${appendixText.slice(0, 6000)}`

  const raw = await callAI(prompt)
  try {
    return JSON.parse(raw)
  } catch {
    return { assessment_methods: [], learning_resources: [], non_formal_activities: [] }
  }
}

async function parseStrandSection(strandTitle: string, strandText: string): Promise<KicdStrand> {
  const prompt = `Extract sub-strand curriculum data from this KICD curriculum strand section.

Strand: "${strandTitle}"

Return ONLY this JSON (no extra keys):
{
  "strand_title": "${strandTitle}",
  "sub_strands": [
    {
      "title": "Sub strand name (no lesson count)",
      "suggested_lessons": 6,
      "learning_outcomes": ["a) ...", "b) ..."],
      "learning_experiences": ["find out...", "brainstorm on...", "discuss..."],
      "key_inquiry_questions": ["Question?"]
    }
  ]
}

Rules:
- One object per sub-strand in this strand
- title: the sub-strand name only, strip "2.1" numbering and "(X lessons)"
- suggested_lessons: integer from "(X lessons)" — default 2 if not found
- learning_outcomes: each lettered point (a, b, c...) as a separate string
- learning_experiences: each bullet from "The learner is guided to:" as a separate string, strip "●" symbols
- key_inquiry_questions: from "Suggested Key Inquiry Question(s)" column
- Stop before "Core competencies" and "Assessment Rubric" sections
- Do NOT include Assessment Rubric content

STRAND TEXT:
${strandText.slice(0, 8000)}`

  const raw = await callAI(prompt)
  try {
    return JSON.parse(raw) as KicdStrand
  } catch {
    // Fallback — return empty strand rather than crashing
    return { strand_title: strandTitle, sub_strands: [] }
  }
}

async function parseWithAI(subjectName: string, pdfText: string): Promise<KicdSubjectData> {
  const sections = splitIntoSections(pdfText)

  if (sections.length === 0) {
    throw new Error('Could not find any STRAND sections in PDF text')
  }

  const strandSections = sections.filter(s => s.title !== '__APPENDIX__')
  const appendixSection = sections.find(s => s.title === '__APPENDIX__')

  process.stdout.write(` ${strandSections.length} strands`)

  // Parse appendix
  const appendixData = appendixSection
    ? await parseAppendix(appendixSection.text)
    : { assessment_methods: [], learning_resources: [], non_formal_activities: [] }

  // Parse each strand separately to stay within token limits
  const strands: KicdStrand[] = []
  for (const sec of strandSections) {
    const strand = await parseStrandSection(sec.title, sec.text)
    strands.push(strand)
    process.stdout.write('.')
    await new Promise(r => setTimeout(r, 400)) // rate limit
  }

  process.stdout.write('\n')

  return {
    ...appendixData,
    strands,
  }
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function findLearningArea(subjectName: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await db
    .from('sow_learning_areas')
    .select('id, name')
    .eq('grade_id', GRADE10_ID)
    .ilike('name', subjectName)
    .limit(1)

  if (error || !data || data.length === 0) {
    // Try partial match
    const { data: partial } = await db
      .from('sow_learning_areas')
      .select('id, name')
      .eq('grade_id', GRADE10_ID)
      .ilike('name', `%${subjectName.split(' ')[0]}%`)
      .limit(1)
    return partial?.[0] ?? null
  }
  return data[0]
}

async function getStrands(areaId: string): Promise<{ id: string; title: string }[]> {
  const { data } = await db
    .from('sow_strands')
    .select('id, title')
    .eq('learning_area_id', areaId)
    .order('order_index')
  return data ?? []
}

/**
 * For each DB strand, find the best-matching KICD strand(s) from the parsed data
 * and store the relevant sub_strands on kicd_data.
 * Matching is loose: the DB strand title just needs to share keywords with a KICD strand title.
 */
function matchKicdToDbStrand(
  dbStrandTitle: string,
  kicdStrands: KicdStrand[]
): KicdSubStrand[] {
  if (kicdStrands.length === 0) return []

  const words = dbStrandTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3)

  // Score each kicd strand by keyword overlap
  const scored = kicdStrands.map(ks => {
    const kTitle = ks.strand_title.toLowerCase()
    const score = words.filter(w => kTitle.includes(w)).length
    return { ks, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]

  // If best score is 0, return all sub_strands from all strands (subject has 1 overarching strand)
  if (best.score === 0 && kicdStrands.length === 1) {
    return kicdStrands[0].sub_strands
  }
  if (best.score === 0) return []

  return best.ks.sub_strands
}

// ─── main per-subject logic ───────────────────────────────────────────────────

async function processSubject(subject: typeof SUBJECTS[0]): Promise<boolean> {
  const pdfPath = path.join(PDF_DIR, subject.pdfFile)

  // 1. Download
  process.stdout.write(`  ⬇️  Downloading...`)
  try {
    await downloadPdf(subject.driveId, pdfPath)
  } catch (e: any) {
    console.log(`\n  ❌ Download failed: ${e.message}`)
    return false
  }

  // 2. Extract text
  let pdfText: string
  try {
    pdfText = extractText(pdfPath)
    process.stdout.write(`  📄 Extracted ${Math.round(pdfText.length / 1000)}KB text\n`)
  } catch (e: any) {
    console.log(`  ❌ Text extraction failed: ${e.message}`)
    return false
  }

  // 3. Parse with AI (chunked by strand)
  process.stdout.write(`  🤖 Parsing with DeepSeek...`)
  let parsed: KicdSubjectData
  try {
    parsed = await parseWithAI(subject.name, pdfText)
    const totalSubs = parsed.strands.reduce((s, st) => s + st.sub_strands.length, 0)
    console.log(`  📊 ${parsed.strands.length} strands, ${totalSubs} sub-strands extracted`)
  } catch (e: any) {
    console.log(`\n  ❌ AI parsing failed: ${e.message}`)
    return false
  }

  // Always save parsed JSON to disk for inspection / re-seeding without AI
  const jsonPath = pdfPath.replace('.pdf', '-parsed.json')
  fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2))

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Saved to ${path.basename(jsonPath)}`)
    console.log(`  Sample:`, JSON.stringify(parsed.strands[0]?.sub_strands[0], null, 2).slice(0, 400))
    return true
  }

  // 4. Find learning area in DB
  const area = await findLearningArea(subject.name)
  if (!area) {
    console.log(`  ⚠️  No DB learning area for "${subject.name}" — JSON saved to disk for later`)
    return true
  }

  // 5. Update learning area with full subject data
  const { error: areaErr } = await db
    .from('sow_learning_areas')
    .update({ kicd_subject_data: parsed })
    .eq('id', area.id)

  if (areaErr) {
    console.log(`  ❌ Failed to update learning area: ${areaErr.message}`)
    return false
  }

  // 6. Update each strand with matched KICD sub-strand data
  const strands = await getStrands(area.id)
  let matchCount = 0

  for (const strand of strands) {
    const subStrands = matchKicdToDbStrand(strand.title, parsed.strands)
    if (subStrands.length === 0) continue

    const { error: strandErr } = await db
      .from('sow_strands')
      .update({ kicd_data: subStrands })
      .eq('id', strand.id)

    if (!strandErr) matchCount++
  }

  console.log(`  ✅ DB updated — ${matchCount}/${strands.length} strands matched`)
  return true
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(62))
  console.log('🏫 EduNexus — KICD Curriculum Scraper')
  if (DRY_RUN) console.log('   [DRY RUN MODE — no DB writes]')
  if (ONLY_SUBJECT) console.log(`   [Filtering to: "${ONLY_SUBJECT}"]`)
  console.log('='.repeat(62))

  if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_AI_API_KEY is missing from .env.local')

  const subjects = ONLY_SUBJECT
    ? SUBJECTS.filter(s => s.name.toLowerCase().includes(ONLY_SUBJECT.toLowerCase()))
    : SUBJECTS

  if (subjects.length === 0) {
    console.log(`No subjects found matching "${ONLY_SUBJECT}"`)
    process.exit(1)
  }

  const results = { ok: 0, failed: 0, skipped: 0 }

  for (const subject of subjects) {
    console.log(`\n📚 ${subject.name}`)
    try {
      const ok = await processSubject(subject)
      if (ok) { results.ok++ } else { results.failed++ }
    } catch (e: any) {
      console.log(`  ❌ Unexpected error: ${e.message}`)
      results.failed++
    }

    // Polite delay between subjects to avoid rate limits
    if (subjects.indexOf(subject) < subjects.length - 1) {
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  console.log('\n' + '='.repeat(62))
  console.log(`✅ Done — ${results.ok} succeeded, ${results.failed} failed`)
  console.log('='.repeat(62))
}

main().catch(err => {
  console.error('\n💥 Fatal:', err.message)
  process.exit(1)
})
