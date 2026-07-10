# Reference School — Module 8: Finance

Status: **FROZEN**. Architecture Approved · Business Scope Approved ·
Finance Domain Approved. No structural changes except bug fixes or
explicitly approved architectural revisions. Future modules must treat
this document as a stable dependency.

Depends on: [[01-school-profile-and-structure]] (frozen — Finance Officer,
DP Administration approval authority), [[02-academic-structure]] (frozen —
academic years/terms, grade levels for fee-structure scoping),
[[03-students]] (frozen — students, guardians as fee payers), [[04-teachers-and-staff]]
(frozen — staff/employment_type as the payroll linkage point only).

## Purpose

Module 8 owns school fee finance: fee structures, invoicing, payments,
scholarships/waivers, balances, receipts, and basic expense recording. It
owns the *school-fee* side of finance completely; it deliberately does
**not** own payroll computation (staff salaries) — it only exposes the
data point payroll needs (`staff.employment_type`, `staff.tsc_number`) so
an external/future payroll system can consume it, since running payroll is
outside a school-fee-focused Reference School's core operating loop.

---

## 1. Fee Structures

- A **Fee Structure** is scoped to Academic Year + Grade Level (Module 2)
  — fees can differ by grade (e.g. Grade 12 carries exam-registration
  costs Grade 10 doesn't) and by boarding status (Module 3's
  `boarding_status`).
- Composed of **Fee Items** — tuition, boarding, transport, activity fee,
  exam fee, each with an amount and a `term_id` (some items are termly,
  some annual — modeled per-item, not assumed uniform).
- **Edge case — mid-year fee structure revision:** a Fee Structure is
  versioned per Academic Year like Module 2's Curriculum Policy; students
  already invoiced under the prior version aren't retroactively
  reinvoiced when the structure changes.

## 2. Invoices

- One **Invoice** per student per term, generated from the active Fee
  Structure for that student's Grade Level + boarding status at the start
  of the term.
- **Edge case — mid-term admission:** a mid-term admission (Module 3)
  generates a pro-rated Invoice rather than the full-term amount — the
  proration rule is a Fee Structure property (per-item proratable flag),
  not a special case hardcoded into invoice generation.
- **Edge case — mid-term boarding status change:** if a day scholar
  becomes a boarder mid-term (or vice versa), a supplementary/adjustment
  Invoice line is generated rather than editing the original invoice
  amount, preserving what was actually billed at the time.

## 3. Payments

- A **Payment** references an Invoice (or is unallocated pending manual
  allocation, for the common real-world case of a payment arriving before
  its invoice is confirmed), amount, method (cash, bank transfer, mobile
  money, Paystack — reusing the platform's existing Paystack integration
  per CLAUDE.md's payments rules, if online payment is offered to
  parents), payer (a Guardian, Module 3), and date.
- **Idempotency:** any webhook-driven payment confirmation (e.g. Paystack)
  must check for an existing transaction reference before recording a new
  Payment — carried over directly from CLAUDE.md's platform-wide payments
  rule, not a new invention for this module.
- Payments accumulate against an Invoice; **Balance** is a computed value
  (Invoice total − sum of allocated Payments), not a separately
  hand-maintained field.

## 4. Receipts

