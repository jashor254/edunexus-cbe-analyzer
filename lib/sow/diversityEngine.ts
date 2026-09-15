// lib/sow/diversityEngine.ts
// Controls diversity at five levels across a generated scheme of work.
// Works alongside VerbRotationEngine (verb-level) to eliminate repetition
// at outcome structure, experience framework, inquiry question, assessment,
// and values levels.

import type { GeneratedLesson } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OutcomePattern {
  l1: string     // Level 1 verb (knowledge / recall)
  l2: string     // Level 2 verb (application / analysis)
  l3: string     // Level 3 verb (values / synthesis)
  structure: string  // Sentence structure label (A–H)
}

export interface ExperienceFramework {
  label: string   // A–L
  name: string
  template: string
}

export interface QuestionFrame {
  name: string
  starters: [string, string, string]
}

export interface DiversitySeed {
  outcomePattern:    OutcomePattern
  framework:         ExperienceFramework
  questionFrame:     QuestionFrame
  assessmentMethods: [string, string, string]
  values:            string
  coreCompetencies:  string
  contextBlock:      string   // pre-formatted string injected into prompt
}

// ─── Outcome Patterns ─────────────────────────────────────────────────────────
// 20 distinct L1→L2→L3 verb trios × 8 sentence structures = wide variety.
// Structures rotate independently so the same verb trio never repeats
// the same sentence shape.

const OUTCOME_PATTERNS: Omit<OutcomePattern, 'structure'>[] = [
  { l1: 'observe',    l2: 'investigate', l3: 'advocate for'        },
  { l1: 'label',      l2: 'compare',     l3: 'design'              },
  { l1: 'classify',   l2: 'analyze',     l3: 'evaluate'            },
  { l1: 'collect',    l2: 'demonstrate', l3: 'reflect on'          },
  { l1: 'recall',     l2: 'differentiate',l3: 'appreciate'         },
  { l1: 'describe',   l2: 'construct',   l3: 'create'              },
  { l1: 'locate',     l2: 'predict',     l3: 'recommend'           },
  { l1: 'name',       l2: 'explain',     l3: 'justify'             },
  { l1: 'list',       l2: 'formulate',   l3: 'synthesize'          },
  { l1: 'detect',     l2: 'test',        l3: 'develop awareness of'},
  { l1: 'draw',       l2: 'calculate',   l3: 'value'               },
  { l1: 'record',     l2: 'estimate',    l3: 'promote'             },
  { l1: 'measure',    l2: 'relate',      l3: 'support'             },
  { l1: 'read',       l2: 'interpret',   l3: 'critique'            },
  { l1: 'trace',      l2: 'model',       l3: 'implement'           },
  { l1: 'sketch',     l2: 'deduce',      l3: 'generate'            },
  { l1: 'note',       l2: 'hypothesize', l3: 'commit to'           },
  { l1: 'examine',    l2: 'apply',       l3: 'defend'              },
  { l1: 'sort',       l2: 'verify',      l3: 'propose'             },
  { l1: 'select',     l2: 'solve',       l3: 'develop interest in' },
]

// Eight sentence structures — rotate independently from verb patterns
const OUTCOME_STRUCTURES: Record<string, string> = {
  A: '[verb] the [concept] using [local Kenyan context or material]',
  B: '[verb] how [process] affects [outcome] in [context]',
  C: '[verb] the difference between [X] and [Y] in [context]',
  D: '[verb] [concept] in order to [purpose in local context]',
  E: '[verb] [process] when [condition applies in Kenyan situation]',
  F: '[verb] [concept] to [audience or purpose, e.g. the class, the community]',
  G: '[verb] [concept] according to [standard, guideline, or local practice]',
  H: '[verb] the importance of [concept] in [specific Kenyan context]',
}

const STRUCTURE_KEYS = Object.keys(OUTCOME_STRUCTURES)

