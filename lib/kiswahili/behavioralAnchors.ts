// lib/kiswahili/behavioralAnchors.ts
// Observable student behaviors per CBC level per Kiswahili strand.
// Used by teachers to make consistent formative assessments and by the AI judge
// to calibrate insha/oral evaluation against real classroom observation.

export type CbcLevel = 1 | 2 | 3 | 4

export type BehavioralAnchor = {
  level:     CbcLevel
  label:     string    // BE / AE / ME / EE
  indicator: string    // what the teacher observes (Kiswahili)
  example:   string    // concrete student behavior example (Kiswahili)
}

export type StrandAnchorSet = {
  strand:       string
  strandCode:   string   // KUS / KSM / KAN / SAR / FAS / LUG / FSH
  grades:       number[]
  description:  string
  anchors:      BehavioralAnchor[]
}

const LEVEL_LABELS: Record<CbcLevel, string> = {
  1: 'BE',
  2: 'AE',
  3: 'ME',
  4: 'EE',
}

function anchor(level: CbcLevel, indicator: string, example: string): BehavioralAnchor {
  return { level, label: LEVEL_LABELS[level], indicator, example }
}

// ── Strand 1: Kusikiliza na Kuongea (G7-9) ───────────────────────────────────

export const KUS_ANCHORS: StrandAnchorSet = {
  strand:      'Kusikiliza na Kuongea',
  strandCode:  'KUS',
  grades:      [7, 8, 9],
  description: 'Uwezo wa mwanafunzi kusikiliza kwa makini na kujibu, kuongea kwa uwazi, na kushiriki katika mazungumzo ya kikundi.',
  anchors: [
    anchor(1,
      'Mwanafunzi anaonyesha tabu ya kufuatia mazungumzo — anajibu bila kusikiliza au anaondoka kimwili kwenye mazungumzo.',
      'Aliulizwa "Je, unakubaliana na hoja ya Juma?" akajibu "Ndiyo" lakini Juma hakusema chochote.'),
    anchor(2,
      'Mwanafunzi anaweza kujibu maswali rahisi ya moja kwa moja lakini ana tatizo ya kuelezea kwa maneno yake mwenyewe.',
      'Alisikia hotuba fupi, akajua jibu la swali "Mzungumzaji alizungumzia nini?" lakini hakuweza kuelezea kwa sentensi yake mwenyewe.'),
    anchor(3,
      'Mwanafunzi anafuatia mazungumzo, anajibu kwa usahihi, na anachangia maoni yake kwa utulivu katika mjadala.',
      'Alishiriki katika mjadala wa kikundi, akabainisha hoja za wengine kwa usahihi, akachangia hoja yake mwenyewe akiungana na zingine.'),
    anchor(4,
      'Mwanafunzi anachunguza hoja za wengine kwa kina, anazichanganua, na anachangia kwa usahihi wa lugha na uthabiti wa mawazo.',
      'Katika mjadala, alisema: "Nakubaliana na hoja yako ya kwanza lakini sehemu ya pili inapingana na ukweli huu..." akitoa mfano halisi.'),
  ],
}

// ── Strand 2: Kusoma (G7-9) ──────────────────────────────────────────────────

export const KSM_ANCHORS: StrandAnchorSet = {
  strand:      'Kusoma',
  strandCode:  'KSM',
  grades:      [7, 8, 9],
  description: 'Uwezo wa mwanafunzi kusoma kwa ufasaha na kuelewa: kutambua mawazo makuu, kuelewa msamiati wa muktadha, na kuchambua aina tofauti za maandishi.',
  anchors: [
    anchor(1,
      'Mwanafunzi anasoma polepole sana au kwa makosa mengi; haelewi maana ya andishi lililosomwa.',
      'Alisoma aya moja, aliulizwa swali la ufahamu rahisi, akajibu kwa kunakili sentensi bila kuelewa.'),
    anchor(2,
      'Mwanafunzi anaweza kutoa majibu ya ukweli kutoka kwenye andishi lakini ana tatizo la kufanya hitimisho au kutoa wazo kuu kwa maneno yake.',
      'Alijibu maswali ya "nani" na "nini" kwa usahihi lakini alipoulizwa "kwa nini?" hakuweza kujibu.'),
    anchor(3,
      'Mwanafunzi anatoa wazo kuu la aya, anaelewa msamiati kutoka kwa muktadha, na anatofautisha kati ya aina tofauti za maandishi.',
      'Alisoma makala na habari za mada moja, akabainisha vizuri tofauti za muundo, lugha, na kusudi.'),
    anchor(4,
      'Mwanafunzi anachambua andishi kwa kina: anaona mtazamo wa mwandishi, anagundua maana ya ndani, na analinganisha maandishi kwa vigezo.',
      'Alipoulizwa kuchambua mashairi mawili, alibainisha tofauti za fani na maudhui, akielezea jinsi kila mshairi anavyobeba maudhui sawa kwa njia tofauti.'),
  ],
}

