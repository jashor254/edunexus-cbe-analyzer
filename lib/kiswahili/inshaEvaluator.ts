// lib/kiswahili/inshaEvaluator.ts
// CBC Kiswahili Insha Feedback Engine.
// Evaluates student compositions against the 6 CBC dimensions on a 1-4 scale.
// All feedback is generated in Kiswahili to match what students receive in class.

import { callDeepSeek } from '@/lib/ai/deepseek'

export type InshaType =
  | 'masimulizi'   // narrative
  | 'hoja'         // argumentative
  | 'maelezo'      // descriptive
  | 'barua_rasmi'  // formal letter
  | 'mazungumzo'   // dialogue/conversation piece

export type CbcLevel = 1 | 2 | 3 | 4

export type InshaDimension = {
  score:    CbcLevel
  label:    string    // BE / AE / ME / EE
  mwongozo: string    // specific, actionable feedback in Kiswahili (2-3 sentences)
}

export type InshaFeedback = {
  insha_type:       InshaType
  grade:            number
  dimensions: {
    utangulizi:   InshaDimension   // Introduction quality
    kiini:        InshaDimension   // Body / main content development
    hitimisho:    InshaDimension   // Conclusion
    msamiati:     InshaDimension   // Vocabulary range and accuracy
    sarufi:       InshaDimension   // Grammar (ngeli, nyakati, upatanisho)
    mtiririko:    InshaDimension   // Flow / coherence of ideas
  }
  jumla:            CbcLevel       // weighted overall level
  nguvu:            string[]       // 2 specific strengths (Kiswahili)
  udhaifu:          string[]       // 2 most important weaknesses (Kiswahili)
  hatua_inayofuata: string         // single clearest next step (Kiswahili)
  makosa_ya_sarufi: string[]       // up to 4 specific grammar errors with corrections
  ngeli_zilizokosewa: string[]     // noun class agreement errors spotted (e.g. "watoto mzuri → watoto wazuri")
}

// ── CBC level labels ──────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<CbcLevel, string> = {
  1: 'BE',  // Below Expectation
  2: 'AE',  // Approaching Expectation
  3: 'ME',  // Meeting Expectation
  4: 'EE',  // Exceeding Expectation
}

// ── Insha type display names ──────────────────────────────────────────────────

