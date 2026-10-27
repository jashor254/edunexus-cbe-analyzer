# Privacy Policy — Revision DRAFT (PENDING VERIFICATION)

**Date:** 2026-10-17
**Status:** ⚠ DRAFT — NOT to be published as-is. Corrections marked ✅ are supported by repository evidence and can be published now. Items marked 🔶 require the owner to confirm a fact (Supabase region, vendor DPAs, model-training terms, ODPC) BEFORE the wording is published — do not publish a 🔶 as a definitive public statement. The live page (`app/(marketing)/legal/privacy/page.tsx`) was intentionally NOT edited in this pass.

This draft fixes only what the code verifiably contradicts. It does not remove any existing commitment — where a commitment is currently untrue, the fix is to make the wording accurate, and the owner then makes the underlying fact true (contract/DPA/region).

## §7 AI & Your Data — REPLACE the provider description

**Current (contradicted by code):** "EduNexus uses DeepSeek AI (accessed via Together AI)… United States."

✅ **Draft replacement:**
> EduNexus uses two external AI providers to power its AI features:
> - **DeepSeek** (`api.deepseek.com`) — used for most text generation (essay feedback, lesson/scheme content, career and holiday reports, study-group challenges). DeepSeek processes data on infrastructure located in the People's Republic of China. 🔶(confirm DeepSeek tier + whether a data-processing/zero-retention agreement is in place).
> - **Google Gemini** (Google AI / `generativelanguage.googleapis.com`) — used for the Learning Compass tutoring responses and for marking photographed exam scripts. Google processes this data in the United States / Google's global infrastructure. 🔶(confirm paid/no-training tier).
>
> Together AI is **not** used.

## §7 — AI Data Commitments — QUALIFY the training claim

**Current:** "Your data is NOT used to train DeepSeek or any external AI model."

**Update (owner confirmed both providers are on PAID tiers, 2026-10-17):**
- ✅ **Gemini (paid):** Google's paid API terms exclude using prompts to train models — the claim holds for Gemini. Retain the terms as evidence.
- 🔶 **DeepSeek (paid):** paid tier is confirmed, but "paid" does not by itself prove DeepSeek does not retain or train on inputs — confirm DeepSeek's written API retention/training terms before stating this for DeepSeek. Until then, soften to: "We use paid provider tiers chosen to prevent your data being used to train their models; see our processors list for each provider."

## §7 — ADD missing AI disclosure (script images)

✅ **Draft addition:**
> When a teacher uses Paper Intelligence to mark photographed exam scripts, the page images are sent to Google Gemini for reading and marking. We strip location/device metadata (EXIF) from these images before they are sent, but the images themselves — including any name a learner has written on the page — are processed by the provider. A teacher reviews every AI-proposed mark; the AI never assigns a final mark.

## §8 Data Sharing — Processors table — CORRECT and ADD rows

✅ Replace the "Together AI — United States" row with **DeepSeek — China** and **Google Gemini — United States**.
✅ Add a **Resend** row:
> | Resend | Transactional email (parent report delivery) | Parent email, student name, report PDF | United States |

(Verified: `lib/resend-client.ts`, `lib/email/reportEmail.ts`.)

## §9 International Transfers — ADD China, ADD US-Gemini, FIX Supabase

✅ Add a **China (DeepSeek)** entry: no Kenya–China adequacy; safeguard = 🔶 DPA/contractual clauses (confirm one exists).
✅ Add **Google Gemini** and **Resend** to the US entry.
✅ **Supabase region:** owner-confirmed **eu-north-1 (Stockholm, EU)** on 2026-10-17. The GDPR-adequacy basis holds. **Correction:** change "Frankfurt / Germany" to "Stockholm, Sweden (EU)" in §8 and §9 so the stated city is accurate.

## Items that are NOT code-fixable (operational/legal — see vendor register)
- 🔶 "DPA in place" claims for each processor — execute real DPAs.
- 🔶 ODPC registration of Jashor Technologies — confirm/obtain.
- 🔶 72-hour breach notice, quarterly audits — operational commitments; ensure a process exists.

## Reply-to hygiene (not policy text, but noted)
`lib/resend-client.ts` sets `EMAIL_REPLY_TO = 'kariukidennis092@gmail.com'` (personal Gmail) for a data-controller communication channel. Replace with a controlled `support@edunexus.co.ke` mailbox.

---