// ── Strand 3: Kuandika (G7-9 + G10 Lugha) ───────────────────────────────────

export const KAN_ANCHORS: StrandAnchorSet = {
  strand:      'Kuandika',
  strandCode:  'KAN',
  grades:      [7, 8, 9, 10],
  description: 'Uwezo wa mwanafunzi kuandika insha za aina tofauti kwa muundo sahihi, lugha ya kuvutia, na mawazo yanayoendelea.',
  anchors: [
    anchor(1,
      'Insha haina muundo unaoonekana — utangulizi, kiini, na hitimisho havitofautiani; sentensi nyingi zina makosa ya msingi ya kisarufi.',
      'Utangulizi wa insha unasema "Insha yangu inaitwa..." na kiini ni orodha ya matukio bila uhusiano.'),
    anchor(2,
      'Insha ina muundo unaoonekana lakini utangulizi na hitimisho ni dhaifu; lugha ina msamiati wa kawaida na makosa ya kisarufi ya wastani.',
      'Utangulizi unabainisha mada lakini hauvutii; hitimisho linasema tu "Hadithi imekwisha" bila maana inayodumu.'),
    anchor(3,
      'Insha ina muundo mzuri, utangulizi unaovutia, kiini chenye mawazo yanayoendelea, na hitimisho lenye maana. Msamiati ni wa kutosha na makosa ya kisarufi ni machache.',
      'Utangulizi unaanza kwa sentensi ya msisimko; kila aya ina wazo moja kuu na mifano; hitimisho linaacha msomaji na hisia wazi.'),
    anchor(4,
      'Insha ina muundo wa juu na ustadi wa lugha — fani za lugha zinatumiwa kwa makusudi, mtiririko wa mawazo ni bora, na hitimisho linaambatana na mada nzima kwa usahihi.',
      'Anatumia sitiari na takriri kwa makusudi, hoja za insha ya hoja zinapingana kwa mfano wa kweli, na hitimisho linakuja kama hitimisho la mantiki si muhtasari tu.'),
  ],
}

// ── Strand 4: Sarufi na Msamiati (G7-9 + G10 Lugha) ────────────────────────

export const SAR_ANCHORS: StrandAnchorSet = {
  strand:      'Sarufi na Msamiati',
  strandCode:  'SAR',
  grades:      [7, 8, 9, 10],
  description: 'Uwezo wa mwanafunzi kutumia sarufi ya Kiswahili kwa usahihi: ngeli za nomino, upatanisho, nyakati za vitenzi, na sentensi changamano.',
  anchors: [
    anchor(1,
      'Makosa ya ngeli na upatanisho yanaonekana kwa wingi katika sentensi yoyote — mwanafunzi haoni makosa baada ya kuyafanya.',
      '"Watoto mzuri walicheza" anaandika "watoto mzuri" — anaona ni sawa. Alipoulizwa kusahihisha, hakujua tatizo ni wapi.'),
    anchor(2,
      'Mwanafunzi anaandika upatanisho kwa usahihi katika sentensi rahisi lakini anashindwa katika ngeli ngumu (N/N) au sentensi changamano.',
      'Anaandika "mtoto mzuri" (sawa) lakini "simba mkubwa" na "simba wakubwa" katika aya moja bila kutambua kosa.'),
    anchor(3,
      'Mwanafunzi anatumia ngeli zote kuu kwa usahihi wa upatanisho na anaandika sentensi za nyakati tofauti kwa usahihi wa wastani.',
      'Anaandika insha yenye sentensi 10 — upatanisho ni sahihi kwa ngeli zote kuu; nyakati -li-, -na-, -ta-, -me- zinatumiwa kwa usahihi.'),
    anchor(4,
      'Mwanafunzi anatumia sarufi yote kwa ujuzi, ikiwa ni pamoja na sentensi changamano, hali ya masharti, na ukanushi wa ngeli zote.',
      'Anaandika sentensi changamano 5 zenye vishazi tegemezi tofauti, hali ya masharti yenye -nge-/-ngeli-, na ukanushi sahihi kwa ngeli zote bila makosa.'),
  ],
}