// Kiswahili verb trios — same 20-slot rotation as OUTCOME_PATTERNS, mirrored
// 1:1 by index so a Kiswahili lesson gets exactly the same diversity guarantee
// (no two adjacent lessons share a verb trio) instead of falling through to
// English defaults that only applied when no diversity seed was present.
//
// Every verb here is checked against lib/sow/verbHierarchy.ts's real merged
// Kiswahili verb-level pool (getMergedVerbOrder('kiswahili')) and confirmed
// to resolve at the intended L1/L2/L3 level with L1 <= L2 <= L3. An earlier
// version of this list invented verbs independently of that pool — some were
// unrecognized (-1) and some resolved at a LOWER level than intended (e.g.
// "changanua" here vs. "chambua"/"hakiki"/etc. already claimed at L2 by
// lib/sow/verbLibrary.ts's SUBJECT_EXTENSIONS.kiswahili, so a trio built as
// L1<L2<L3 could resolve as L1>L2 after the merge) — validateLearningOutcomes
// then rejected the outcome as "not progressing low to high" or "unrecognized
// verb", exhausting all 5 AI retries and stalling generation after whichever
// lesson happened to draw a working trio. Multi-word verb phrases (e.g. "unga
// mkono") are also avoided: getVerbLevel matches single words from the first
// 4 tokens of a sentence, so a two-word pool entry can never actually match.
const KISWAHILI_OUTCOME_PATTERNS: Omit<OutcomePattern, 'structure'>[] = [
  { l1: 'andika',    l2: 'fafanua',     l3: 'thamini'     },
  { l1: 'angalia',   l2: 'fuatilia',    l3: 'thibitisha'  },
  { l1: 'eleza',     l2: 'fupisha',     l3: 'uendeleze'   },
  { l1: 'fahamia',   l2: 'hakiki',      l3: 'ukuzishe'    },
  { l1: 'jaza',      l2: 'husisha',     l3: 'buni'        },
  { l1: 'kamilisha', l2: 'iga',         l3: 'linda'       },
  { l1: 'nunua',     l2: 'linganisha',  l3: 'pendekeza'   },
  { l1: 'onyesha',   l2: 'rekebisha',   l3: 'sisitiza'    },
  { l1: 'orodhesha', l2: 'tafsiri',     l3: 'tetea'       },
  { l1: 'panga',     l2: 'tathmini',    l3: 'thamini'     },
  { l1: 'soma',      l2: 'tofautisha',  l3: 'thibitisha'  },
  { l1: 'taja',      l2: 'tumia',       l3: 'uendeleze'   },
  { l1: 'tambua',    l2: 'uchanganye',  l3: 'ukuzishe'    },
  { l1: 'tazama',    l2: 'wasiliana',   l3: 'buni'        },
  { l1: 'toa',       l2: 'changanya',   l3: 'linda'       },
  { l1: 'weka',      l2: 'chambua',     l3: 'pendekeza'   },
  { l1: 'zungumza',  l2: 'elezea',      l3: 'sisitiza'    },
  { l1: 'andika',    l2: 'fafanua',     l3: 'tetea'       },
  { l1: 'angalia',   l2: 'fuatilia',    l3: 'thamini'     },
  { l1: 'eleza',     l2: 'fupisha',     l3: 'thibitisha'  },
]

// ─── Experience Frameworks ────────────────────────────────────────────────────
// 15 distinct activity structures (A–L from spec + 3 additions).

const EXPERIENCE_FRAMEWORKS: ExperienceFramework[] = [
  {
    label: 'A', name: 'Demonstration then Practice',
    template: `The teacher demonstrates [skill or process related to the topic].
Learners then practice the same skill in pairs, noting their observations.
Each pair shares one finding with the class.`,
  },
  {
    label: 'B', name: 'Problem Solving',
    template: `Learners are presented with a real problem: [scenario relevant to Kenyan context].
In groups, they discuss possible solutions, select the best approach, and explain their reasoning.
Groups present solutions; class selects the most practical one.`,
  },
  {
    label: 'C', name: 'Fieldwork or Practical',
    template: `Learners go to [location: school garden, lab, compound, or nearby area] to collect [data, samples, or observations].
They record findings systematically in their notebooks.
Class compiles all findings and identifies patterns.`,
  },
  {
    label: 'D', name: 'Case Study',
    template: `Learners read or listen to a case study about [specific Kenyan farming, community, or real-life context].
They identify the key issue, analyze what went well or poorly, and propose practical solutions.
Case findings are shared in a class discussion.`,
  },
  {
    label: 'E', name: 'Guided Experiment',
    template: `Learners set up a simple experiment to test [hypothesis related to topic].
They record observations at set intervals, then draw conclusions.
Groups compare results and explain any differences.`,
  },
  {
    label: 'F', name: 'Gallery Walk',
    template: `Charts, samples, or diagrams about [topic] are placed at four stations around the room.
Learners rotate in groups of three, spending 5 minutes per station to observe, discuss, and note.
Whole-class debrief: each group contributes one key point per station.`,
  },
  {
    label: 'G', name: 'Structured Debate',
    template: `Class is divided into two groups to argue opposing positions on [topic or issue].
Each side prepares arguments using textbook evidence (5 minutes).
Groups present; class evaluates the evidence and reaches a reasoned conclusion.`,
  },
  {
    label: 'H', name: 'Jigsaw',
    template: `Each group becomes expert on one aspect of [topic] using provided resources.
Groups then reformat with one expert from each to teach their peers.
Teacher confirms understanding with whole-class oral questions.`,
  },
  {
    label: 'I', name: 'Role Play',
    template: `Learners role-play as [farmer, consumer, extension officer, scientist, etc.] in a [scenario].
They act out the scenario and make decisions from their assigned perspective.
Class debriefs: What decisions were made? What factors influenced them? What would real outcomes be?`,
  },
  {
    label: 'J', name: 'Research then Present',
    template: `Learners research [specific aspect of topic] using the textbook and available charts (10 minutes).
Each group prepares a 2-minute summary and presents to the class.
Teacher builds a class concept map from all presentations.`,
  },
  {
    label: 'K', name: 'Sorting and Classifying',
    template: `Learners receive cards or samples of [items related to topic].
They sort them by [criteria], justify their groupings, and compare with another group.
Class agrees on the most logical classification system.`,
  },
  {
    label: 'L', name: 'Think-Pair-Share',
    template: `Learners individually consider: "How does [topic] work in everyday Kenyan life?" (3 minutes).
Pairs share and refine their thinking (4 minutes).
Selected pairs present; teacher builds a concept summary from class responses.`,
  },
  {
    label: 'M', name: 'Guided Discovery',
    template: `Teacher provides clues, examples, or data about [topic] without stating the rule directly.
Learners work in pairs to discover the underlying concept or pattern.
Pairs share discoveries; teacher confirms or corrects the key concept.`,
  },
  {
    label: 'N', name: 'Question Generation',
    template: `Learners read the textbook passage on [topic] for 5 minutes.
Each learner generates 3 questions — one factual, one analytical, one evaluative.
Pairs swap questions and attempt answers; best questions shared and answered collaboratively.`,
  },
  {
    label: 'O', name: 'Create and Review',
    template: `Learners individually create a diagram, annotated model, or poster of [topic].
Each learner's work is peer-reviewed using a simple checklist (accuracy, labels, completeness).
Teacher leads a class review of three selected samples, highlighting strengths.`,
  },
]

