import { callGeminiJSON } from '@/lib/ai/gemini'
import { createServiceClient } from '@/utils/supabase/service'

type GeneratedChallenge = {
  question:        string
  correct_answer:  string
  hint:            string
  explanation:     string
  difficulty:      number
  kenyan_context:  string | null
}

export async function generateChallengeForGroup(groupId: string): Promise<void> {
  const db = createServiceClient()

  const { data: group } = await db
    .from('study_groups')
    .select('id, subject, grade')
    .eq('id', groupId)
    .single()

  if (!group) throw new Error(`Group ${groupId} not found`)

  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await db
    .from('study_group_challenges')
    .select('id')
    .eq('group_id', groupId)
    .eq('date', today)
    .maybeSingle()

  if (existing) return

  const prompt = `Generate a single CBC Kenya curriculum question for Grade ${group.grade} ${group.subject}.

Return JSON with exactly these fields:
{
  "question": "Clear, specific question appropriate for Grade ${group.grade} ${group.subject}",
  "correct_answer": "The exact correct answer (short, 1-3 words or a number)",
  "hint": "A helpful hint without giving away the answer",
  "explanation": "Brief explanation of why the answer is correct (1-2 sentences)",
  "difficulty": <integer 1-5 where 1=easy, 3=grade level, 5=advanced>,
  "kenyan_context": "A Kenyan real-world example or context that makes the question relatable, or null"
}

Rules:
- Answer must be short: a word, number, or brief phrase (not a paragraph)
- Use Kenyan names, places, and scenarios where natural
- Difficulty 3 = solid Grade ${group.grade} student gets it right
- No multiple choice — open-ended short-answer only
- No LaTeX — write math in plain text (e.g. "2 + 3 =" not "$2 + 3 =$")`

  const raw = await callGeminiJSON(prompt)

  let parsed: GeneratedChallenge
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${raw.slice(0, 200)}`)
  }

  if (!parsed.question || !parsed.correct_answer) {
    throw new Error('Gemini returned incomplete challenge data')
  }

  await db.from('study_group_challenges').insert({
    group_id:       groupId,
    date:           today,
    subject:        group.subject,
    question:       parsed.question,
    correct_answer: parsed.correct_answer,
    hint:           parsed.hint || null,
    explanation:    parsed.explanation || null,
    difficulty:     parsed.difficulty ?? 3,
    kenyan_context: parsed.kenyan_context || null,
  })
}

export async function generateChallengesForAllGroups(): Promise<{
  generated: number
  skipped:   number
  errors:    number
}> {
  const db = createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: groups } = await db
    .from('study_groups')
    .select('id')
    .eq('status', 'active')

  if (!groups?.length) return { generated: 0, skipped: 0, errors: 0 }

  const groupIds = groups.map(g => g.id)

  const { data: covered } = await db
    .from('study_group_challenges')
    .select('group_id')
    .eq('date', today)
    .in('group_id', groupIds)

  const coveredIds = new Set((covered || []).map(c => c.group_id))
  const pending    = groups.filter(g => !coveredIds.has(g.id))

  let generated = 0
  let errors    = 0

  for (const group of pending) {
    try {
      await generateChallengeForGroup(group.id)
      generated++
    } catch (err) {
      console.error(`[challengeGenerator] group ${group.id}:`, err instanceof Error ? err.message : String(err))
      errors++
    }
  }

  return { generated, skipped: coveredIds.size, errors }
}