// ── Strand 5: Fasihi (G7-9) ──────────────────────────────────────────────────

export const FAS_JUNIOR_ANCHORS: StrandAnchorSet = {
  strand:      'Fasihi',
  strandCode:  'FAS',
  grades:      [7, 8, 9],
  description: 'Uwezo wa mwanafunzi kuchambua kazi za fasihi: hadithi fupi, mashairi, tamthilia, na riwaya — kwa kuzingatia vipengele vya maudhui na fani.',
  anchors: [
    anchor(1,
      'Mwanafunzi anachanganya dhana za msingi: maudhui na dhamira, wahusika wa ngozi na wa bapa, tashbihi na sitiari.',
      'Alipoulizwa dhamira ya hadithi, alijibu kwa kutaja maudhui. Alipoulizwa tena, alitoa jibu lile lile kwa maneno tofauti.'),
    anchor(2,
      'Mwanafunzi anajua maana ya istilahi za msingi lakini anachanganya wakati wa kuzitumia; anachambua vipengele kwa kujitegemea bila kuonyesha uhusiano wao.',
      'Alibainisha dhamira kwa usahihi katika hadithi moja lakini alishindwa katika hadithi ya pili; alisema "dhamira ni upendo" (neno moja, si kauli kamili).'),
    anchor(3,
      'Mwanafunzi anachambua vipengele vya fasihi kwa usahihi na anaonyesha uhusiano kati yao — fani na maudhui, wahusika na dhamira.',
      'Alisema: "Dhamira ya hadithi hii ni kwamba ujasiri huleta ushindi — hii inaonekana kupitia mhusika mkuu anayepigana licha ya hofu (wahusika) na mandhari ya giza (mandhari)."'),
    anchor(4,
      'Mwanafunzi anachambua fasihi kwa kina na kutoa tathmini yenye ushahidi — analinganisha kazi mbili au anaona njia mbadala za tafsiri.',
      'Alilinganisha hadithi fupi mbili za dhamira moja, akabainisha jinsi kila mwandishi anavyobeba dhamira kwa njia tofauti, akahitimisha ni ipi inafanya kazi vizuri zaidi kwa ushahidi.'),
  ],
}

// ── Strand 6: Kiswahili Lugha — Senior (G10-12) ──────────────────────────────

export const KLG_ANCHORS: StrandAnchorSet = {
  strand:      'Kiswahili Lugha',
  strandCode:  'LUG',
  grades:      [10, 11, 12],
  description: 'Uwezo wa mwanafunzi wa ngazi ya juu katika sarufi, uandishi rasmi, muhtasari, na uchanganuzi wa matini.',
  anchors: [
    anchor(1,
      'Mwanafunzi ana tatizo kubwa la sarufi ya msingi — upatanisho, nyakati, na muundo wa sentensi una makosa mengi katika kazi yoyote.',
      'Muhtasari wake una sentensi nyingi zilizokuwa nakala za andishi la asili — hakuelewa dhana ya "maneno yako mwenyewe."'),
    anchor(2,
      'Mwanafunzi anajua dhana za msingi lakini ana tatizo la kuzitekeleza kwa uhakika — insha ya hoja ina hoja bila ushahidi; muhtasari ni mrefu sana.',
      'Insha ya hoja ina msimamo lakini hoja zake ni madai tu: "Elimu ya teknolojia ni muhimu kwa sababu inasaidia" — hakuna ushahidi wala mfano.'),
    anchor(3,
      'Mwanafunzi anaandika insha ya hoja yenye msimamo thabiti, hoja na ushahidi, na hoja ya kupinga. Muhtasari wake ni karibu 1/3 ya asili kwa maneno yake mwenyewe.',
      'Aliandika insha yenye hoja tatu na ushahidi, akajumuisha hoja ya kupinga akaikataa kwa mfano halisi, hitimisho lilikamilisha msimamo.'),
    anchor(4,
      'Mwanafunzi anaandika kwa ujuzi wa lugha wa hali ya juu — muundo wa hotuba, uchanganuzi wa kina wa matini, na uandishi wa fani nyingi bila makosa ya kisarufi.',
      'Alitoa hotuba ya dakika tano yenye muundo kamili, lugha rasmi, na hoja za kuvutia — hadhira ilisikiliza kwa makini bila msukosuko wa lugha.'),
  ],
}