// Kiswahili experience frameworks — same 15-slot rotation, mirrored 1:1 by
// index and label so a Kiswahili lesson keeps the same activity-structure
// diversity guarantee as English, instead of the English template leaking
// through untranslated.
const KISWAHILI_EXPERIENCE_FRAMEWORKS: ExperienceFramework[] = [
  {
    label: 'A', name: 'Onyesho Kisha Mazoezi',
    template: `Mwalimu anaonyesha [ujuzi au mchakato unaohusiana na mada].
Wanafunzi kisha wanafanya mazoezi ya ujuzi huo huo kwa jozi, wakiandika uchunguzi wao.
Kila jozi inashiriki matokeo moja na darasa.`,
  },
  {
    label: 'B', name: 'Utatuzi wa Matatizo',
    template: `Wanafunzi wanawasilishwa tatizo halisi: [hali inayohusiana na muktadha wa Kenya].
Kwa vikundi, wanajadili suluhisho linalowezekana, wanachagua mbinu bora, na kueleza sababu zao.
Vikundi vinawasilisha masuluhisho; darasa linachagua lililo bora zaidi kivitendo.`,
  },
  {
    label: 'C', name: 'Kazi ya Nyanjani au ya Vitendo',
    template: `Wanafunzi wanaenda [mahali: bustani ya shule, maabara, uwanja, au eneo la karibu] kukusanya [data, sampuli, au uchunguzi].
Wanaandika matokeo kwa utaratibu katika daftari zao.
Darasa linakusanya matokeo yote na kubainisha mifumo.`,
  },
  {
    label: 'D', name: 'Uchunguzi Kifani',
    template: `Wanafunzi wanasoma au kusikiliza uchunguzi kifani kuhusu [kilimo, jamii, au hali halisi ya Kenya].
Wanabainisha suala kuu, wanachanganua kilichofanikiwa au kutofanikiwa, na kupendekeza masuluhisho ya kivitendo.
Matokeo ya uchunguzi yanashirikiwa katika majadiliano ya darasa.`,
  },
  {
    label: 'E', name: 'Jaribio Linaloongozwa',
    template: `Wanafunzi wanaandaa jaribio rahisi kupima [dhana inayohusiana na mada].
Wanaandika uchunguzi kwa vipindi maalum, kisha wanatoa hitimisho.
Vikundi vinalinganisha matokeo na kueleza tofauti zozote.`,
  },
  {
    label: 'F', name: 'Matembezi ya Maonyesho',
    template: `Chati, sampuli, au michoro kuhusu [mada] zinawekwa katika vituo vinne kuzunguka darasa.
Wanafunzi wanazunguka kwa vikundi vya watatu, wakitumia dakika 5 kila kituo kuangalia, kujadili, na kuandika.
Majadiliano ya darasa zima: kila kikundi kinachangia jambo moja muhimu kwa kila kituo.`,
  },
  {
    label: 'G', name: 'Mdahalo Ulioratibiwa',
    template: `Darasa linagawanywa katika vikundi viwili kujadili misimamo tofauti kuhusu [mada au suala].
Kila upande unaandaa hoja ukitumia ushahidi wa kitabu (dakika 5).
Vikundi vinawasilisha; darasa linatathmini ushahidi na kufikia hitimisho la kimantiki.`,
  },
  {
    label: 'H', name: 'Jigsaw',
    template: `Kila kikundi kinakuwa mtaalamu wa kipengele kimoja cha [mada] kwa kutumia rasilimali zilizotolewa.
Vikundi kisha vinaungana upya na mtaalamu mmoja kutoka kila kikundi ili kufundisha wenzao.
Mwalimu anathibitisha uelewa kwa maswali ya mdomo ya darasa zima.`,
  },
  {
    label: 'I', name: 'Igizo Dhima',
    template: `Wanafunzi wanaigiza kama [mkulima, mtumiaji, afisa ugani, mwanasayansi, n.k.] katika [hali fulani].
Wanaigiza hali hiyo na kufanya maamuzi kutoka mtazamo waliopewa.
Darasa linajadili: Maamuzi gani yalifanywa? Ni mambo gani yaliyoathiri? Matokeo halisi yangekuwa yapi?`,
  },
  {
    label: 'J', name: 'Utafiti Kisha Uwasilishaji',
    template: `Wanafunzi wanatafiti [kipengele mahususi cha mada] kwa kutumia kitabu na chati zilizopo (dakika 10).
Kila kikundi kinaandaa muhtasari wa dakika 2 na kuwasilisha darasani.
Mwalimu anajenga ramani ya dhana ya darasa kutokana na mawasilisho yote.`,
  },
  {
    label: 'K', name: 'Kupanga na Kuainisha',
    template: `Wanafunzi wanapokea kadi au sampuli za [vitu vinavyohusiana na mada].
Wanavipanga kwa [kigezo], wanathibitisha upangaji wao, na kulinganisha na kikundi kingine.
Darasa linakubaliana kuhusu mfumo bora zaidi wa uainishaji.`,
  },
  {
    label: 'L', name: 'Fikiri-Jozi-Shiriki',
    template: `Wanafunzi binafsi wanafikiria: "Je, [mada] inafanya kazi vipi katika maisha ya kila siku ya Kenya?" (dakika 3).
Jozi zinashiriki na kuboresha mawazo yao (dakika 4).
Jozi zilizoteuliwa zinawasilisha; mwalimu anajenga muhtasari wa dhana kutokana na majibu ya darasa.`,
  },
  {
    label: 'M', name: 'Ugunduzi Ulioongozwa',
    template: `Mwalimu anatoa vidokezo, mifano, au data kuhusu [mada] bila kutaja kanuni moja kwa moja.
Wanafunzi wanafanya kazi kwa jozi kugundua dhana au mfumo uliofichika.
Jozi zinashiriki ugunduzi wao; mwalimu anathibitisha au kusahihisha dhana kuu.`,
  },
  {
    label: 'N', name: 'Utungaji wa Maswali',
    template: `Wanafunzi wanasoma kifungu cha kitabu kuhusu [mada] kwa dakika 5.
Kila mwanafunzi anatunga maswali 3 — la kihakiki, la kichanganuzi, na la kitathmini.
Jozi zinabadilishana maswali na kujaribu kujibu; maswali bora yanashirikiwa na kujibiwa kwa pamoja.`,
  },
  {
    label: 'O', name: 'Unda na Kagua',
    template: `Wanafunzi binafsi wanaunda mchoro, kielelezo kilichoandikwa maelezo, au bango la [mada].
Kazi ya kila mwanafunzi inakaguliwa na wenzake kwa kutumia orodha rahisi (usahihi, lebo, ukamilifu).
Mwalimu anaongoza ukaguzi wa darasa wa sampuli tatu zilizoteuliwa, akisisitiza mambo mazuri.`,
  },
]