- A **Receipt** is generated automatically for every recorded Payment —
  immutable once issued (a correction produces a new, cross-referenced
  receipt with a `void` flag on the original, never an edit-in-place,
  consistent with every other module's append-only pattern).

## 5. Scholarships & Waivers

- A **Scholarship** or **Waiver** reduces a student's Invoice total by a
  fixed amount or percentage, requires DP Administration approval (per
  Module 1's role definition) above a Finance-Officer-approvable
  threshold, and is recorded with a reason and approver — never as a
  silent discount applied at payment time.
- **Edge case — scholarship spanning multiple terms/years:** modeled as a
  recurring Scholarship record (with a validity range) that generates a
  waiver line on each qualifying term's Invoice automatically, rather than
  requiring manual reapplication every term.

## 6. Fee Defaulters

- A student is a **defaulter** when their Balance (Section 3) exceeds a
  configurable threshold past a configurable grace period after the
  invoice due date — both threshold and grace period are Finance
  configuration values (mirroring Module 2's Curriculum Policy
  configurability principle), not hardcoded.
- Defaulter status surfaces as a `student_flag` (Module 3's flag
  mechanism, reused rather than reinvented, same pattern Module 6 used for
  attendance thresholds) — this module produces the signal, DP
  Administration/Finance Officer act on it.
- **Explicit non-goal:** this module does not withhold academic services
  (exam sitting, report release) based on defaulter status automatically —
  that policy decision, if the school wants it, belongs to whichever
  module owns the affected service (e.g. Module 7's exam-sitting decision)
  reading this module's flag, not this module enforcing it unilaterally.

## 7. Expenses

- Basic **Expense** recording: category, amount, date, approver, receipt/
  invoice reference — administrative record-keeping for the DP
  Administration's operational oversight (Module 1's role). Full expense
  workflow (procurement, budget allocation, multi-level approval chains)
  is out of scope — this is the smallest correct slice, not a
  procurement system.

## 8. Payroll Integration Point

- Module 8 does **not** compute or run payroll. It exposes
  `staff.employment_type` and `staff.tsc_number` (Module 4) as the data an
  external/future payroll process needs to distinguish TSC-paid vs.
  BoM-paid staff. No salary, payslip, or deduction data is modeled here.

---

## 9. Edge Cases

- **Duplicate payment (parent pays twice):** the second Payment is
  recorded as-is (never discarded) and surfaces as a credit balance on the
  student's account, refundable or applicable to the next term's Invoice
  — not silently dropped or auto-refunded.
- **Payment for a student who has since transferred/withdrawn:** still
  recorded against their Invoice history (Module 3's student record is
  never deleted, so the Invoice's `student_id` FK remains valid); any
  resulting credit balance is a manual refund workflow, not automated.
- **Invoice dispute:** a guardian disputing an invoiced amount is recorded
  as a Finance Note (mirroring Module 3's Student Notes pattern) rather
  than mutating the Invoice — resolution, if it changes the amount, is a
  new adjustment line, not an edit to the original.

---

## 10. Module Boundaries

**In scope:** Fee structures, invoices (including proration/adjustment),
payments (with idempotent webhook handling), receipts, scholarships/
waivers, defaulter flagging, basic expense recording, the payroll data
exposure point.

**Explicitly out of scope:** Payroll computation/payslips, procurement/
budgeting workflows, automatic service withholding based on defaulter
status (policy decision left to the consuming module), financial
forecasting/predictive analytics (Module 11/12).

**Data ownership:** Module 8 owns `fee_structures`, `fee_items`,
`invoices`, `invoice_lines`, `payments`, `receipts`, `scholarships`,
`waivers`, `expenses`, `finance_notes`. It references (never redefines)
Module 2's academic years/terms/grade levels, Module 3's students/
guardians (and reuses its flag mechanism), and Module 4's staff
employment fields (read-only, for the payroll integration point only).

---

## Module 8 Freeze Record

**Checkpoint 1 — Business rules complete:** Fee structures, invoicing,
payments, receipts, scholarships/waivers, defaulter flagging, and expenses
are each fully specified (Sections 1–8).

**Checkpoint 2 — Ownership clear:** Section 10 states what Module 8 owns
vs. references; payroll is explicitly exposed as a read-only integration
point, not owned, keeping this module scoped to school-fee finance.

**Checkpoint 3 — Edge cases documented:** Mid-term admission proration,
boarding status change, duplicate payment, payment after transfer, and
invoice disputes are each resolved with a concrete mechanism (Sections 2,
9).

**Checkpoint 4 — Module boundaries respected:** No payroll computation,
procurement workflow, or predictive/intelligence logic appears in this
document; each is named and deferred appropriately. Reuses CLAUDE.md's
existing payment-idempotency rule rather than reinventing it.

**Result: Module 8 Frozen.**
Architecture Approved · Business Scope Approved · Finance Domain Approved
· Ready for Freeze · **Module Frozen.**

Proceeding to Module 9 — Communication.