// ── Strand 7: Kiswahili Fasihi — Senior (G10-12) ─────────────────────────────

export const KFS_ANCHORS: StrandAnchorSet = {
  strand:      'Kiswahili Fasihi',
  strandCode:  'FSH',
  grades:      [10, 11, 12],
  description: 'Uwezo wa mwanafunzi kuchambua kwa kina kazi za fasihi za ngazi ya juu: mashairi ya kimapokeo na ya kisasa, riwaya, na tamthilia kwa kutumia nadharia za uhakiki.',
  anchors: [
    anchor(1,
      'Mwanafunzi anachanganya dhana za msingi za fani na maudhui; hawezi kubainisha mbinu za kidrama au arudhi ya mashairi.',
      'Alipoulizwa arudhi ya shairi, alijibu kwa idadi ya mistari badala ya silabi. Fani na maudhui vilichanganywa katika jibu moja.'),
    anchor(2,
      'Mwanafunzi anajua istilahi za fasihi lakini anazitumia kwa njia mbaya — anaelezea fani na kutoa maudhui, au kinyume chake.',
      'Katika jibu la "fani ya tamthilia," alisema "inashughulikia umaskini" — hii ni maudhui, si fani.'),
    anchor(3,
      'Mwanafunzi anachambua kwa usahihi fani na maudhui wa kazi ya fasihi, anaonyesha uhusiano wao, na anatoa uhakiki wenye vigezo vya msingi.',
      'Aliandika uchambuzi wa riwaya akibainisha mtazamo wa msimulizi (fani), akaorodhesha dhamira kuu na ndogo (maudhui), akahitimisha jinsi fani inavyobeba maudhui.'),
    anchor(4,
      'Mwanafunzi anachambua kwa kina kwa kutumia nadharia tofauti za uhakiki, analinganisha kazi mbili kwa vigezo, na anatoa tathmini yake mwenyewe yenye ushahidi wa kina.',
      'Alilinganisha tamthilia mbili za dhamira ya haki kwa uhakiki wa kisanaa na wa kijamii, akabainisha ni ipi inabeba dhamira vizuri zaidi kwa kuelezea jinsi fani na maudhui zinavyofanya kazi pamoja.'),
  ],
}

// ── All anchors by subject and grade ─────────────────────────────────────────

export const KISWAHILI_BEHAVIORAL_ANCHORS: StrandAnchorSet[] = [
  KUS_ANCHORS,
  KSM_ANCHORS,
  KAN_ANCHORS,
  SAR_ANCHORS,
  FAS_JUNIOR_ANCHORS,
  KLG_ANCHORS,
  KFS_ANCHORS,
]

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getAnchorsForGrade(grade: number): StrandAnchorSet[] {
  return KISWAHILI_BEHAVIORAL_ANCHORS.filter(s => s.grades.includes(grade))
}

export function getAnchorsForStrand(strandCode: string): StrandAnchorSet | undefined {
  return KISWAHILI_BEHAVIORAL_ANCHORS.find(
    s => s.strandCode.toUpperCase() === strandCode.toUpperCase()
  )
}

export function getAnchorForLevel(
  strandCode: string,
  level: CbcLevel
): BehavioralAnchor | undefined {
  const set = getAnchorsForStrand(strandCode)
  return set?.anchors.find(a => a.level === level)
}

// Returns the observable indicators as a compact rubric string for AI prompt injection
export function buildStrandRubric(strandCode: string): string {
  const set = getAnchorsForStrand(strandCode)
  if (!set) return ''
  return set.anchors
    .map(a => `${a.label} (${a.level}): ${a.indicator}`)
    .join('\n')
}