// ─── Inquiry Question Frames ──────────────────────────────────────────────────
// 12 distinct frame types — never use the same type in consecutive lessons.

const QUESTION_FRAMES: QuestionFrame[] = [
  {
    name: 'Causal',
    starters: [
      'What causes [process] to occur in [context]?',
      'Why does [phenomenon] happen in this way?',
      'What factors lead to [outcome]?',
    ],
  },
  {
    name: 'Consequence',
    starters: [
      'What happens when [condition changes]?',
      'What would change if [key factor] were removed?',
      'How does [action] affect [outcome] in [local context]?',
    ],
  },
  {
    name: 'Comparative',
    starters: [
      'In what ways does [X] differ from [Y]?',
      'What similarities and differences exist between [A] and [B]?',
      'Which approach is more effective — [option 1] or [option 2] — and why?',
    ],
  },
  {
    name: 'Evaluative',
    starters: [
      'How effective is [method] in addressing [problem] in Kenya?',
      'To what extent does [factor] influence [outcome]?',
      'Is [approach] the best way to [achieve goal]? Justify your view.',
    ],
  },
  {
    name: 'Personal Connection',
    starters: [
      'Where have you seen [concept] in your local community?',
      'How does [topic] affect your daily life as a student in Kenya?',
      'Can you give an example from your own experience where [concept] mattered?',
    ],
  },
  {
    name: 'Process',
    starters: [
      'What steps are involved in [process]?',
      'How does [system] work from start to finish?',
      'In what sequence do the stages of [cycle] occur?',
    ],
  },
  {
    name: 'Hypothetical',
    starters: [
      'What would happen if [key condition] were absent?',
      'How might [outcome] change if [variable] doubled?',
      'If [problem] were solved, how would life be different for Kenyans?',
    ],
  },
  {
    name: 'Investigative',
    starters: [
      'How would you find out whether [claim] is true?',
      'What evidence would you need to confirm [hypothesis]?',
      'How could learners in your school investigate [question]?',
    ],
  },
  {
    name: 'Critical',
    starters: [
      'What are the risks of [practice] in [Kenyan context]?',
      'Should [action or policy] be encouraged or discouraged? Why?',
      'What responsibility do we have towards [issue] as Kenyan citizens?',
    ],
  },
  {
    name: 'Connective',
    starters: [
      'How does [current topic] connect to what we studied about [previous topic]?',
      'In what ways does [topic A] depend on or influence [topic B]?',
      'How do the ideas in this lesson relate to [real Kenyan situation]?',
    ],
  },
  {
    name: 'Application',
    starters: [
      'How can [concept] be applied to improve [aspect of Kenyan life]?',
      'Where in real life have you seen [concept] being used?',
      'How might a [farmer / student / community leader] in your area use [knowledge]?',
    ],
  },
  {
    name: 'Open Challenge',
    starters: [
      'What do you think is the most important aspect of [topic]? Why?',
      'Can you think of a situation where [usual rule or practice] would not apply?',
      'What is one question about [topic] that you still want answered?',
    ],
  },
]

