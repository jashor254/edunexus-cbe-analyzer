# Reference School — Module 9: Communication

Status: **FROZEN**. Architecture Approved · Business Scope Approved ·
Communication Domain Approved. No structural changes except bug fixes or
explicitly approved architectural revisions. Future modules must treat
this document as a stable dependency.

Depends on: [[01-school-profile-and-structure]] (frozen — School
Secretary/Receptionist roles, Principal approval authority for external
communication), [[02-academic-structure]] (frozen — classes/grade levels
as announcement targeting scope), [[03-students]] (frozen — guardians and
their communication preferences/legal-guardian consent flag, explicitly
deferred to this module), [[06-attendance-and-discipline]] (frozen —
permission requests, a communication-adjacent workflow already owned
there and referenced, not redefined, here).

## Purpose

Module 9 owns outbound and inbound communication: announcements,
circulars, direct messages between staff/parents/students, notifications,
and emergency alerts. It resolves Module 3's explicit deferral of "what
requires legal-guardian consent." It does not own the underlying data
being communicated about (attendance, marks, fees) — it owns the channel
and delivery record, referencing those modules' data rather than
duplicating it.

---

## 1. Announcements & Circulars

- An **Announcement** targets an audience scope: whole school, one Grade
  Level, one Class, one Department's staff, or all parents/guardians
  (Module 2/3 entities referenced, not redefined).
- A **Circular** is a formal, typically signed, announcement variant
  (matches Module 1's School Secretary responsibility for "drafting
  circulars") — same underlying delivery mechanism as Announcements, with
  an additional `requires_acknowledgement: boolean` for circulars parents
  must confirm reading (e.g. policy changes).
- **External communication** (anything leaving the school, e.g. to media
  or other institutions) requires Principal approval per Module 1's
  explicit authority — modeled as an `approval_status` on the
  Announcement record for that audience scope, not a separate entity.

## 2. Direct Messages

- **Parent↔Teacher messages** and **Teacher↔Teacher messages** are scoped
  threads, not a general inbox — a thread is created in the context of a
  specific student (parent↔class teacher/subject teacher) or a specific
  department/class (teacher↔teacher), so messages are always
  discoverable from the relevant record rather than floating free.
- Messages are retained indefinitely (no deletion) as part of the
  student's or staff member's communication record — consistent with
  every prior module's non-destructive philosophy.

## 3. Notifications

- A **Notification** is a system-generated, single-recipient alert
  (distinct from a broadcast Announcement) — e.g. "your child was marked
  absent today" (Module 6), "invoice due" (Module 8), "exam results
  published" (Module 7). This module owns the notification *delivery*
  record (sent, read, channel used); it does not own or duplicate the
  underlying fact being notified about.
- **Channel** is SMS, email, or in-app, chosen per the recipient's stored
  preference (Module 3's Guardian `communication_preferences`, read here,
  not redefined).

## 4. Emergency Alerts

- A distinct, higher-priority Announcement subtype: bypasses normal
  per-channel opt-in preferences (an emergency alert goes out on every
  channel a guardian has on file, regardless of their normal preference
  setting) and requires Principal or DP Administration authorization to
  send, matching Module 1's escalation pattern for emergencies (e.g. the
  School Nurse's "escalates to Principal for hospital referral" authority
  chain).

## 5. Consent (resolves Module 3's deferral)

- Module 3 flagged `is_legal_guardian` as mattering for "consent-requiring
  actions" without defining which actions those are. This module defines
  the first concrete instance: a **Consent Request** (e.g. trip
  permission, media/photo consent, external assessment participation) is
  sent only to guardians flagged `is_legal_guardian: true` for that
  student, and requires an explicit response (`approved` / `declined`)
  before the underlying action (owned by whichever module triggered the
  request) may proceed.
- **Edge case — no legal guardian on file:** if a student has zero
  guardians flagged `is_legal_guardian` (possible per Module 3's "student
  with no guardian temporarily" edge case), the Consent Request is flagged
  `unresolvable` and escalated to Guidance & Counselling (Module 6) for
  manual follow-up, rather than silently blocking or silently proceeding.

---

## 6. Edge Cases

- **Guardian opts out of a channel entirely:** honored for Announcements/
  Notifications (Section 3), but not for Emergency Alerts (Section 4) —
  the one deliberate override of stated preference in this module.
- **Message sent to a transferred/withdrawn student's guardian:** Module
  3 never deletes student or guardian records, so historical threads
  remain fully readable; new messages to a transferred student's guardian
  are still permitted (e.g. finalizing paperwork) but the system surfaces
  the student's current status inline so staff aren't confused about
  active enrollment.
- **Circular acknowledgement non-response:** tracked as `pending`
  indefinitely rather than auto-expiring — a School Secretary/Class
  Teacher view can filter for outstanding acknowledgements, but this
  module doesn't invent an escalation timer on its own.
- **Duplicate consent requests for the same event:** if triggered twice by
  the same upstream action (e.g. a retry), the second request supersedes
  the first (references it, doesn't create a parallel decision path) so a
  guardian never has to resolve the same consent twice.

---

## 7. Module Boundaries

**In scope:** Announcements, circulars (with acknowledgement tracking),
parent↔teacher and teacher↔teacher messaging, system-generated
notifications (delivery record only), emergency alerts, consent requests
(definition and workflow, resolving Module 3's deferral).

**Explicitly out of scope:** The underlying facts being communicated
about (attendance, marks, fees, discipline — each owned by its respective
module), SMS/email provider integration details (an implementation
concern, not architectural), any AI-drafted or AI-summarized
communication (Module 12).

**Data ownership:** Module 9 owns `announcements`, `circulars`,
`circular_acknowledgements`, `message_threads`, `messages`,
`notifications`, `emergency_alerts`, `consent_requests`. It references
(never redefines) Module 3's guardians/communication preferences/
legal-guardian flag, and reads (without owning) the underlying records
from Modules 6, 7, and 8 that trigger notifications.

---

## Module 9 Freeze Record

**Checkpoint 1 — Business rules complete:** Announcements/circulars,
messaging, notifications, emergency alerts, and consent requests are each
fully specified (Sections 1–5).

**Checkpoint 2 — Ownership clear:** Section 7 states what Module 9 owns
(the channel/delivery record) vs. references (the underlying data from
other modules) — no duplication of facts owned elsewhere.

**Checkpoint 3 — Edge cases documented:** Channel opt-out vs. emergency
override, messaging a transferred student's guardian, non-responding
circulars, and duplicate consent requests are each resolved with a
concrete mechanism (Section 6).

**Checkpoint 4 — Module boundaries respected:** No attendance, assessment,
finance, or AI-generation logic appears in this document; each is named
and deferred to its owning module. Module 3's consent-flag deferral is
resolved without unfreezing Module 3.

**Result: Module 9 Frozen.**
Architecture Approved · Business Scope Approved · Communication Domain
Approved · Ready for Freeze · **Module Frozen.**

Proceeding to Module 10 — Career Services.
