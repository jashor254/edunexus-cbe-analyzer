// lib/curriculum/kicdVocabulary.ts
//
// The fixed vocabularies KICD curriculum designs draw from — the single
// source for SOW generation (lib/sow/diversityEngine.ts, aiLessonGenerator.ts).
// The SOW generator used to rotate its own lists here, which included
// non-KICD items ("Numeracy"/"Umahiri wa kihesabu", "Self-management",
// "Ubora, Uboreshaji endelevu") and one hard-coded PCI string for every
// lesson.
//
// Sources: Basic Education Curriculum Framework (7 core competencies, 8
// national values) and the "Muhtasari wa Mbinu za Kutathmini, Nyenzo za
// Kufundishia…" tables of the KICD Kiswahili Grade 7, 8 and 9 designs
// (identical across the three grades; data/kicd-pdfs/kiswahili-grade{7,8,9}.pdf).

export const KICD_CORE_COMPETENCIES = {
  en: [
    'Communication and collaboration',
    'Critical thinking and problem solving',
    'Creativity and imagination',
    'Citizenship',
    'Digital literacy',
    'Learning to learn',
    'Self-efficacy',
  ],
  // Names as the KICD Kiswahili designs print them ("Umilisi wa Kimsingi").
  sw: [
    'Mawasiliano na ushirikiano',
    'Uwazaji kina na utatuzi wa matatizo',
    'Ubunifu',
    'Uraia',
    'Ujuzi wa kidijitali',
    'Hamu ya ujifunzaji',
    'Kujiamini',
  ],
} as const

export const KICD_NATIONAL_VALUES = {
  en: ['Love', 'Responsibility', 'Respect', 'Unity', 'Peace', 'Patriotism', 'Integrity', 'Social justice'],
  sw: ['Upendo', 'Uwajibikaji', 'Heshima', 'Umoja', 'Amani', 'Uzalendo', 'Uadilifu', 'Haki ya kijamii'],
} as const

// Pertinent and contemporary issues the designs tie lessons to. The model
// picks from this list for the lesson's theme when the KICD entry's own
// PCIs have not been loaded — it never gets one fixed string for all lessons.
export const KICD_PCI_OPTIONS = {
  en: [
    'Citizenship', 'Human rights', 'Social cohesion', 'Peace education', 'Integrity',
    'Health education', 'Lifestyle diseases', 'Drug and substance abuse', 'Life skills',
    'Environmental education', 'Climate change', 'Safety and security', 'Road safety',
    'Financial literacy', 'Gender issues', 'Learner support', 'Community service learning',
  ],
  sw: [
    'Uraia', 'Haki za binadamu', 'Mshikamano wa kijamii', 'Elimu ya amani', 'Uadilifu',
    'Masuala ya afya', 'Magonjwa yanayotokana na mienendo ya maisha', 'Matumizi mabaya ya dawa za kulevya', 'Stadi za maisha',
    'Elimu ya mazingira', 'Mabadiliko ya tabianchi', 'Usalama', 'Usalama barabarani',
    'Ujuzi wa matumizi ya fedha', 'Masuala ya kijinsia', 'Huduma kwa jamii', 'Masuala ya kijamii',
  ],
} as const

export type KiswahiliSkill = 'kusikiliza' | 'kusoma' | 'kuandika' | 'sarufi'

// From the sub-strand row title prefix ("Sarufi - Mnyambuliko wa vitenzi").
export function kiswahiliSkillOf(substrandTitle: string): KiswahiliSkill | null {
  const t = substrandTitle.trim().toLowerCase()
  if (t.startsWith('kusikiliza')) return 'kusikiliza'
  if (t.startsWith('kusoma') || t.startsWith('ufahamu')) return 'kusoma'
  if (t.startsWith('kuandika')) return 'kuandika'
  if (t.startsWith('sarufi') || t.startsWith('matumizi ya lugha')) return 'sarufi'
  return null
}

// "Mapendekezo ya Mbinu za Kutathmini" and "Mapendekezo ya Nyenzo za
// Kufundishia", per skill, as worded in the KICD Kiswahili JSS designs.
export const KISWAHILI_SKILL_GUIDE: Record<KiswahiliSkill, { assessment: string[]; resources: string[] }> = {
  kusikiliza: {
    assessment: [
      'Kumakinikia jinsi mwanafunzi anavyotumia lugha katika mawasiliano',
      'Kujibu maswali',
      'Maigizo',
      'Kutambua (k.m. kwenye orodha)',
      'Kuambatanisha maneno na majibu',
      'Mijadala',
      'Mazungumzo',
      'Matumizi ya ishara za mwili (uso, mikono, mabega)',
      'Wanafunzi kufanyiana tathmini',
    ],
    resources: [
      'Chati', 'Michoro na picha', 'Mgeni mwalikwa',
      'Vifaa vya kidijitali (rununu, kinasasauti, tarakilishi, projekta, video)',
      'Mti maneno', 'Kapu maneno', 'Vitabu mbalimbali',
    ],
  },
  kusoma: {
    assessment: [
      'Kutunga sentensi kwa kutumia msamiati lengwa',
      'Kujibu maswali ya ufahamu',
      'Kutoa muhtasari wa matini yaliyosomwa',
      'Kusoma kwa sauti',
      'Wanafunzi kufanyiana tathmini',
      'Potifolio',
      'Shajara',
    ],
    resources: [
      'Kamusi mbalimbali',
      'Vifaa vya kidijitali (rununu, kinasasauti, tarakilishi, projekta)',
      'Vitabu vya hadithi na matini mbalimbali',
    ],
  },
  kuandika: {
    assessment: [
      'Kuandika tungo mbalimbali',
      'Wanafunzi kufanyiana tathmini',
      'Potifolio',
      'Shajara',
      'Mijadala kuhusu vidokezo vya insha',
    ],
    resources: [
      'Kielelezo cha insha ya masimulizi', 'Kielelezo cha insha ya maelezo', 'Kielelezo cha insha ya wasifu',
      'Nakala ya barua ya kirafiki', 'Nakala ya barua rasmi', 'Barua pepe',
    ],
  },
  sarufi: {
    assessment: [
      'Kutambua (k.m. kwenye orodha)',
      'Kuambatanisha maneno lengwa',
      'Kujaza mapengo',
      'Kutunga sentensi',
      'Kazi mradi',
    ],
    resources: [
      'Kadi maneno', 'Kapu maneno', 'Mti maneno', 'Chati', 'Mabango', 'Picha za vitu mbalimbali',
      'Michoro', 'Nyenzo halisi',
      'Vifaa vya kidijitali (rununu, kinasasauti, tarakilishi, projekta)',
    ],
  },
}

// `count` consecutive items starting at a rotating offset — deterministic
// variety within a fixed, official list.
export function rotate<T>(items: readonly T[], offset: number, count: number): T[] {
  if (items.length === 0) return []
  const n = Math.min(count, items.length)
  return Array.from({ length: n }, (_, k) => items[(offset + k) % items.length])
}