// Kiswahili inquiry question frames — same 12-slot rotation, mirrored 1:1 by
// index so a Kiswahili lesson keeps the same starter-diversity guarantee.
const KISWAHILI_QUESTION_FRAMES: QuestionFrame[] = [
  {
    name: 'Sababu',
    starters: [
      'Ni nini kinachosababisha [mchakato] kutokea katika [muktadha]?',
      'Kwa nini [jambo] hutokea kwa njia hii?',
      'Ni mambo gani yanayosababisha [matokeo]?',
    ],
  },
  {
    name: 'Matokeo',
    starters: [
      'Nini hutokea [hali inapobadilika]?',
      'Ni nini kingebadilika iwapo [kigezo muhimu] kingeondolewa?',
      'Je, [kitendo] kinaathiri vipi [matokeo] katika [muktadha wa eneo]?',
    ],
  },
  {
    name: 'Ulinganishi',
    starters: [
      'Je, [X] inatofautiana vipi na [Y]?',
      'Ni ufanano na tofauti gani zilizopo kati ya [A] na [B]?',
      'Ni mbinu ipi bora zaidi — [chaguo la 1] au [chaguo la 2] — na kwa nini?',
    ],
  },
  {
    name: 'Tathmini',
    starters: [
      'Je, [mbinu] ina ufanisi kiasi gani katika kutatua [tatizo] nchini Kenya?',
      'Je, [kigezo] kinaathiri kiasi gani [matokeo]?',
      'Je, [mbinu] ni njia bora ya [kufikia lengo]? Thibitisha maoni yako.',
    ],
  },
  {
    name: 'Uhusiano wa Kibinafsi',
    starters: [
      'Umeona wapi [dhana] katika jamii yako?',
      'Je, [mada] inaathiri vipi maisha yako ya kila siku kama mwanafunzi nchini Kenya?',
      'Unaweza kutoa mfano kutoka uzoefu wako mwenyewe ambapo [dhana] ilikuwa muhimu?',
    ],
  },
  {
    name: 'Mchakato',
    starters: [
      'Ni hatua gani zinazohusika katika [mchakato]?',
      'Je, [mfumo] unafanya kazi vipi tangu mwanzo hadi mwisho?',
      'Ni katika mfuatano gani hatua za [mzunguko] hutokea?',
    ],
  },
  {
    name: 'Kudhania',
    starters: [
      'Ni nini kingetokea iwapo [kigezo muhimu] hakingekuwepo?',
      'Je, [matokeo] yangebadilika vipi iwapo [kigezo] kingeongezeka mara mbili?',
      'Iwapo [tatizo] lingetatuliwa, maisha yangekuwaje tofauti kwa Wakenya?',
    ],
  },
  {
    name: 'Uchunguzi',
    starters: [
      'Ungefanyaje kuthibitisha kama [dai] ni kweli?',
      'Ni ushahidi gani unaohitajika kuthibitisha [dhana]?',
      'Wanafunzi wa shuleni kwako wangewezaje kuchunguza [swali]?',
    ],
  },
  {
    name: 'Kihakiki',
    starters: [
      'Ni hatari gani za [mazoezi] katika [muktadha wa Kenya]?',
      'Je, [kitendo au sera] inapaswa kuhimizwa au kukatishwa tamaa? Kwa nini?',
      'Tuna wajibu gani kuhusu [suala] kama raia wa Kenya?',
    ],
  },
  {
    name: 'Kiunganishi',
    starters: [
      'Je, [mada ya sasa] inahusiana vipi na tuliyojifunza kuhusu [mada iliyopita]?',
      'Je, [mada A] inategemea au kuathiri vipi [mada B]?',
      'Mawazo ya somo hili yanahusiana vipi na [hali halisi ya Kenya]?',
    ],
  },
  {
    name: 'Matumizi',
    starters: [
      'Je, [dhana] inaweza kutumika vipi kuboresha [kipengele cha maisha ya Kenya]?',
      'Umeona wapi maishani [dhana] ikitumika?',
      '[Mkulima / mwanafunzi / kiongozi wa jamii] katika eneo lako angetumiaje [maarifa]?',
    ],
  },
  {
    name: 'Changamoto Huria',
    starters: [
      'Ni kipengele gani muhimu zaidi cha [mada] kwa maoni yako? Kwa nini?',
      'Je, unaweza kufikiria hali ambapo [kanuni au mazoezi ya kawaida] hayangefaa?',
      'Ni swali gani moja kuhusu [mada] ambalo bado ungependa kupata jibu lake?',
    ],
  },
]