const INSHA_TYPE_LABELS: Record<InshaType, string> = {
  masimulizi: 'Insha ya Masimulizi (Narrative)',
  hoja:       'Insha ya Hoja (Argumentative)',
  maelezo:    'Insha ya Maelezo (Descriptive)',
  barua_rasmi:'Barua Rasmi (Formal Letter)',
  mazungumzo: 'Insha ya Mazungumzo (Dialogue)',
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(grade: number, inshaType: InshaType): string {
  return `Wewe ni mkaguzi mtaalamu wa Kiswahili wa CBC Kenya, unayehudumia darasa la ${grade} (Shule ya Chini ya CBC, Darasa ${grade}).

Umepewa insha ya mwanafunzi ya aina ya: ${INSHA_TYPE_LABELS[inshaType]}.

JUKUMU LAKO:
Tathmini insha hii kwa makini ukitumia vipimo sita (6) vya CBC Kenya. Kwa kila kipimo, toa alama ya 1 hadi 4:
- 1 = BE (Chini ya Matarajio / Below Expectation)
- 2 = AE (Karibu na Matarajio / Approaching Expectation)
- 3 = ME (Kukidhi Matarajio / Meeting Expectation)
- 4 = EE (Kuzidi Matarajio / Exceeding Expectation)

VIPIMO SITA:
1. **UTANGULIZI** — Je, utangulizi unavutia? Je, unabainisha mada kwa uwazi? Je, unampeleka msomaji katika mwili wa insha?
2. **KIINI** — Je, mawazo yamepangwa vizuri? Je, kuna ushahidi, mifano, au maelezo ya kina? Je, kila aya ina wazo moja kuu?
3. **HITIMISHO** — Je, hitimisho linakamilisha insha? Je, linahusiana na utangulizi? Je, linaacha msomaji na hisia au fikira ya kudumu?
4. **MSAMIATI** — Je, mwanafunzi anatumia maneno ya kuvutia na yanayofaa? Je, msamiati unabadilika (si kurudia maneno yale yale)? Je, maneno yametumiwa kwa usahihi?
5. **SARUFI** — Je, ngeli za nomino zimefuatwa? Je, upatanisho ni sahihi? Je, nyakati za vitenzi ni sahihi? Je, viakifishi vimetumiwa vizuri?
6. **MTIRIRIKO WA MAWAZO** — Je, mawazo yanaunganika? Je, viunganishi (kwa hivyo, zaidi ya hayo, hata hivyo) vimetumiwa vizuri? Je, inasha inasomeka kwa urahisi?

MAELEKEZO YA SARUFI YA KISWAHILI (CBC G${grade}):
- Ngeli: M/WA (watu), M/MI (miti), KI/VI, N/N, U, MA, KU — angalia upatanisho wa kila ngeli
- Nyakati: -li- (uliopita), -na- (uliopo), -ta- (ujao), -me- (timilifu), -nge-/-ngeli- (masharti)
- Upatanisho: nomino na vivumishi, viwakilishi, na vitenzi lazima vikubaliane
- Mfano wa kosa la kawaida: "watoto mzuri" (kosa) → "watoto wazuri" (sahihi)

JIBU LAZIMA LIWE JSON PEKE YAKE. Usiandike maelezo nje ya JSON. Jibu lako lianze moja kwa moja na { na liishie na }.

Muundo wa JSON:
{
  "dimensions": {
    "utangulizi":  { "score": 1-4, "mwongozo": "maelezo ya kina katika Kiswahili (sentensi 2-3)" },
    "kiini":       { "score": 1-4, "mwongozo": "maelezo ya kina katika Kiswahili (sentensi 2-3)" },
    "hitimisho":   { "score": 1-4, "mwongozo": "maelezo ya kina katika Kiswahili (sentensi 2-3)" },
    "msamiati":    { "score": 1-4, "mwongozo": "maelezo ya kina katika Kiswahili (sentensi 2-3)" },
    "sarufi":      { "score": 1-4, "mwongozo": "maelezo ya kina katika Kiswahili (sentensi 2-3)" },
    "mtiririko":   { "score": 1-4, "mwongozo": "maelezo ya kina katika Kiswahili (sentensi 2-3)" }
  },
  "nguvu": ["nguvu ya kwanza maalum kutoka kwa insha hii", "nguvu ya pili maalum"],
  "udhaifu": ["udhaifu mkubwa zaidi kwa mwanafunzi huyu", "udhaifu wa pili wa muhimu"],
  "hatua_inayofuata": "hatua moja wazi na inayoweza kutekelezwa sasa hivi (Kiswahili, sentensi 1-2)",
  "makosa_ya_sarufi": ["kosa lililoonekana → usahihi wake", "..."],
  "ngeli_zilizokosewa": ["mfano wa kosa la ngeli → mfano sahihi", "..."]
}

Andika mwongozo katika Kiswahili fasaha. Makosa ya sarufi na ngeli: toa mfano HALISI kutoka inshani kama unaona, si mfano wa kufikirika tu. Kama hakuna makosa ya ngeli, acha orodha tupu [].`
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(insha: string, inshaType: InshaType, grade: number): string {
  return `INSHA YA MWANAFUNZI (Darasa ${grade} — ${INSHA_TYPE_LABELS[inshaType]}):

---
${insha.trim()}
---

Tathmini insha hii kwa vipimo sita vya CBC na urudishe JSON peke yake.`
}

// ── Weighted overall level ────────────────────────────────────────────────────
// Weights reflect CBC Kiswahili marking scheme emphasis

const DIMENSION_WEIGHTS = {
  utangulizi: 0.12,
  kiini:      0.28,
  hitimisho:  0.12,
  msamiati:   0.18,
  sarufi:     0.18,
  mtiririko:  0.12,
}

function computeJumla(dimensions: InshaFeedback['dimensions']): CbcLevel {
  const weighted =
    dimensions.utangulizi.score * DIMENSION_WEIGHTS.utangulizi +
    dimensions.kiini.score      * DIMENSION_WEIGHTS.kiini      +
    dimensions.hitimisho.score  * DIMENSION_WEIGHTS.hitimisho  +
    dimensions.msamiati.score   * DIMENSION_WEIGHTS.msamiati   +
    dimensions.sarufi.score     * DIMENSION_WEIGHTS.sarufi     +
    dimensions.mtiririko.score  * DIMENSION_WEIGHTS.mtiririko

  return Math.max(1, Math.min(4, Math.round(weighted))) as CbcLevel
}

// ── Raw AI response parser ────────────────────────────────────────────────────

type RawDimension = { score: number; mwongozo: string }
type RawResponse = {
  dimensions: {
    utangulizi: RawDimension
    kiini:      RawDimension
    hitimisho:  RawDimension
    msamiati:   RawDimension
    sarufi:     RawDimension
    mtiririko:  RawDimension
  }
  nguvu:              string[]
  udhaifu:            string[]
  hatua_inayofuata:   string
  makosa_ya_sarufi:   string[]
  ngeli_zilizokosewa: string[]
}

function clampLevel(n: number): CbcLevel {
  return Math.max(1, Math.min(4, Math.round(n))) as CbcLevel
}

function parseDimension(raw: RawDimension): InshaDimension {
  const score = clampLevel(raw.score ?? 2)
  return { score, label: LEVEL_LABELS[score], mwongozo: raw.mwongozo ?? '' }
}

function parseRawResponse(
  raw: RawResponse,
  inshaType: InshaType,
  grade: number
): InshaFeedback {
  const dimensions: InshaFeedback['dimensions'] = {
    utangulizi: parseDimension(raw.dimensions.utangulizi),
    kiini:      parseDimension(raw.dimensions.kiini),
    hitimisho:  parseDimension(raw.dimensions.hitimisho),
    msamiati:   parseDimension(raw.dimensions.msamiati),
    sarufi:     parseDimension(raw.dimensions.sarufi),
    mtiririko:  parseDimension(raw.dimensions.mtiririko),
  }

  return {
    insha_type:           inshaType,
    grade,
    dimensions,
    jumla:                computeJumla(dimensions),
    nguvu:                (raw.nguvu ?? []).slice(0, 2),
    udhaifu:              (raw.udhaifu ?? []).slice(0, 2),
    hatua_inayofuata:     raw.hatua_inayofuata ?? '',
    makosa_ya_sarufi:     (raw.makosa_ya_sarufi ?? []).slice(0, 4),
    ngeli_zilizokosewa:   (raw.ngeli_zilizokosewa ?? []).slice(0, 4),
  }
}

// ── Fallback (parse failed or AI error) ──────────────────────────────────────

function buildFallback(inshaType: InshaType, grade: number): InshaFeedback {
  const mid: InshaDimension = {
    score:    2,
    label:    'AE',
    mwongozo: 'Tathmini haijaweza kukamilika. Tafadhali jaribu tena.',
  }
  return {
    insha_type: inshaType,
    grade,
    dimensions: {
      utangulizi: mid,
      kiini:      mid,
      hitimisho:  mid,
      msamiati:   mid,
      sarufi:     mid,
      mtiririko:  mid,
    },
    jumla:              2,
    nguvu:              [],
    udhaifu:            [],
    hatua_inayofuata:   'Tafadhali jaribu tena baadaye.',
    makosa_ya_sarufi:   [],
    ngeli_zilizokosewa: [],
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export type EvaluateInshaParams = {
  insha:     string
  inshaType: InshaType
  grade:     number
}

export async function evaluateInsha({
  insha,
  inshaType,
  grade,
}: EvaluateInshaParams): Promise<InshaFeedback> {
  const systemPrompt = buildSystemPrompt(grade, inshaType)
  const prompt       = buildPrompt(insha, inshaType, grade)

  let raw: string
  try {
    raw = await callDeepSeek(prompt, systemPrompt, {
      temperature: 0.2,    // low temp for consistent structured output
      maxTokens:   1200,   // ~900 tokens of JSON + buffer
    })
  } catch (err) {
    console.error('[inshaEvaluator] DeepSeek call failed:', err)
    return buildFallback(inshaType, grade)
  }

  // Strip any markdown fences the model may add
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as RawResponse
    return parseRawResponse(parsed, inshaType, grade)
  } catch (err) {
    console.error('[inshaEvaluator] JSON parse failed. Raw output:', raw, err)
    return buildFallback(inshaType, grade)
  }
}
