# Career Signals MVP — Signal Verification Record

Phase 8.1 implementation. Data lives in `lib/career/careerSignals.ts`; validated by
`lib/career/careerSignals.test.ts`. This record exists for future auditability —
per Phase 8 (`docs/architecture/phase8-career-signals-audit.md`) §29/§37, every
learner-facing signal must be traceable back to why it was judged real, current,
and correctly scoped.

Verified: 2026-08-24. All five signals were checked by fetching the actual source
page (not just a search snippet) on that date.

---

## 1. `kenya-agriculture-digital-policy-2026`

- **Type:** FACTUAL INSTITUTIONAL CHANGE (a ministry's own draft policy)
- **Source 1 (sole, sufficient per §5):** TechAfrica News, "Kenya Unveils Draft Agricultural Data and Digital Policy to Transform Farming Sector," 2026-03-26, tier2 — reports Kenya's Ministry of Agriculture and Livestock Development's draft Agricultural Data, Information and Digital Policy and Digital Agricultural Information Bill, establishing KADIC (Kenya Agricultural Digital Information Centre) and building on KIAMIS (7.2M+ registered farmers).
- **Why it qualifies:** A named government ministry's own draft policy/bill is a factual institutional action, not an interpretive claim — the "does the broader claim survive removing one company/event" test doesn't apply here because nothing is being generalized beyond what the ministry itself announced.
- **Why geography is KENYA:** The policy is Kenya-specific by definition; no global/regional generalization is made.
- **Why confidence is EARLY, not higher:** The policy and bill are still in draft form as of the source date — not yet enacted. Confidence will move to EMERGING/ESTABLISHED only on a future review confirming enactment or sustained implementation.
- **Related career slugs:** `agricultural-scientist`, `environmental-scientist` (both real slugs in `lib/career/seedCareers.ts`).

## 2. `kenya-green-buildings-roadmap-2026`

- **Type:** FACTUAL INSTITUTIONAL CHANGE (a government department's own roadmap launch)
- **Source 1 (sole, sufficient per §5):** Big3Africa, "Kenya Launches 2026–2040 Green Buildings Roadmap," 2026-02-27, tier2 — reports the State Department for Public Works' formal launch (Works Secretary Nicholas Mutua) of the National Buildings & Construction Decarbonization Roadmap (2026–2040): phased building-code revisions from 2026, mandatory minimum energy-performance standards for new public buildings by 2030, low-clinker cement/passive cooling/rooftop solar initiatives, and five-year UNFCCC-aligned reviews.
- **Why it qualifies:** Same reasoning as #1 — a named government department's own formal roadmap launch, factual not interpretive.
- **Why geography is KENYA:** Kenya-specific government roadmap.
- **Why confidence is EARLY:** Just launched (Feb 2026); code revisions are "phased" and the 2030 standard hasn't taken effect yet. Will re-review as implementation milestones land.
- **Related career slugs:** `civil-engineer`, `environmental-scientist`.

## 3. `kenya-accounting-audit-analytics-2026`

- **Type:** FACTUAL INSTITUTIONAL CHANGE (the regulator's own programme/platform)
- **Source 1 (sole, sufficient — ICPAK is the Tier 1 regulator itself, a primary source about its own activities):** ICPAK (Institute of Certified Public Accountants of Kenya) official website, fetched 2026-08-24, tier1 — confirms ICPAK operates the "myAudit" audit-automation platform for members (built-in IFRS-for-SMEs support, the official ICPAK Audit Manual) and is running a "Risk Management, Data Analytics Seminar and Compliance" CPD event (South Rift Branch, 27 August 2026).
- **Why it qualifies:** ICPAK is Kenya's statutory accountancy regulator (Accountants Act CAP 531) — this is a primary-source, Tier 1 fact about the regulator's own tooling and CPD programming, not a third-party claim about "the industry."
- **Why geography is KENYA:** ICPAK is Kenya-specific.
- **Why confidence is EARLY, not higher:** This documents that the regulator is actively investing in analytics/automation tooling and training — it does not yet establish that this has become standard practice across the profession. A future review could raise confidence if broader adoption evidence emerges (or lower it — see §30/§37 of Phase 8 for the re-review discipline).
- **Related career slugs:** `accountant-financial-analyst`.

## 4. `kenya-ai-strategy-tvet-ict-2026`

- **Type:** STRUCTURAL — combines a named government strategy with a named training partnership; treated as requiring corroboration even though each individual fact is itself institutional, because the signal's claim ("Kenya is building real training capacity, not just policy") synthesizes across two separate announcements.
- **Source 1:** The Standard, "Government roots Kenya's AI ambitions in industry-led digital skills," Mike Kihaki, 2026-08-02, tier2 — reports Kenya's AI Strategy (2025–2030), quoting Principal Secretary Eng. John Kipchumba Tanui on digital-skills development as a growth/job-creation enabler; covers a Moringa School graduation event (Data Science/AI/Cybersecurity/Data Analytics/Software Engineering/DevOps/Product Design/Data Visualization tracks, 60+ employers at the career fair).
- **Source 2 (independent, corroborating):** Capital FM Africa, "Kenya's AI skills gap: How universities are preparing the next generation," Spencer Walela, 2026-08-14, tier2 — independently reports a State Department–Huawei partnership targeting 150 ICT Academies across Kenyan TVET institutions, aiming for ~1,000 professional certifications and 150 trained instructors annually; also cites PwC's 2025 Africa Workforce Hopes and Fears Survey (64% of Kenyan workers used AI in their jobs vs. 54% global average) and a World Bank analysis of 60,000+ Kenyan job postings identifying ML/big-data/cloud/Python skill gaps.
- **Why it qualifies:** Two independently-bylined, independently-published tier2 sources, each naming specific institutions/programmes rather than repeating one press release — satisfies the "remove one source, does the claim still stand" test (the TVET/Huawei fact and the AI Strategy fact are reported by different outlets, on different dates, about different (complementary) programmes).
- **Why geography is KENYA:** Both the national AI Strategy and the TVET partnership are Kenya-specific.
- **Why confidence is EMERGING:** Two independent tier2 sources, consistent claim, concrete named programmes with numeric targets (not just aspirational language) — but not yet ESTABLISHED because the TVET rollout (150 academies) is a target, not yet a completed outcome as of the source dates.
- **Related career slugs:** `software-engineer`.

## 5. `ai-radiology-augmentation-2026`

- **Type:** STRUCTURAL TREND (a global technology-adoption claim)
- **Source 1:** The Imaging Wire, "Numbers from the FDA Show Radiology Is Maintaining Its Lead," 2026-03-12, tier2 (specialist trade publication reporting directly on the US FDA's own AI-Enabled Medical Device List, a Tier 1 regulatory dataset) — 1,451 total AI-enabled medical devices authorized by the FDA since 1995, 1,104 (76%) of them radiology devices; radiology ~75–76% of new AI clearances through 2025.
- **Source 2 (independent, corroborating the "augmentation not replacement" framing specifically):** IntuitionLabs, "AI Adoption in Radiology: Key Statistics," updated 2026-08-08 (covering data through Nov 2025), tier3 — a 2024 European radiologist survey found 48% actively using AI tools (up from 20% in 2018); explicitly frames AI as "augmenting rather than replacing radiologists," comparing AI tools to aviation autopilot systems requiring human oversight.
- **Why it qualifies:** Two independent sources (different publishers, different underlying datasets — US FDA regulatory data vs. a European practitioner survey), at least one tier2, both pointing the same direction. Two attempted academic sources (a Springer LMIC-adoption paper and a Lancet eClinicalMedicine scoping review) were found in search but were paywalled/blocked on fetch (HTTP 403/redirect-to-login) — per Phase 8.1 rule §37 ("if a source cannot be inspected sufficiently, do not use it as the core supporting source"), neither was used as supporting evidence; they are noted here only as leads for a future reviewer with journal access.
- **Why geography is GLOBAL, not KENYA:** All verifiable evidence is US/European regulatory and survey data. No Kenya- or Africa-specific adoption data was found in this research pass (a South Africa radiologist-shortage article surfaced in search but describes scarcity, not AI adoption, and was not used). The card and `learnerExplanation` are phrased as a global technology pattern, not as something already deployed in Kenyan hospitals — this is the specific failure mode Phase 8 §11/§21 warns against, and content-policy test `GLOBAL signals do not claim to already be happening "in Kenya"` in `careerSignals.test.ts` guards it structurally.
- **Why confidence is EMERGING, not ESTABLISHED:** Strong regulatory-clearance volume and a clear augmentation framing, but the European survey (48% adoption) is the only quantified practitioner-level adoption figure found, and it's a single region — not yet "sustained multi-source evidence over months with no credible contradiction" territory across markets.
- **Related career slugs:** `medical-doctor`.

---

---

# Phase 8.2 addendum — 6 new signals, verified 2026-08-24

Same standard as Phase 8.1: every source below was fetched directly (not snippet-only) except where explicitly noted as a search-summary-only source (marked, with the reason).

## 6. `kenya-newsroom-ai-policy-2026`

- **Type:** STRUCTURAL TREND (a newsroom-practice claim spanning multiple institutions)
- **Source 1:** Reuters Institute for the Study of Journalism, Digital News Report 2026 — Kenya, published 2026-06-16, tier1 (Oxford-based academic research institute, the most authoritative annual global source on news-industry trends) — confirms Nation Media Group's formal AI policy framework and notes uneven sector-wide adoption.
- **Source 2 (independent):** The Star (Kenya), "Fact-checking skills gain urgency as AI reshapes journalism," 2026-06-02, tier2 — reports the National Fact-Checking Bootcamp at Zetech University with Africa Check and DIMLIS Africa.
- **Why it qualifies:** Two independent institutions (a national media house's own policy + a university/NGO training programme) both responding to the same underlying shift — corroborated, not a single anecdote.
- **Related career slugs:** `journalist-content-creator`, `journalist-media-producer`.

## 7. `kenya-jss-teacher-digital-training-2026`

- **Type:** FACTUAL INSTITUTIONAL CHANGE (TSC/ICT Authority's own government programme)
- **Source (sole, sufficient per the factual-institutional-change rule):** EduTimes Africa, 2026-06-26, tier2 — reports exact, checkable figures: 62,565 JSS teachers, 20,855 schools, 47 counties, 3,754 Trainers of Trainers, under the Kenya Digital Economy Acceleration Project (KDEAP). Directly fetched and confirmed.
- **Related career slugs:** `teacher-education-technologist`.

## 8. `kenya-fintech-digital-economy-2026`

- **Type:** STRUCTURAL TREND (market-level claim)
- **Source 1:** The Fintech Times, "The Fintech and Wider Digital Ecosystem of Kenya in 2026," tier2 — directly fetched; confirms ~450 fintech companies, 85% formal financial-account inclusion (up from ~26% in 2006), and the Central Bank of Kenya's Digital Credit Providers Regulations (a real regulatory fact, not just a market claim).
- **Source 2 (independent, corroborating):** Statista Kenya Fintech Market Outlook, tier3 — found via search, not independently fetched (Statista pages typically require a subscription to view full data; used only as directional corroboration for continued growth, not as the core supporting claim).
- **Exact publication dates were not stated on either page** (both are continuously-updated market-overview pages, not dated news articles) — `publishedAt`/`observedAt` use the verification date (2026-08-24) rather than a fabricated specific date, which is the honest choice for an evergreen reference source.
- **Related career slugs:** `entrepreneur-business`, `economist-policy-analyst`.

## 9. `kenya-mental-health-act-2026`

- **Type:** FACTUAL INSTITUTIONAL CHANGE (a statutory legal requirement, the strongest possible single-source case)
- **Source 1 (sole legal source, sufficient alone):** Kenya Law, official text of the Mental Health Act (Cap. 248), as amended, effective 2023-12-11, tier1 (primary legislation) — directly fetched; confirmed Section 5(ha) (curriculum integration), Section 2D(1) (county outpatient service mandates), Section 9 (facility-level service requirements), and the Section 2 definition of "mental health practitioner" including psychologists and counsellors.
- **Source 2 (independent, corroborating the practical hiring impact):** Kenya News Agency — government plans to recruit 60 more counsellors, following a workshop for 18 newly employed counselling psychologists. Exact publication date not stated on the page (found via search, direct fetch returned a TLS certificate error); verification date used.
- **Why `observedAt` is 2023-12-11, not 2026:** the Act's effective date is the actual underlying development — this is a still-relevant, actively-being-implemented legal requirement, not a stale one; its 2026 relevance is the ongoing hiring/curriculum-integration activity Source 2 documents.
- **Related career slugs:** `counselling-psychologist`, `social-worker-community-developer`.

## 10. `kenya-sports-science-analytics-2026`

- **Type:** FACTUAL INSTITUTIONAL FACT (established academic programme content + an institutional partnership) — treated as EARLY confidence despite two Tier 1 sources because both describe **standing programmes**, not a recent, dated change (weaker "signal," stronger "fact")
- **Source 1:** Kenyatta University's Exercise and Sports Science programme page, tier1 (university, primary source) — directly fetched; confirms dedicated sports-data-analytics and computer-technology-applications units alongside coaching/physiology.
- **Source 2:** Kenya Academy of Sports workshop page, tier1 (government sports academy, primary source) — describes a joint research workshop with the Hungarian University of Sports Science.
- **Neither page carries an explicit publication/event date** — both are institutional reference pages; verification date used for both, and confidence kept at EARLY specifically because of this dating ambiguity (an honest downgrade, not a default).
- **Related career slugs:** `sports-coach-athlete-development`.

## 11. `kenya-creative-economy-bill-2026`

- **Type:** FACTUAL INSTITUTIONAL CHANGE (a government budget announcement) + a pending bill (interpretive/future-facing, hence corroboration sought)
- **Source 1:** KBC Digital, 2026-06-11, tier2 — directly fetched; confirms Treasury CS John Mbadi's exact Ksh 8.6 billion allocation, the KDEAP breakdown, and named prior achievements (1,745 films facilitated, 1,847 filmmakers trained).
- **Source 2:** AllAfrica, 2025-09-23, tier3 — found via search, not independently fetched (fetch not attempted given time constraints; used only to corroborate the separately-reported Creative Economy Bill/Kenya Audio-Visual and Cinema Commission detail, not as the core supporting claim for the budget figure, which Source 1 already establishes directly).
- **A rejected companion story, explicitly not used:** Nairobi County's new per-session filming fees (Ksh 8,000–50,000) — this is a regulatory-friction/compliance story, not a skill-or-practice change a learner would benefit from knowing about; see the rejection log below.
- **Related career slugs:** `graphic-designer-creative-director`, `graphic-designer-creative-technologist`, `journalist-content-creator`, `journalist-media-producer` — four, individually justified by the source's own explicit domain list ("film, music, fashion, arts" + content-creation regulation).

---

## Phase 8.2 rejection log (candidates considered, not used)

| Candidate | Reason rejected |
|---|---|
| Mozilla Foundation / Creatives Garage "Creatives in Kenya Embrace AI" report | **STALE** — discovered mid-research to be from July 2024, not 2026 as it first appeared in search results. Replaced with the fresher, verified Creative Economy Bill / budget signal instead of forcing a graphic-design-specific signal from outdated data. |
| "Africa's Fastest-Growing Companies in 2026" (Blueprint Newspapers) | **TOO_GENERIC / NO_LEARNING_RELEVANCE** — a corporate ranking listicle with no specific skill, tool, or practice change a learner could act on. |
| Nairobi County new content-creator/filmmaker fees (Ksh 8,000–50,000 per session) | **NO_LEARNING_RELEVANCE** — a tax/compliance detail, not a change in what the work involves or what skills matter. |
| "Sakaja Clarifies Nairobi Film Charges" follow-up story | **CORPORATE_GOSSIP-adjacent / POLITICAL_NOISE** — a clarification/dispute story about the fee policy above, not educationally substantive. |
| Individual named fintech companies (Tala, Branch International, etc.) from the fintech search | **TOO_SPECIFIC / not generalizable** — company profiles, not a market-level or regulatory development; the aggregate CBK/inclusion statistics were used instead. |
| "Technology on Snow and Ice" — Milano Cortina 2026 Winter Olympics sports-tech article | **NO_LEARNING_RELEVANCE for this audience** — genuine sports-technology content, but winter-sports-specific with no plausible Kenyan pathway relevance; the Kenya Academy of Sports / Kenyatta University sources were used instead. |

## Known limitations / gaps surfaced during curation

- **No TVET-specific career slugs exist** in the current 18-slug seed corpus (`lib/career/seedCareers.ts`) — the TVET/ICT-Academy angle of signal #4 was mapped to `software-engineer` (the closest existing slug) rather than a dedicated "ICT technician"/TVET-route career, because none exists yet. This is a Career-taxonomy gap, not a Career Signals bug — documented here per Phase 8.1 §14, not acted on (expanding the Career corpus is explicitly out of scope for this phase).
- **No Kenya-specific health-technology signal was found** with sufficiently verifiable sourcing in this research pass — `medical-doctor`'s signal is GLOBAL. A Kenya-specific digital-health signal (e.g. community health worker digitization, referenced hypothetically in the Phase 8 audit's sample signals) would need a real, fetchable Tier 1/2 Kenyan source before it could be added; none was verified here.
- **The corpus currently has 4 KENYA + 1 GLOBAL signals**, exceeding Phase 8.1 §38's "at least 2 Kenya-specific" floor — reflects genuinely stronger, more fetchable Kenyan institutional sourcing this pass, not a quota being forced.