// ─── Assessment Method Pool ───────────────────────────────────────────────────
// 12 distinct types — 3 per lesson, cycling so no two consecutive lessons share all 3.

const ASSESSMENT_TYPES: string[] = [
  'Observation checklist for [specific skill being demonstrated]',
  'Oral questioning using higher-order thinking prompts',
  'Written exercise: [specific task — diagram, list, paragraph, matching]',
  'Practical demonstration assessed against a skill rubric',
  'Peer assessment: learners evaluate each other\'s work using given criteria',
  'Self-assessment: learners rate their own understanding on a 1–4 scale',
  'Exit ticket: one targeted question answered individually before leaving',
  'Assessment of learner product: [poster, chart, annotated model, written report]',
  'Portfolio entry: learner adds evidence of learning to their portfolio',
  'Short quiz (3–5 questions) on key concepts from the lesson',
  'Written reflection: what I learned and one question I still have',
  'Assessment of debate or discussion: participation, reasoning, use of evidence',
]

// Kiswahili assessment methods — same 12-slot rotation, mirrored 1:1 by index.
const KISWAHILI_ASSESSMENT_TYPES: string[] = [
  'Orodha ya uchunguzi kwa [ujuzi mahususi unaoonyeshwa]',
  'Maswali ya mdomo yenye mawazo ya kina',
  'Zoezi la maandishi: [kazi mahususi — mchoro, orodha, aya, ulinganisho]',
  'Onyesho la vitendo linalotathminiwa kwa rubric ya ujuzi',
  'Tathmini ya wenzao: wanafunzi wanatathmini kazi za wenzao kwa vigezo walivyopewa',
  'Kujitathmini: wanafunzi wanapima uelewa wao kwa kiwango cha 1-4',
  'Tiketi ya kutoka: swali moja lililolengwa linalojibiwa binafsi kabla ya kutoka',
  'Tathmini ya kazi ya mwanafunzi: [bango, chati, kielelezo kilichoandikwa maelezo, ripoti]',
  'Kipengele cha kwenye jalada: mwanafunzi anaongeza ushahidi wa ujifunzaji kwenye jalada lake',
  'Jaribio fupi (maswali 3-5) kuhusu dhana kuu za somo',
  'Tafakari ya maandishi: nilichojifunza na swali moja bado ninalotaka kujibiwa',
  'Tathmini ya mdahalo au majadiliano: ushiriki, hoja, matumizi ya ushahidi',
]

// ─── Values Rotation (10 sets) ────────────────────────────────────────────────

const VALUES_SETS: string[] = [
  'Respect, Responsibility, Unity',
  'Integrity, Diligence, Patriotism',
  'Creativity, Curiosity, Perseverance',
  'Empathy, Cooperation, Honesty',
  'Environmental care, Sustainability, Stewardship',
  'Tolerance, Inclusion, Social justice',
  'Self-reliance, Initiative, Resilience',
  'Critical thinking, Objectivity, Open-mindedness',
  'Community service, Citizenship, National pride',
  'Innovation, Excellence, Continuous improvement',
]

