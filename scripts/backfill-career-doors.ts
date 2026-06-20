// scripts/backfill-career-doors.ts
// The 25 careers migrated from lib/academicClinic/careerEngine.ts only got
// 'employment' + 'ai_era' doors (no self_employment/entrepreneurship door,
// no ai_sovereignty "AI superpowers" narrative). This backfills those two
// missing doors and the ai_sovereignty block via DeepSeek so every career
// matches the same depth as the 18 hand-authored seed careers.
//
//   npx tsx scripts/backfill-career-doors.ts

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient } from '@supabase/supabase-js'
import { callDeepSeek } from '../lib/ai/deepseek'
import type { Career, CareerDoor } from '../lib/career/types'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const SYSTEM_PROMPT = 'You are a Kenyan CBC career-guidance expert. Return ONLY valid JSON — no markdown, no extra text.'

function buildPrompt(career: Pick<Career, 'title' | 'description' | 'category'>): string {
  return `Career: "${career.title}" (${career.category}) in Kenya. Description: ${career.description}

Generate the MISSING pieces for this career's profile — a self-employment door, an entrepreneurship door, and an "AI superpowers" narrative for someone solo, armed with AI tools, in this field (e.g. a teacher building an edtech product alone, a lawyer building a legal-AI product alone). Be concrete and Kenya-specific. Honest, not fear-based — frame AI as leverage, not replacement.

Return ONLY this JSON:
{
  "self_employment": {
    "title": "...",
    "description": "...",
    "startup_cost_kes": { "min": 0, "max": 0 },
    "platforms": ["..."]
  },
  "entrepreneurship": {
    "title": "...",
    "description": "...",
    "the_gap": "the underserved problem in Kenya this career could build a business around",
    "example_ventures": ["concrete venture idea", "..."],
    "market_note": "..."
  },
  "ai_sovereignty": {
    "the_shift": "1-2 sentences on what one person with AI tools can now do that used to need a team",
    "what_you_can_build": ["concrete thing a solo person in this career can build with AI", "..."],
    "tools_to_learn": ["tool name", "..."],
    "sovereignty_example": "a believable Kenyan example: name, age, what they built solo, what they earn now"
  }
}`
}

async function main() {
  const { data: careers, error } = await db
    .from('careers')
    .select('id, slug, title, description, category, doors')
    .eq('source', 'seed')

  if (error) throw new Error(error.message)

  const thin = (careers ?? []).filter(c => (c.doors as CareerDoor[]).length < 4)
  console.log(`Backfilling ${thin.length} careers with missing doors...`)

  let done = 0
  const errors: string[] = []

  for (const career of thin) {
    try {
      const raw = await callDeepSeek(buildPrompt(career as Pick<Career, 'title' | 'description' | 'category'>), SYSTEM_PROMPT, { temperature: 0.5, maxTokens: 1500 })
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')
      const generated = JSON.parse(jsonMatch[0]) as {
        self_employment: Record<string, unknown>
        entrepreneurship: Record<string, unknown>
        ai_sovereignty: Record<string, unknown>
      }

      const existingDoors = career.doors as CareerDoor[]
      const newDoors: CareerDoor[] = [
        ...existingDoors.map(d =>
          d.type === 'ai_era' ? { ...d, ai_sovereignty: generated.ai_sovereignty } as CareerDoor : d
        ),
        { type: 'self_employment', ...generated.self_employment } as CareerDoor,
        { type: 'entrepreneurship', ...generated.entrepreneurship } as CareerDoor,
      ]

      const { error: updateError } = await db
        .from('careers')
        .update({ doors: newDoors })
        .eq('id', career.id)

      if (updateError) throw new Error(updateError.message)
      done++
      console.log(`✓ ${career.slug}`)
    } catch (err) {
      errors.push(`${career.slug}: ${(err as Error).message}`)
      console.error(`✗ ${career.slug}: ${(err as Error).message}`)
    }
  }

  console.log(`\nBackfilled ${done}/${thin.length} careers.`)
  if (errors.length > 0) console.error('Errors:', errors)
}

main()
