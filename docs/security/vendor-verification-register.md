# Vendor Verification Register

**Date:** 2026-10-17
**Purpose:** Separate *code-verified* facts from vendor/contract/legal facts that only the owner can confirm. **Nothing here is a verified contract unless the "Evidence" column cites one.** Do not publish any row as a definitive public statement until its evidence column is filled.

Classification per cell: **[CODE]** proven from repo · **[VENDOR-DOC]** needs current vendor documentation · **[DASHBOARD]** needs account/console access · **[CONTRACT]** needs signed agreement · **[LEGAL]** needs qualified advice.

| Vendor | Actual endpoint | Data categories | Processing/storage location | Training/retention terms | Transfer safeguard | Owner action required | Evidence held |
|---|---|---|---|---|---|---|---|
| **DeepSeek** | `https://api.deepseek.com` **[CODE]** | Learner essays, reflections, Compass chat (name now tokenized post-B2), grade/pathway | **PRC** `[VENDOR-DOC]` | **PAID tier confirmed by owner 2026-10-17.** NB: paid ≠ automatically no-training/no-retention for DeepSeek — still verify DeepSeek's API terms on input retention & training 🔶 | None in place **[CONTRACT]** | Confirm DeepSeek's written retention/training terms for the paid API + obtain a DPA; China hosting itself is a controller-risk decision for children's data regardless of training | Owner: paid tier (2026-10-17) |
| **Google Gemini** | `generativelanguage.googleapis.com` (SDK) **[CODE]** | Compass chat (name tokenized post-B2), script **images**, fallback for all text features | US/global `[VENDOR-DOC]` | **PAID tier confirmed by owner 2026-10-17** → Google's paid API terms exclude training on prompts. Retain the terms as evidence 🔶 | Google Cloud terms / SCCs **[CONTRACT]** | Obtain/retain Google Cloud DPA + SCCs; keep paid-tier terms on file | Owner: paid tier (2026-10-17) |
| **Together AI** | *not used* **[CODE]** | — | — | — | — | Remove from policy (it processes nothing) | N/A |
| **Supabase** | `lpxrfbmzncaztpmyqzkc.supabase.co` **[CODE]** | All user + learner records, auth, storage (script images) | **eu-north-1 (Stockholm, EU)** — owner-confirmed 2026-10-17 (dashboard). GDPR-protected. NB: policy text says "Frankfurt" — correct city to Stockholm. | Supabase DPA (standard) **[VENDOR-DOC]** | GDPR adequacy ✅ (EU region) | Retain Supabase DPA copy | Owner: eu-north-1 (2026-10-17) |
| **Resend** | SDK (`lib/resend-client.ts`) **[CODE]** | Parent email, student name, **report PDF** | US `[VENDOR-DOC]` | Resend terms **[VENDOR-DOC]** | DPA/SCC **[CONTRACT]** | Add to policy; obtain Resend DPA; replace personal-Gmail reply-to with controlled mailbox | None |
| **Meta / WhatsApp** | `graph.facebook.com` **[CODE]** | Parent phone, student name | US `[VENDOR-DOC]` | Meta Cloud API terms **[VENDOR-DOC]** | DPA/SCC **[CONTRACT]** | Confirm WhatsApp Business DPA | None |
| **Paystack** | `api.paystack.co` **[CODE]** | Parent name, email, payment | NG/KE `[VENDOR-DOC]` | PCI + NDPR **[VENDOR-DOC]** | CBK-licensed in KE **[VENDOR-DOC]** | Confirm Paystack DPA; confirm KE licensing current | None |
| **Vercel** | hosting/logs **[CODE]** | Request logs, stdout (may include `ai_call_logs` writes) | Global CDN `[VENDOR-DOC]` | Vercel terms **[VENDOR-DOC]** | DPA/SCC **[CONTRACT]** | Confirm log retention; confirm no learner content in persisted Vercel logs | None |

## ODPC / regulatory
| Item | Status | Owner action |
|---|---|---|
| Jashor Technologies registered with ODPC as Data Controller | `[UNVERIFIED — not in repo]` **[LEGAL]** | Confirm/obtain ODPC registration certificate; likely mandatory given children's sensitive data |
| Data Protection Officer designated | `[UNVERIFIED]` **[LEGAL]** | Designate + publish DPO contact if required |
| DPIA for AI processing of children's data | Not found **[LEGAL]** | Commission a DPIA (DPA 2019 + Data Protection (General) Regulations 2021) |
| Processor DPAs with each vendor above | None held | Execute DPAs before relying on "DPA in place" policy claims |

**Instruction honored:** no agreement, location, registration, or vendor setting is represented as verified. Every such cell carries an explicit owner action.