// Kiswahili values — same 10-slot rotation, mirrored 1:1 by index.
const KISWAHILI_VALUES_SETS: string[] = [
  'Heshima, Uwajibikaji, Umoja',
  'Uadilifu, Bidii, Uzalendo',
  'Ubunifu, Udadisi, Uvumilivu',
  'Huruma, Ushirikiano, Uaminifu',
  'Utunzaji wa mazingira, Uendelevu, Usimamizi',
  'Uvumilivu, Ujumuishaji, Haki ya kijamii',
  'Kujitegemea, Uwezo wa kuanzisha, Uthabiti',
  'Fikra makini, Uwazi, Kukubali maoni mengine',
  'Huduma kwa jamii, Uraia, Fahari ya kitaifa',
  'Ubunifu, Ubora, Uboreshaji endelevu',
]

// ─── Core Competencies Rotation (8 sets) ─────────────────────────────────────

const COMPETENCY_SETS: string[] = [
  'Communication, Critical thinking, Collaboration',
  'Creativity, Self-efficacy, Learning to learn',
  'Digital literacy, Problem solving, Citizenship',
  'Numeracy, Communication, Self-management',
  'Critical thinking, Creativity, Citizenship',
  'Problem solving, Communication, Learning to learn',
  'Self-efficacy, Digital literacy, Numeracy',
  'Collaboration, Critical thinking, Creativity',
]

// Kiswahili core competencies — same 8-slot rotation, mirrored 1:1 by index,
// using the official 7 CBC core competencies' Kiswahili names.
const KISWAHILI_COMPETENCY_SETS: string[] = [
  'Mawasiliano, Fikra makini, Ushirikiano',
  'Ubunifu, Kujiamini, Kujifunza kujifunza',
  'Ujuzi wa kidijitali, Utatuzi wa matatizo, Uraia',
  'Umahiri wa kihesabu, Mawasiliano, Kujisimamia',
  'Fikra makini, Ubunifu, Uraia',
  'Utatuzi wa matatizo, Mawasiliano, Kujifunza kujifunza',
  'Kujiamini, Ujuzi wa kidijitali, Umahiri wa kihesabu',
  'Ushirikiano, Fikra makini, Ubunifu',
]

// ─── DiversityEngine ──────────────────────────────────────────────────────────

export class DiversityEngine {
  private count = 0  // absolute lesson counter across the whole scheme

  // Generate a fully-formed diversity seed for the next lesson.
  // Uses the lesson counter to cycle deterministically through all pools,
  // ensuring adjacent lessons always differ on every dimension.
  //
  // isKiswahili switches every pool to its Kiswahili counterpart (same
  // slot count, same index alignment, same diversity guarantee) — without
  // this, a Kiswahili lesson's seed carried English verbs/frameworks/
  // questions/assessments/values/competencies straight through into the
  // prompt regardless of the language instruction wrapped around it.
  next(isCBC: boolean, isKiswahili = false): DiversitySeed {
    const i = this.count
    this.count++

    const patternBase  = isKiswahili ? KISWAHILI_OUTCOME_PATTERNS[i % KISWAHILI_OUTCOME_PATTERNS.length] : OUTCOME_PATTERNS[i % OUTCOME_PATTERNS.length]
    const structureKey = STRUCTURE_KEYS[i % STRUCTURE_KEYS.length]
    const framework    = isKiswahili ? KISWAHILI_EXPERIENCE_FRAMEWORKS[i % KISWAHILI_EXPERIENCE_FRAMEWORKS.length] : EXPERIENCE_FRAMEWORKS[i % EXPERIENCE_FRAMEWORKS.length]
    const qFrame       = isKiswahili ? KISWAHILI_QUESTION_FRAMES[i % KISWAHILI_QUESTION_FRAMES.length] : QUESTION_FRAMES[i % QUESTION_FRAMES.length]
    const values       = isKiswahili ? KISWAHILI_VALUES_SETS[i % KISWAHILI_VALUES_SETS.length] : VALUES_SETS[i % VALUES_SETS.length]
    const competencies = isCBC
      ? (isKiswahili ? KISWAHILI_COMPETENCY_SETS[i % KISWAHILI_COMPETENCY_SETS.length] : COMPETENCY_SETS[i % COMPETENCY_SETS.length])
      : (isKiswahili ? 'Utatuzi wa matatizo, Fikra makini' : 'Problem solving, Critical thinking')

    // Pick 3 assessments from non-overlapping positions in the pool
    const assessmentPool = isKiswahili ? KISWAHILI_ASSESSMENT_TYPES : ASSESSMENT_TYPES
    const a1 = assessmentPool[i % assessmentPool.length]
    const a2 = assessmentPool[(i + 4) % assessmentPool.length]
    const a3 = assessmentPool[(i + 8) % assessmentPool.length]

    const outcomePattern: OutcomePattern = {
      ...patternBase,
      structure: structureKey,
    }

    const contextBlock = buildContextBlock(outcomePattern, framework, qFrame, [a1, a2, a3])

    return {
      outcomePattern,
      framework,
      questionFrame: qFrame,
      assessmentMethods: [a1, a2, a3],
      values,
      coreCompetencies: competencies,
      contextBlock,
    }
  }

