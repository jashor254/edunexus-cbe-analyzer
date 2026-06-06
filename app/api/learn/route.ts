import { callDeepSeek } from '@/lib/ai/deepseek'
import { checkFeatureAccess } from '@/lib/payments/access'
import { apiSuccess, apiError } from '@/lib/api/response'

export async function POST(req: Request) {
  try {
    const {
      message,
      subject,
      topic,
      level,
      grade,
      history,
      rightStreak,
      wrongStreak,
      studentName,
    } = await req.json() as {
      message:     string
      subject:     string
      topic:       string
      level:       number
      grade:       number
      history:     { role: string; content: string }[]
      rightStreak: number
      wrongStreak: number
      studentName: string
    }

    const access = await checkFeatureAccess('learning_compass')
    if (access.allowed === false) {
      return apiError(access.reason, 401)
    }

    const isLevel1or2 = level <= 2
    const isLevel4    = level >= 4

    const prompt = `You are a calm tutor helping ${studentName || 'a student'} with ${topic || subject}.

STUDENT: Grade ${grade}, Level ${level}/4
SUBJECT: ${subject}
TOPIC: ${topic || subject}

${rightStreak >= 3
  ? 'Student is getting it right — increase difficulty.'
  : wrongStreak >= 2
  ? 'Student is struggling — simplify and try different angle.'
  : 'Steady pace.'}

VOICE:
${isLevel1or2
  ? 'Warm and simple. Short sentences. Max 8 words each. Use "Vizuri" or "Sawa" occasionally. Multiple choice questions only (A/B/C).'
  : isLevel4
  ? 'Direct. No hand-holding. Open questions. Push their thinking.'
  : 'Clear and encouraging. Mix of question types.'}

RULES — NEVER BREAK:
1. Max 2 sentences then ONE question.
2. Never numbered lists.
3. Never "I have a diagram — click button".
4. No food analogies. No named characters.
5. Question AND choices must be about: ${topic || subject}
6. Never say "Today we will learn about..."
7. When correct: confirm briefly, advance.
8. When wrong: name what was wrong, try different angle.
9. After 3 wrong: show worked example, give new similar problem.
10. End EVERY response with a question.

Student said: "${message}"

Respond directly. No preamble. No JSON.`

    const response = await callDeepSeek(prompt, undefined, { temperature: 0.3, maxTokens: 300 })

    return apiSuccess({ text: response })
  } catch (err) {
    console.error('[learn]', err)
    return apiError('Server error', 500)
  }
}