## 2026-10-21 UPDATE — supersedes the provider wording above where they conflict

Source: `docs/audits/compass-privacy-reaudit-2026-10-21.md`. Provider documents fetched 2026-10-21 (Gemini API Terms "last updated 2026-04-28"; DeepSeek Privacy Policy "Last Update Feb 10, 2026"; DeepSeek Open Platform Terms "effective April 29, 2026"). **Draft for Dennis + qualified Kenyan privacy counsel — not legal advice, not to be published as-is.**

**Publish only wording that matches the DEPLOYED code at publication time.** Paragraphs marked ⏳ become true only after the Compass privacy release is deployed and verified; until then use the "today" variant.

### §7 AI & Your Data — Learning Compass (replace)

> The Learning Compass tutor uses **Google Gemini** to generate replies. If Gemini is unavailable, the same request may instead be sent to **DeepSeek** (`api.deepseek.com`).
> ⏳ Before a tutoring message leaves our systems, we remove the learner's own name (first name, surname and middle names as stored in their profile) from it and from the information we include about the learner; the provider sees a placeholder, and we put the name back on our side. **This is not anonymisation.** The learner's message, the subject and topic, their grade and learning level, and a short summary of earlier sessions are still sent, because the tutor needs them — and anything else a learner types (for example a classmate's or school's name) is sent as written.
> *Today variant (until deployed):* The learner's first name and the information above are sent to the provider so the tutor can address the learner and adapt to their level.

### §7 — AI Data Commitments (qualify)

- Remove "anonymised" everywhere it describes AI processing.
- **Gemini:** keep "not used to train Google's models" **only if** the API key is confirmed on a paid (billing-enabled) account — Gemini terms: for Paid Services Google "doesn't use your prompts or responses to improve our products", but "logs prompts and responses for a limited period of time" for abuse detection (period not stated), and data "may be stored transiently or cached in any country in which Google or its agents maintain facilities". Say that, rather than implying no retention.
- **DeepSeek:** do **not** state that data is not used for training or not retained. DeepSeek's privacy policy says it collects, processes and stores personal data in the People's Republic of China and lists training as a purpose (with an opt-out right); its scope excludes data from developers' downstream apps, and the Open Platform Terms are silent on retention/training and governed by PRC law. Until a written API data-processing commitment exists, describe DeepSeek as "a provider based in China whose terms we are still confirming" — or stop using it for learner data (see decisions).

### §8 Processors (correct the rows)

| Processor | Purpose | Learner data involved | Location (as documented) |
|-----------|---------|-----------------------|--------------------------|
| Google (Gemini API) | Compass replies; Paper Intelligence script reading | Tutoring text (name removed ⏳), script images | Google facilities, any country (per Google's terms) |
| DeepSeek | Compass fallback; essay feedback and other text features | Tutoring text (name removed ⏳); essays | People's Republic of China (per DeepSeek's policy) |
| Vercel | Hosting; server functions | All request data in transit | Functions in Washington DC, USA (`iad1`); CDN global |
| Supabase | Database | All stored data | EU — Stockholm (owner-confirmed 2026-10-17) |
| Resend | Email | Parent email, learner name, report PDF | United States |

### §9 International transfers

Add China (DeepSeek) and "any country where Google operates" (Gemini); keep USA (Vercel, Resend); EU (Supabase). State the safeguard relied on for each — currently **unconfirmed** for DeepSeek and to be confirmed for Google and Vercel (DPAs).

### §X Logs (add)

> ⏳ Our AI-usage log records only operational details (feature, model, timing, size, success); it does not store the text of prompts or replies. Tutoring conversations are stored in our database as part of the learner's record, under the retention described in §N.

### NOT policy wording — decisions/legal questions this raises

1. **Gemini API Terms, "Age Requirements":** "You also will not use the Services as part of a website, application, or other service that is directed towards or is likely to be accessed by individuals under the age of 18." Compass is used by Grade 7–12 learners. This is a contractual question for Google/counsel (e.g. whether a different Google offering or agreement applies), not something a policy edit can resolve.
2. Lawful basis and parental consent for processing children's data (Kenya DPA 2019 s.33), and how consent is captured in-product.
3. Transfer safeguards for China and the US (DPA 2019 ss.48–50; Data Protection (General) Regulations).
4. ODPC registration status; whether a DPIA is required for AI tutoring of minors.
5. Retention period for `compass_messages` / session summaries.