  reset(): void {
    this.count = 0
  }
}

// ─── Context block builder ────────────────────────────────────────────────────
// Builds the per-lesson diversity instruction injected into the user prompt.

function buildContextBlock(
  pattern:     OutcomePattern,
  framework:   ExperienceFramework,
  qFrame:      QuestionFrame,
  assessments: string[],
): string {
  const structureDesc = OUTCOME_STRUCTURES[pattern.structure]
  return `
DIVERSITY INSTRUCTIONS FOR THIS LESSON:

OUTCOMES — Use these specific verbs and sentence structure:
  Level 1 verb: "${pattern.l1}"
  Level 2 verb: "${pattern.l2}"
  Level 3 verb: "${pattern.l3}"
  Sentence structure: Structure ${pattern.structure} → "${structureDesc}"

LEARNING EXPERIENCE — Use Framework ${framework.label} (${framework.name}):
${framework.template}

INQUIRY QUESTIONS — Use the "${qFrame.name}" frame with these starters:
  Q1: ${qFrame.starters[0]}
  Q2: ${qFrame.starters[1]}
  Q3: ${qFrame.starters[2]}

ASSESSMENT — Use exactly these three methods (do not substitute):
  1. ${assessments[0]}
  2. ${assessments[1]}
  3. ${assessments[2]}
`.trim()
}

// ─── Diversity audit ──────────────────────────────────────────────────────────
// Run after all lessons are generated to surface remaining repetition.

export interface DiversityAuditResult {
  passed: boolean
  issues: string[]
}

function extractOpeningVerb(outcome: string): string {
  return outcome
    .toLowerCase()
    .replace(/^(by the end[^,]+,\s*)/i, '')
    .replace(/^(learners?\s+(will\s+)?(be able to\s+)?)/i, '')
    .trim()
    .split(/[\s,;.(]+/)[0] ?? ''
}

export function auditDiversity(lessons: GeneratedLesson[]): DiversityAuditResult {
  const issues: string[] = []

  for (let i = 1; i < lessons.length; i++) {
    const prev = lessons[i - 1]
    const curr = lessons[i]

    // Check verb overlap between adjacent lessons
    const prevVerbs = prev.learningOutcomes.map(extractOpeningVerb).filter(Boolean)
    const currVerbs = curr.learningOutcomes.map(extractOpeningVerb).filter(Boolean)
    const overlap   = prevVerbs.filter(v => currVerbs.includes(v))
    if (overlap.length >= 2) {
      issues.push(`Wk${curr.week} Lsn${curr.lesson}: shares ≥2 opening verbs with previous lesson (${overlap.join(', ')})`)
    }

    // Check experience framework repetition (first sentence)
    const prevExp = (prev.learningExperiences[0] ?? '').toLowerCase().slice(0, 60)
    const currExp = (curr.learningExperiences[0] ?? '').toLowerCase().slice(0, 60)
    if (prevExp && currExp && prevExp === currExp) {
      issues.push(`Wk${curr.week} Lsn${curr.lesson}: identical experience opening to previous lesson`)
    }

    // Check overused "groups to observe" pattern
    if (/learners work in groups to observe/.test(currExp)) {
      if (i >= 2) {
        const twoBack = (lessons[i - 2].learningExperiences[0] ?? '').toLowerCase()
        if (/learners work in groups to observe/.test(twoBack)) {
          issues.push(`Wk${curr.week} Lsn${curr.lesson}: "groups to observe" used 2 lessons ago — rotate framework`)
        }
      }
    }

    // Check identical assessment combination
    const prevA = [...prev.assessmentMethods].sort().join('|')
    const currA = [...curr.assessmentMethods].sort().join('|')
    if (prevA === currA) {
      issues.push(`Wk${curr.week} Lsn${curr.lesson}: identical assessment combination as previous lesson`)
    }

    // Check inquiry question starters
    const prevQStarters = prev.keyInquiryQuestions.map(q => q.split(/\s+/).slice(0, 3).join(' ').toLowerCase())
    const currQStarters = curr.keyInquiryQuestions.map(q => q.split(/\s+/).slice(0, 3).join(' ').toLowerCase())
    const qOverlap = prevQStarters.filter(s => currQStarters.includes(s))
    if (qOverlap.length >= 2) {
      issues.push(`Wk${curr.week} Lsn${curr.lesson}: ≥2 inquiry question starters repeated from previous lesson`)
    }
  }

  return { passed: issues.length === 0, issues }
}
