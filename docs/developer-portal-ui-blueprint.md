# EduNexus Developer Portal — UI & Product Blueprint

**developers.edunexus.co.ke**

**Version 1.0 — 2026**

---

> *developers.edunexus.co.ke is not documentation about EduNexus. It is the operating system through which developers build on Educational Intelligence.*

---

## Purpose of This Document

This document is the implementation blueprint for the EduNexus Developer Portal. It is addressed to frontend engineers, product designers, and UX engineers who will build the portal. Every screen, navigation flow, interaction, empty state, loading state, and error state is specified here. Implementation begins from this document. No further product clarification is required.

**Stack:** Next.js 16 App Router · React Server Components · Tailwind CSS · shadcn/ui · TanStack Query · Motion · Cytoscape.js · Monaco Editor · React Hook Form · Zod · Fumadocs · OpenAPI · Scalar API Reference

---

# PART I — PRODUCT STRUCTURE

---

## Chapter 1 — Product Vision

### 1.1 Why This Portal Exists

The EduNexus platform is built on educational intelligence: learner models, curriculum graphs, competency engines, assessment frameworks, and AI orchestration layers designed specifically for the Kenya CBC/CBE educational context.

That intelligence is valuable far beyond the core EduNexus product. Schools want to embed learning widgets in their own portals. EdTech startups want to build on top of the CBC Knowledge Graph. Researchers want to query learner progression data. Assessment companies want to integrate CBC-aligned evaluation. Publishers want to push curriculum content into the system.

`developers.edunexus.co.ke` exists to make all of this possible. It is the product surface through which the EduNexus platform becomes a platform — an open, well-documented, well-tooled ecosystem on which other builders construct educational software.

The portal is not a side project. It is a core strategic asset. Every developer who builds successfully on EduNexus expands the educational impact of the platform without requiring EduNexus to build the use case directly.

### 1.2 Who It Serves

**Primary Audience — Builders**

These developers are actively building integrations, plugins, or standalone tools on EduNexus APIs. They need: comprehensive API reference, working code examples, a sandbox to experiment, SDKs that eliminate boilerplate, and a dashboard to monitor their integrations in production.

**Secondary Audience — Evaluators**

These developers are assessing whether EduNexus APIs are capable of powering their use case. They need: a clear capability overview, a working playground to test without commitment, and honest documentation of limits and constraints.

**Tertiary Audience — Learners**

These are developers who want to understand how educational intelligence systems are built. They read the deep documentation, explore the Knowledge Graph, and study the AI APIs. They may or may not build immediately, but they generate community credibility.

### 1.3 Developer Personas

---

**Persona A: The School Tech Lead**

*"Our school has built a custom portal in Laravel. We want to show CBC competency progress inside it."*

- Experience: Full-stack, mid-level, comfortable with REST
- Primary need: REST API for learner data, webhook for real-time updates
- Journey: Home → Quickstart (Embed) → REST API Reference → API Keys → Webhooks
- Time to first value: under 20 minutes
- Friction tolerance: Low — if the first API call fails, they leave

---

**Persona B: The EdTech Startup Engineer**

*"We're building an adaptive quiz app aligned to CBC. We need the Knowledge Graph to tell us what strand a question belongs to and what prerequisite concepts a student needs."*

- Experience: Senior, polyglot, probably Python or Node
- Primary need: Knowledge Graph API, CBC curriculum taxonomy, assessment integration
- Journey: Home → AI Studio → Knowledge Graph Explorer → SDK (Python) → Marketplace
- Time to first value: under 1 hour
- Friction tolerance: Medium — they will invest time if the capability is real

---

**Persona C: The Assessment Platform Engineer**

*"We create national-level assessments. We want to submit question banks to EduNexus and receive CBC alignment scores."*

- Experience: Enterprise, Java or .NET background
- Primary need: OpenAPI spec, robust auth, idempotent endpoints, SLA guarantees
- Journey: Home → API Reference → Authentication → Billing → Status → Certification
- Time to first value: 2-3 days (security review, enterprise procurement)
- Friction tolerance: High — they will do the work if the compliance story is clear

---

**Persona D: The Independent Developer / Maker**

*"I want to build a CBC flashcard app. Is there an API for getting curriculum content?"*

- Experience: Junior to mid, probably mobile or frontend
- Primary need: Simple, well-documented endpoints, generous free tier, good error messages
- Journey: Home → Quickstarts → Playground → SDK → Marketplace (publish)
- Time to first value: under 10 minutes (Playground) / 30 minutes (first app)
- Friction tolerance: Very low — frustration leads to abandonment

---

**Persona E: The AI Researcher**

*"I'm studying educational AI. I want to understand how EduNexus models learner mastery and query the data for research."*

- Experience: PhD-level ML, Python-first
- Primary need: AI Studio, detailed AI API documentation, batch endpoints, export capability
- Journey: Home → AI Studio → Knowledge Graph Explorer → Research APIs → Data Export
- Time to first value: undefined — they explore, not build

---

### 1.4 Primary Developer Journeys

**Journey 1: First API Call (< 15 minutes)**
Home → Sign Up → Dashboard → Create API Key → Playground → First Request → Success

**Journey 2: Embed CBC Progress Widget (< 30 minutes)**
Home → Quickstart (Widget) → NPM Install → Code Example → Test in Browser

**Journey 3: Build with Knowledge Graph (< 2 hours)**
Home → AI Studio → EKG Explorer → Python SDK Install → Query by Strand → Integration Test

**Journey 4: Submit Plugin to Marketplace (< 1 day)**
Dashboard → Plugin Builder → Submit → Review → Certified → Listed

**Journey 5: Go to Production (< 1 week)**
Dashboard → Billing → Pro Plan → Webhooks → Monitoring → Status Page

### 1.5 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first successful API call | < 15 min | Telemetry from Playground |
| Documentation satisfaction | > 4.2 / 5 | Per-page feedback widget |
| SDK weekly downloads | 500+ (Month 3) | npm, PyPI stats |
| Registered developers | 200+ (Month 3) | Dashboard accounts |
| Marketplace plugins | 25+ (Month 6) | Plugin listings |
| Developer NPS | > 45 | Quarterly survey |
| Support ticket rate | < 5% of active devs | Zendesk / Discord |

### 1.6 Core Product Principles

**1. Working code over words.** Every concept is illustrated with a code example that runs. Documentation without code is theory.

**2. Honesty over marketing.** API limits, rate limits, latency characteristics, and known issues are documented clearly. Developers discover them in the portal, not in production.

**3. Progressive disclosure.** The home page serves the beginner. The AI Studio serves the expert. Neither experience is degraded by serving both audiences.

**4. Immediate value.** A developer who has not yet created an account can open the Playground, run an API call against the sandbox, and see a real response. Sign-up is not a prerequisite for value.

**5. Educational context.** EduNexus is an education platform. The developer portal reflects that context. Examples use real CBC subjects, real grade levels, and real competency strand names. This is not a generic API platform.

**6. Consistency.** Every API, every SDK, every code example follows the same patterns. Developers who learn one part of the system can transfer that knowledge immediately.

---

## Chapter 2 — Navigation Architecture

### 2.1 Top Navigation

The top navigation is persistent across all portal pages. It is a single `<header>` element, `height: 60px`, `position: sticky`, `top: 0`, `z-index: 50`.

**Left section:**
- EduNexus logomark (16×16) + wordmark "EduNexus" + pill badge "dev" in `green-500`
- Clicking the logo navigates to `/`

**Center section (hidden on mobile):**
Navigation links — each is a single word or short phrase:

| Label | Route | Behavior |
|-------|-------|----------|
| Docs | `/docs` | Navigate |
| API Reference | `/api-reference` | Navigate |
| SDKs | `/sdks` | Navigate |
| AI Studio | `/ai-studio` | Navigate |
| Marketplace | `/marketplace` | Navigate |
| Changelog | `/changelog` | Navigate |

Active link: `font-medium text-foreground border-b-2 border-primary`
Inactive link: `text-muted-foreground hover:text-foreground`

**Right section:**
- Search icon (`Cmd+K` tooltip on hover) — opens Command Palette
- Theme toggle (sun/moon icon, no label)
- "Sign In" button — `variant="ghost"`
- "Get API Key" button — `variant="default"` with `size="sm"`, `bg-green-600 hover:bg-green-700`

**Authenticated state replaces the right section:**
- Notification bell (badge with unread count when > 0)
- Avatar + dropdown (Profile, Dashboard, API Keys, Settings, Sign Out)
- "Dashboard" button replaces "Get API Key"

### 2.2 Sidebar Navigation

The sidebar exists on: `/docs/**`, `/api-reference/**`, `/sdks/**`, `/ai-studio/**`.

It does NOT exist on: Home, Marketplace, Dashboard, Playground (full-screen), AI Studio canvas view.

**Sidebar anatomy:**
- `width: 260px`, fixed-left on desktop
- Collapsible on tablet: icon-only mode at `width: 56px`
- Hidden on mobile (replaced by bottom sheet trigger)
- `border-r border-border bg-sidebar`

**Docs sidebar structure:**
```
GETTING STARTED
  ↳ Introduction
  ↳ Authentication
  ↳ Your First Request
  ↳ Rate Limits
  ↳ Errors
  ↳ Versioning

CBC EDUCATION CONTEXT
  ↳ Curriculum Overview
  ↳ Grade Levels
  ↳ Competency Strands
  ↳ Assessment Frameworks

CORE APIS
  ↳ Learner API
  ↳ Teacher API
  ↳ Curriculum API
  ↳ Assessment API
  ↳ Intelligence API

AI APIS
  ↳ Lesson Plan Generation
  ↳ Scheme of Work Generation
  ↳ Learner Intelligence
  ↳ Remedial Planning
  ↳ Parent Intelligence

KNOWLEDGE GRAPH
  ↳ Graph Overview
  ↳ Querying the EKG
  ↳ Concept Relationships
  ↳ Traversal Algorithms

EVENTS & WEBHOOKS
  ↳ Event Types
  ↳ Webhook Setup
  ↳ Payload Reference
  ↳ Delivery Guarantees

SDKS
  ↳ JavaScript/TypeScript
  ↳ Python
  ↳ REST (Raw)

GUIDES
  ↳ Building a Progress Widget
  ↳ CBC Alignment Check
  ↳ Embedding the EKG
  ↳ Migrating from v1

REFERENCE
  ↳ CBC Terminology Glossary
  ↳ OpenAPI Spec (Download)
  ↳ Postman Collection
  ↳ Status Page
```

**Section headers:** `text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 mt-4`

**Nav items:** `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground`

**Active item:** `bg-accent text-accent-foreground font-medium`

**Expandable subsections:** Chevron rotates 90° with `Motion` spring animation on open/close. Child items indent `ml-4`.

**Sidebar footer (always visible):**
- "API Status: Operational" badge (green dot + text, links to `/status`)
- "v2.1.0" version badge
- Discord icon link

### 2.3 Breadcrumbs

Breadcrumbs appear on all content pages below the top navigation and above the page title.

Format: `Docs / CBC Education Context / Competency Strands`

- Each segment is a link except the last (current page)
- Separator: `/` in `text-muted-foreground`
- Font: `text-sm text-muted-foreground`
- Current page: `text-foreground`
- On mobile: collapsed to `... / Current Page` with the `...` being a dropdown of the full path

Implementation: The breadcrumb is a React Server Component that reads the current URL and resolves segments against the navigation tree.

### 2.4 Search

Search is the primary navigation for power users.

**Trigger:** Top nav search icon, or `Cmd+K` / `Ctrl+K` anywhere on the page.

**Search Modal:**
- Centered, `max-w-2xl`, appears over a dim backdrop with Motion fade
- Input: large, `text-lg`, auto-focused on open, placeholder "Search docs, API endpoints, guides..."
- Results grouped by type: Pages, API Endpoints, Guides, Changelog
- Each result shows: icon (by type), title, snippet with search term highlighted, breadcrumb path
- Keyboard: `↑` `↓` to navigate, `Enter` to select, `Esc` to close
- Empty state: "No results for [term]. Try the API Reference or browse by category."

**Search is powered by Fumadocs' built-in search** with custom index that includes: docs content, API endpoint names and descriptions, changelog entries, and SDK README content.

**Recent searches:** Stored in `localStorage`, shown below the input when no query is typed. Max 5 recent items.

### 2.5 Footer

The footer appears on all pages except full-screen experiences (Playground, AI Studio canvas, EKG Explorer canvas).

**Layout:** 4-column grid on desktop, 2-column on tablet, 1-column on mobile.

```
Column 1: Brand
  EduNexus Dev
  "Educational Intelligence APIs"
  [Discord] [GitHub] [Twitter/X] [LinkedIn]
  © 2026 EduNexus. All rights reserved.

Column 2: Product
  Documentation
  API Reference
  SDKs
  AI Studio
  Knowledge Graph
  Playground
  Status

Column 3: Community
  Discord Server
  GitHub Discussions
  Changelog
  Roadmap
  RFC Process
  Certification

Column 4: Legal & Support
  Terms of Service
  Privacy Policy
  Data Processing Agreement
  Security Policy
  Support
  Contact
```

**Footer background:** `bg-muted/50 border-t border-border`

### 2.6 Quick Actions

Quick actions are persistent floating shortcuts available on docs pages.

**Location:** Bottom-right corner of the viewport, `position: fixed`, `bottom: 24px`, `right: 24px`

**Stack (bottom to top):**
1. "Open in Playground" — only on API endpoint pages; icon: `<Play />`
2. "Copy page link" — icon: `<Link />`
3. "Edit on GitHub" — icon: `<GitBranch />`
4. "Back to top" — appears after scrolling 400px; icon: `<ArrowUp />`

Each is an icon-only button (`size: 40px`, `rounded-full`, `shadow-md`) with a tooltip on hover. They stack vertically with `gap: 8px`.

### 2.7 Mobile Navigation

On screens `< 768px`:

- **Top navigation:** Logo on left, search icon + menu hamburger on right. All nav links hidden.
- **Hamburger → Bottom Sheet:** Opens a full-screen overlay with the complete navigation tree. Smooth slide-up with Motion. Close button top-right.
- **Sidebar (docs):** Hidden. Replaced by a "Contents" bottom bar that slides up to reveal the sidebar nav. Triggered by a pill button at the bottom of the screen: "Contents ↑"
- **Bottom navigation bar** (authenticated users): Tab bar with 4 items: Home, Docs, Dashboard, Menu. `height: 56px`, `position: fixed`, `bottom: 0`.

### 2.8 Keyboard Shortcuts

The following keyboard shortcuts are active globally:

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open search / command palette |
| `Cmd/Ctrl + /` | Open keyboard shortcuts help overlay |
| `G then H` | Go to Home |
| `G then D` | Go to Docs |
| `G then A` | Go to API Reference |
| `G then P` | Go to Playground |
| `G then S` | Go to AI Studio |
| `G then M` | Go to Marketplace |
| `Esc` | Close any modal/drawer |
| `?` | Open shortcuts help (same as `Cmd+/`) |

Shortcuts are implemented via a global `useKeyboardShortcuts` hook with a `keydown` event listener at the document level. The shortcut map is the single source of truth for both functionality and the help overlay.

### 2.9 Command Palette

The command palette is the power-user interface. It opens with `Cmd+K` and provides unified access to navigation, actions, and search.

**Visual:** Full-screen backdrop `bg-background/80 backdrop-blur-sm`. Palette card centered, `max-w-xl`, `rounded-xl`, `shadow-2xl`, `border border-border`.

**Input:** `placeholder="Type a command or search..."` — `text-lg`, `h-14`, `px-4`.

**Sections (shown with no input):**

```
RECENT PAGES
  → [last 5 pages visited, from localStorage]

QUICK ACTIONS
  → Open Playground
  → Create API Key
  → View Usage Dashboard
  → Open AI Studio

NAVIGATION
  → Docs Home
  → API Reference
  → SDKs
  → Knowledge Graph Explorer
  → Marketplace
  → Changelog
  → Status Page

SETTINGS
  → Toggle Dark Mode
  → View Keyboard Shortcuts
  → Sign Out
```

**Sections (with input query):** Results from full-text search + command match. Commands are matched by keyword: "create key" matches "Create API Key," "dark" matches "Toggle Dark Mode."

Each item: `flex items-center gap-3 px-3 py-2.5 rounded-md`. Left icon, label, right-side keyboard hint (`text-xs text-muted-foreground bg-muted px-1.5 rounded`).

---

## Chapter 3 — Information Architecture

### 3.1 Complete Page Map

```
/ (Home)
/docs
  /docs/introduction
  /docs/authentication
  /docs/your-first-request
  /docs/rate-limits
  /docs/errors
  /docs/versioning
  /docs/cbc-overview
  /docs/grade-levels
  /docs/competency-strands
  /docs/assessment-frameworks
  /docs/learner-api
  /docs/teacher-api
  /docs/curriculum-api
  /docs/assessment-api
  /docs/intelligence-api
  /docs/ai-apis/lesson-plan
  /docs/ai-apis/scheme-of-work
  /docs/ai-apis/learner-intelligence
  /docs/ai-apis/remedial-planning
  /docs/ai-apis/parent-intelligence
  /docs/knowledge-graph/overview
  /docs/knowledge-graph/querying
  /docs/knowledge-graph/relationships
  /docs/knowledge-graph/traversal
  /docs/events/types
  /docs/events/webhooks
  /docs/events/payload-reference
  /docs/events/delivery
  /docs/sdks/javascript
  /docs/sdks/python
  /docs/sdks/rest
  /docs/guides/progress-widget
  /docs/guides/cbc-alignment
  /docs/guides/embedding-ekg
  /docs/guides/migrating-v1
  /docs/reference/glossary
/api-reference
  /api-reference/[endpoint] (Scalar-powered)
/sdks
  /sdks/javascript
  /sdks/python
  /sdks/rest
/ai-studio
/ekg-explorer
/playground
/cli
/marketplace
  /marketplace/[category]
  /marketplace/[plugin-slug]
/certification
  /certification/tracks
  /certification/[track-slug]
  /certification/verify/[id]
/dashboard (auth required)
  /dashboard/overview
  /dashboard/api-keys
  /dashboard/projects
  /dashboard/usage
  /dashboard/logs
  /dashboard/webhooks
  /dashboard/marketplace/my-plugins
  /dashboard/billing
  /dashboard/settings
  /dashboard/team
/status
/changelog
/changelog/[version]
/roadmap
/rfcs
  /rfcs/[rfc-slug]
/community
/sign-in
/sign-up
/forgot-password
/onboarding (post-signup flow)
```

### 3.2 Page Purpose Registry

| Page | Purpose | Primary CTA |
|------|---------|-------------|
| `/` | Inspire + convert first-time visitors | "Get API Key" |
| `/docs` | Entry point for documentation | "Start with Introduction" |
| `/api-reference` | Authoritative API reference with try-it | "Try it now" per endpoint |
| `/sdks` | SDK download, installation, and getting started | "Install" per SDK |
| `/ai-studio` | Interactive AI API workbench | "Run" |
| `/ekg-explorer` | Visual Knowledge Graph browser | "Explore" |
| `/playground` | Unauthenticated API sandbox | "Run Request" |
| `/cli` | CLI documentation and download | "Install CLI" |
| `/marketplace` | Browse and publish integrations | "Submit Plugin" |
| `/certification` | Certification programs | "Start Track" |
| `/dashboard` | Monitor usage, manage keys, view logs | — |
| `/status` | Real-time platform health | — |
| `/changelog` | Platform change history | — |
| `/roadmap` | Upcoming features | "Vote" / "Subscribe" |
| `/rfcs` | Open design proposals | "Comment" |
| `/community` | Discord, forums, events | "Join Discord" |

---

# PART II — SCREEN DESIGN

---

## Chapter 4 — Home Page (`/`)

### 4.1 Hero Section

**Layout:** Full-width, `min-height: 100vh`, centered content with vertical padding `py-24`.

**Background:** Animated gradient mesh — subtle, slow-moving. `from-background via-green-950/20 to-background`. Motion: uses `motion.div` with slow repeating keyframes on background-position. This is decorative; `prefers-reduced-motion` disables the animation and shows a static gradient.

**Content (centered, `max-w-3xl`):**

```
[Pill badge] "Now in Public Beta · Join 200+ developers →"
(pill: bg-green-500/10 text-green-400 border border-green-500/30, links to /changelog)

[H1] "Build on Educational Intelligence."
(font-size: 72px, font-weight: 800, tracking-tight, leading-none)
(gradient text: from-foreground to-foreground/60)

[Subtitle paragraph]
"EduNexus APIs give you access to the CBC Knowledge Graph, learner intelligence
 models, and AI lesson generation — built for Kenya's education system."
(text-xl text-muted-foreground max-w-xl mx-auto)

[CTA row, gap-4, justify-center]
  "Get API Key" → /sign-up (primary, size=lg, bg-green-600)
  "Explore the Playground" → /playground (outline, size=lg)
```

**Below CTAs — trust strip:**
`text-sm text-muted-foreground` + icons:
- ✓ Free to start · No credit card
- ✓ CBC-aligned curriculum data
- ✓ TypeScript + Python SDKs

### 4.2 Live Code Demo

**This is the single most important section on the page.** It demonstrates value without sign-up.

**Layout:** Two-column on desktop (`grid-cols-2 gap-8`), single column on mobile.

**Left column — Code editor panel:**
- Monaco Editor instance, `height: 400px`, read-only=false (users can edit!)
- Syntax highlighting: TypeScript
- Pre-loaded code:

```typescript
import { EduNexus } from '@edunexus/sdk'

const client = new EduNexus({
  apiKey: 'demo_key_public_sandbox'
})

// Get Grade 8 Math competency strands
const strands = await client.curriculum.getStrands({
  grade: 8,
  subject: 'Mathematics',
  curriculum: 'CBC'
})

console.log(strands)
```

- Tab bar above editor: `TypeScript` | `Python` | `curl` — switching changes the code in the editor
- "Run" button top-right of the editor panel: green, `<Play />` icon + "Run"

**Right column — Output panel:**
- Initially shows: animated pulse skeleton (three lines, grey)
- After "Run" clicked: streams the JSON response in with a typewriter effect using Motion
- Output is syntax-highlighted JSON
- Displays: response time badge (`142ms`), HTTP status badge (`200 OK`), response size (`3.2 KB`)
- "Open in Playground →" link below the output

**When user edits the code** and hits Run, the demo calls the actual sandbox API. This is not mocked. The sandbox is rate-limited but real.

**Below the demo:**
`text-sm text-muted-foreground text-center`
"No API key required. Running against the public sandbox."

### 4.3 API Status Strip

A narrow horizontal strip below the hero section.

**Layout:** `bg-muted/50 border-y border-border py-3 px-4`

```
● All systems operational  |  API: 99.97% uptime this month  |  
Last incident: 14 days ago  |  [View Status Page →]
```

- The green dot pulses with a CSS animation (paused if `prefers-reduced-motion`)
- If there is an active incident: the strip turns `bg-yellow-500/10 border-yellow-500/30`, dot is yellow, text shows "Partial outage — [details]"
- Data is fetched from the status API with 60-second revalidation (RSC)

### 4.4 Feature Grid

Three columns on desktop, one on mobile. Each card: `rounded-xl border border-border bg-card p-6 hover:border-primary/50 transition-colors`.

**Card 1: Knowledge Graph**
```
Icon: [graph node icon, green]
Title: "CBC Knowledge Graph"
Body: "Query the complete KICD curriculum graph. 
       Find concept relationships, prerequisite chains, 
       and strand hierarchies for Grade 7–12."
Footer link: "Explore the graph →" → /ekg-explorer
```

**Card 2: AI Generation**
```
Icon: [sparkles icon, purple]
Title: "AI Content Generation"
Body: "Generate CBC-aligned lesson plans, schemes of work, 
       and remedial content. Streaming responses with 
       full prompt control."
Footer link: "Open AI Studio →" → /ai-studio
```

**Card 3: Learner Intelligence**
```
Icon: [brain/chart icon, blue]
Title: "Learner Intelligence"
Body: "Access mastery profiles, strand-level progression, 
       and early warning signals for individual students 
       or entire classes."
Footer link: "Read the docs →" → /docs/intelligence-api
```

**Card 4: Events & Webhooks**
```
Icon: [bolt icon, orange]
Title: "Real-Time Events"
Body: "Subscribe to learner activity, assessment completion, 
       and curriculum updates via webhooks or our 
       event streaming API."
Footer link: "Event reference →" → /docs/events/types
```

**Card 5: Plugins & Marketplace**
```
Icon: [puzzle icon, pink]
Title: "Plugin Ecosystem"
Body: "Publish reusable integrations to the marketplace. 
       Certified plugins receive the EduNexus Quality Mark 
       and visibility to 200+ schools."
Footer link: "Browse marketplace →" → /marketplace
```

**Card 6: SDKs & CLI**
```
Icon: [terminal icon, grey]
Title: "TypeScript & Python SDKs"
Body: "Typed SDKs with auto-complete, error handling, 
       and retry logic built in. Also available: REST, 
       CLI, and Postman collection."
Footer link: "Download SDKs →" → /sdks
```

### 4.5 Quickstarts Section

**Heading:** `text-2xl font-bold` — "Start building in under 15 minutes"

**Layout:** Horizontal scrollable row of quickstart cards on mobile, 3-column grid on desktop.

Each card has a gradient accent color, estimated time, and skill level badge.

| Title | Time | Level | Route |
|-------|------|-------|-------|
| Embed CBC Progress Widget | 15 min | Beginner | `/docs/guides/progress-widget` |
| Query the Knowledge Graph | 20 min | Intermediate | `/docs/guides/cbc-alignment` |
| Generate a Lesson Plan with AI | 30 min | Intermediate | `/docs/ai-apis/lesson-plan` |
| Build an Assessment Integration | 45 min | Advanced | `/docs/assessment-api` |
| Publish a Marketplace Plugin | 60 min | Advanced | `/marketplace/submit` |

Card structure:
```
[Accent top border, 4px, color by level]
[Number badge] "01"
[Title] font-semibold
[Estimated time] text-sm text-muted-foreground + clock icon
[Level badge] color-coded pill
[Start →] link
```

### 4.6 SDK Installation Strip

A dark-background section (`bg-zinc-950` or `bg-card`) with tabbed code examples.

**Heading:** "Install the SDK and make your first request"

**Tabs:** `npm` | `yarn` | `pnpm` | `pip` | `brew (CLI)`

**Content per tab (Monaco-style code block):**

```bash
# npm tab
npm install @edunexus/sdk

# yarn tab
yarn add @edunexus/sdk

# pnpm tab
pnpm add @edunexus/sdk

# pip tab
pip install edunexus

# brew tab
brew install edunexus-cli
```

Below: a full getting-started snippet with syntax highlighting, line numbers, and a copy button.

### 4.7 Community and Statistics

**Statistics row (4 numbers):**

```
200+          12           5           99.97%
Developers    API Endpoints  SDKs & Tools   Uptime
```

Each number animates up from 0 when scrolled into view (Motion `useInView`). On `prefers-reduced-motion`: shows the final number immediately.

**Community section:**
Discord invitation card. `bg-indigo-950/50 border border-indigo-500/30 rounded-xl p-8`.

```
[Discord logo + "EduNexus Developers"]
"Join 400+ developers building on educational intelligence."
[Channels list: #general, #api-help, #showcase, #edtech-africa]
"Join on Discord →" (button, bg-indigo-600)
```

### 4.8 Announcements / Latest Updates

**Section heading:** "Latest from the developer portal"

Three-column grid of announcement cards, most recent first. Data is RSC-fetched from the changelog API.

Each card:
```
[Date] text-sm text-muted-foreground
[Type badge] "New Feature" | "Breaking Change" | "Deprecation" | "Performance"
[Title] font-semibold
[Summary] text-sm text-muted-foreground, 2 lines max
[Read more →]
```

"Breaking Change" badge is `bg-red-500/10 text-red-400 border-red-500/30`. This draws attention to breaking changes without alarming.

---

## Chapter 5 — Documentation Experience (`/docs/**`)

### 5.1 Layout Architecture

The docs layout is a three-panel design:

```
[Top Nav — sticky, 60px]
[Left Sidebar — 260px fixed] [Content — flex-1] [Right TOC — 220px fixed]
```

On tablet (`< 1024px`): right TOC collapses.
On mobile (`< 768px`): both sidebars collapse (left = bottom sheet, right TOC = inline jump links).

**Content area:** `max-w-3xl mx-auto px-6 py-12`

### 5.2 Page Layout Structure

Every docs page follows this structure from top to bottom:

```
[Breadcrumb]
[Page title — h1, text-4xl font-bold]
[Subtitle — text-xl text-muted-foreground]
[Meta row: Last updated date · Edit on GitHub · Reading time]
[Horizontal rule]
[Lead paragraph — larger font, text-lg]
[Body content — MDX]
[Feedback widget]
[Previous / Next navigation]
```

**Right-side Table of Contents:**
- Floated right, `position: sticky top: 80px`
- "On this page" heading
- Rendered from `## ` and `### ` headings in the MDX
- Active heading highlighted as user scrolls (IntersectionObserver)
- Smooth scroll to heading on click

### 5.3 Fumadocs Integration

Fumadocs handles: MDX rendering, sidebar navigation, search indexing, and breadcrumbs.

**Configuration:** `fumadocs.config.ts` defines the nav tree. Each node maps to a file in `content/docs/`. Fumadocs generates the sidebar from this tree automatically.

**MDX components available in docs:**

```
<Callout type="info|warning|error|tip"> — highlighted alert boxes
<CodeBlock language="ts" filename="example.ts"> — syntax-highlighted with filename tab
<Tabs items={["TypeScript","Python","curl"]}> — language switcher
<Steps> — numbered step list
<Card> — linked card
<Cards> — card grid
<Accordion> — collapsible section
<ApiEndpoint method="GET" path="/v2/curriculum/strands"> — endpoint badge
<Response statusCode={200}> — response example block
<Property name="grade" type="number" required> — API property definition
```

### 5.4 Code Blocks

All code blocks use a custom component wrapping Monaco (for interactive blocks) or Shiki (for static blocks).

**Every code block has:**
- Language label top-left (e.g., `TypeScript`)
- Optional filename tab (e.g., `lib/edunexus.ts`)
- Line numbers when > 5 lines
- Copy button top-right (icon only, tooltip "Copy") — shows checkmark for 2 seconds after click
- Optional "Run in Playground" button for API examples
- Diff highlighting support (`+`/`-` line prefixes)

**Dark mode:** Shiki uses `github-dark` theme in dark mode, `github-light` in light mode. Switched via CSS class on `<html>`.

**Code block anatomy:**
```
[filename.ts]                           [Copy ⧉] [Run ▶]
─────────────────────────────────────────────────────────
 1  import { EduNexus } from '@edunexus/sdk'
 2
 3  const client = new EduNexus({ apiKey: process.env.API_KEY })
```

### 5.5 Callout Components

```tsx
// Usage in MDX:
<Callout type="warning">
  This endpoint is deprecated as of v2.1. Use `/v2/curriculum/strands` instead.
</Callout>
```

Types and their visual treatment:
- `info` — `border-l-4 border-blue-500 bg-blue-500/10` — blue info icon
- `warning` — `border-l-4 border-yellow-500 bg-yellow-500/10` — triangle icon
- `error` — `border-l-4 border-red-500 bg-red-500/10` — red X icon
- `tip` — `border-l-4 border-green-500 bg-green-500/10` — green bulb icon

### 5.6 Per-Page Feedback Widget

At the bottom of every docs page, above the previous/next navigation:

```
─────────────────────────────────────
Was this page helpful?
[😞 No]  [😐 Somewhat]  [😊 Yes]

[After clicking "No" or "Somewhat":]
  What could be improved?
  [textarea]
  [Submit feedback]
```

Feedback is submitted to the analytics API. No login required.

After submission: "Thanks for your feedback. We review every submission." in a green toast.

### 5.7 Previous / Next Navigation

At the bottom of every page:

```
[← Previous: Authentication]    [Next: Rate Limits →]
```

Buttons: `variant="outline"`, full-width on mobile. Page title is shown. Implemented from the Fumadocs navigation tree.

---

## Chapter 6 — API Reference (`/api-reference`)

### 6.1 Integration with Scalar

The API Reference is powered by Scalar API Reference, loaded from the EduNexus OpenAPI spec hosted at `/api/openapi.json`.

**Layout:** Scalar's three-pane layout (sidebar / spec content / try-it panel) is customized with EduNexus theming via Scalar's theming API.

**Top-level URL:** `/api-reference` loads the Scalar instance. Deep links `/api-reference#tag/curriculum/GET/v2/curriculum/strands` open directly to the relevant endpoint.

### 6.2 OpenAPI Spec Structure

The OpenAPI spec is organized by resource tags:

```
Tags:
  Authentication
  Curriculum
  Learner
  Teacher
  Assessment
  Intelligence
  AI Generation
  Knowledge Graph
  Events
  Webhooks
  Marketplace
  Platform
```

Each endpoint in the spec includes:
- Summary (short, verb-noun: "Get competency strands")
- Description (2-3 sentences with educational context)
- Request parameters with type, required flag, and example value
- Request body schema with all properties described
- Response schemas for `200`, `400`, `401`, `403`, `404`, `429`, `500`
- At least one code example in the spec (`x-codeSamples` extension)
- A `x-educational-context` extension field: plain-language explanation of what this endpoint means in a CBC classroom context

### 6.3 Try-It Panel

The Scalar try-it panel is used without modification except for:
- Pre-populated base URL: `https://api.edunexus.co.ke`
- Auth header: if the user is logged in to the developer portal, their API key is pre-filled
- Sandbox mode toggle: switches the base URL to `https://sandbox.api.edunexus.co.ke`

**Sandbox badge:** When sandbox is active, a yellow `SANDBOX` pill appears in the try-it panel header. Requests to the sandbox return realistic but non-production data.

### 6.4 Authentication in the API Reference

The API Reference has a persistent "Auth" button in the top-right of the Scalar interface. Clicking it opens an auth configuration panel:

```
[Auth type: Bearer Token]
  [Input: API Key] [Paste from clipboard]
  [Or: Sign in to use your key automatically]

[Auth type: None (unauthenticated)]
  Works for public endpoints only.
```

Stored in `sessionStorage` for the duration of the browser session.

### 6.5 Request History

A drawer accessible from a "History" icon in the Scalar toolbar. Shows the last 20 requests made from the try-it panel in this session:

```
[GET] /v2/curriculum/strands?grade=8   200  142ms   2 min ago
[POST] /v2/ai/lesson-plan              200  3.4s    5 min ago
[GET] /v2/learner/GR001/mastery        404  89ms    8 min ago
```

Clicking a history item: re-populates the try-it panel with those exact parameters.

Stored in `sessionStorage`. Cleared on tab close.

### 6.6 Language Selector for Code Examples

Above the code example panel in Scalar, a language selector with:
- `curl` (default for unauthenticated)
- `JavaScript (fetch)`
- `TypeScript (@edunexus/sdk)`
- `Python (edunexus)`
- `Ruby`
- `Go`
- `PHP`

The selected language persists across navigation via `localStorage` key `preferred-language`.

---

## Chapter 7 — AI Studio (`/ai-studio`)

### 7.1 Layout

AI Studio is a full-screen, three-panel workspace. The top nav is retained but the sidebar is hidden.

```
[Top Nav]
[Panel: Prompt + Config — 40%] | [Panel: Output — 40%] | [Panel: Context/Inspector — 20%]
[Bottom Status Bar]
```

On tablet: the context panel collapses to an icon panel. On mobile: tabbed layout (Prompt / Output / Context).

All panels are resizable (drag handles between panels). The panel size preferences are saved to `localStorage`.

### 7.2 Prompt Editor Panel (Left)

**Header:**
```
[Endpoint selector dropdown]    [Model selector]    [Settings ⚙]
```

**Endpoint selector:** A searchable dropdown of all AI endpoints:
- `POST /v2/ai/lesson-plan` — Lesson Plan Generation
- `POST /v2/ai/scheme-of-work` — Scheme of Work Generation
- `POST /v2/ai/learner-intelligence` — Learner Intelligence Report
- `POST /v2/ai/remedial-plan` — Remedial Planning
- `POST /v2/ai/parent-report` — Parent Intelligence Report

Switching the endpoint updates the prompt editor, context viewer, and output panel schema.

**Model selector:** Dropdown showing available models (e.g., `deepseek-r1`, `deepseek-v3`). Shows context window size and cost per 1K tokens next to each model.

**Prompt editor (Monaco):**
The prompt editor renders the structured request JSON, not raw prompt text. Structured mode shows a form view. Raw mode shows JSON directly. Toggle between form/raw via segmented control.

**Form view example for Lesson Plan:**
```
[Grade level] — Number select (7–12)
[Subject] — Select with CBC subjects
[Term] — Select (1 / 2 / 3)
[Week] — Number input (1–14)
[Strand] — Searchable select from EKG
[Topic] — Text input
[Duration] — Number input (minutes)
[Include assessment?] — Toggle
[Special needs notes] — Textarea
[Custom instructions] — Textarea (optional)
```

**Template picker:** Above the form, a "Templates" button opens a dropdown of saved templates:
- Built-in templates (Grade 8 Math, Grade 7 English, etc.)
- My saved templates (user-defined)

"Save as template" button saves current config with a user-defined name.

**Settings panel** (opens as a right drawer from the `⚙` icon):
```
Temperature: 0.7 [slider 0.0–2.0]
Max tokens: 2000 [slider 100–8000]
Stream: [toggle — on by default]
Language: [English / Swahili / Both]
Format: [JSON / Markdown / Both]
```

**Bottom action row:**
```
[Clear]    [↑ Load example]    [▶ Run  Cmd+Enter]
```

### 7.3 Output Panel (Center)

**Header:**
```
[Run #] [Status badge] [Time elapsed]    [Copy] [Save] [Open in Playground]
```

**States:**

**Idle (no run yet):**
```
[Large centered illustration of a spark/lightning]
"Run a prompt to see the output here."
"Try loading an example from the prompt panel."
```

**Loading (waiting for first token):**
```
[Animated pulse ring]
"Connecting to AI Studio..."
[Elapsed time counter, counts up in ms]
```

**Streaming (tokens arriving):**
- Text appears character-by-character (typewriter effect via stream reader)
- A blinking cursor at the end of the streamed text
- Token counter in top right updates in real-time: `847 tokens`
- The streaming can be cancelled: "Stop" button replaces "Run"

**Complete:**
- Full response rendered as formatted markdown (lesson plan, SoW, etc.)
- Syntax highlighting if code blocks are in the response
- Token usage summary at the bottom: `Input: 312 tokens · Output: 847 tokens · Cost: KES 0.0023`
- Tabs: `Formatted` | `Raw JSON` | `Generated Code`

**Generated Code tab:**
Shows ready-to-use TypeScript or Python code to replicate this exact call programmatically. Language toggleable via selector.

### 7.4 Context / Inspector Panel (Right)

This panel provides debugging and educational context.

**Sections (accordion):**

**Request Context:**
- The full resolved request JSON that was sent (not the form view — the actual payload)
- Useful for debugging, especially to see computed fields

**Response Schema:**
- The OpenAPI schema for the response type of the selected endpoint
- Collapsible tree of all response fields with types and descriptions

**EKG Context:**
- If the request included a strand or concept identifier: shows the node from the Knowledge Graph
- Mini-graph visualization showing the concept and its immediate neighbors (Cytoscape.js, small canvas)
- Clicking a neighboring node: opens it in the full EKG Explorer

**Token Budget:**
- Gauge showing current request's token usage vs. the selected model's context window
- Color: green → yellow → red as it approaches the limit
- "You're using X% of the context window"

**Evaluation (future v1.1):**
- Quality rubric scores: CBC alignment, completeness, pedagogical appropriateness
- Manual override buttons: Approve / Reject / Flag for review

### 7.5 Bottom Status Bar

A thin bar (`height: 28px`, `bg-muted border-t`) showing:

```
  ● Connected    Model: deepseek-r1    Tokens used today: 12,847 / 100,000    
  Rate limit: 60 req/min    [View all usage →]
```

---

## Chapter 8 — Knowledge Graph Explorer (`/ekg-explorer`)

### 8.1 Layout

The EKG Explorer is a full-screen canvas application. The top nav is retained.

```
[Top Nav]
[Explorer Toolbar — 48px, full-width]
[Canvas — flex-1, full remaining height]
[Inspector Drawer — slides from right, 360px, overlaps canvas]
[Search Overlay — slides from top-left, 300px]
```

On mobile: the canvas remains touchable (pan + pinch-zoom). The inspector becomes a bottom sheet.

### 8.2 Explorer Toolbar

```
[Search nodes... ⌘F]    |    
[Filters ▼]    [Layout ▼]    [Level ▼]    |
[Grade: All ▼]    [Subject: All ▼]    [Term: All ▼]    |
[Zoom In]  [Zoom Out]  [Fit to screen]  [Reset]    |
[Export ▼]    [Debug]    [Help ?]
```

**Filters dropdown:** Allows toggling which node types are visible:
- ✓ Subject
- ✓ Strand
- ✓ Topic
- ✓ Concept
- ✓ Learning Outcome
- ✓ Assessment Criteria

**Layout dropdown:**
- Hierarchical (default) — top-down tree
- Circular — radial from selected node
- Force-directed — organic clustering
- Grid — structured matrix

**Level dropdown:** Shows only nodes at a given depth (e.g., "Strands only" or "Concepts only").

### 8.3 Graph Canvas (Cytoscape.js)

The graph renders the CBC Knowledge Graph using Cytoscape.js.

**Node visual design:**

| Node Type | Shape | Color | Size |
|-----------|-------|-------|------|
| Subject | Rounded rect | `#16a34a` (green) | 60px |
| Strand | Circle | `#2563eb` (blue) | 48px |
| Topic | Circle | `#9333ea` (purple) | 36px |
| Concept | Circle | `#ea580c` (orange) | 28px |
| Learning Outcome | Diamond | `#0891b2` (cyan) | 24px |
| Assessment Criterion | Hexagon | `#dc2626` (red) | 20px |

**Edge types:**

| Relationship | Style | Color |
|--------------|-------|-------|
| `HAS_STRAND` | Solid, weight 2 | `#374151` |
| `HAS_TOPIC` | Solid, weight 1.5 | `#4b5563` |
| `PREREQUISITE_OF` | Dashed, arrow | `#f59e0b` |
| `RELATED_TO` | Dotted | `#9ca3af` |
| `ASSESSED_BY` | Solid, weight 1 | `#6b7280` |

**Interactions:**
- **Click node:** Opens Inspector panel (slides in from right), selected node highlighted with a white ring
- **Double-click node:** Expands to show all connected nodes (if collapsed), loads neighbors from API
- **Right-click node:** Context menu (Copy node ID, Open in Docs, Find prerequisite path, Export subgraph)
- **Hover node:** Tooltip with node name, type, and grade level
- **Pan:** Drag empty canvas
- **Zoom:** Scroll wheel, or pinch on touch
- **Box select:** Shift+drag to select multiple nodes

**Graph animations (Motion + Cytoscape):**
- Node appearance: fade-in + scale from 0.5 to 1 when loaded
- Edge appearance: draw animation (stroke-dasharray animation)
- Layout change: animated transition between positions over 600ms cubic-bezier
- Node expansion: neighbouring nodes radiate outward from parent

**Performance:** Only nodes within the visible viewport + a buffer zone are rendered. Cytoscape's virtual rendering handles this. On initial load: top-level nodes only (Subject level), with a count badge showing hidden children.

### 8.4 Node Inspector Panel

Slides in from the right when a node is selected.

**Header:**
```
[Node type badge]    [Node name — text-xl font-bold]    [✕ close]
```

**Sections:**

**Identity:**
```
Node ID:    cbc-math-g8-strand-number
Grade:      8
Subject:    Mathematics
Curriculum: CBC
```

**Description:**
Full description of the concept from the KICD curriculum documents.

**Relationships:**
```
Parents (1):
  ↑ Mathematics Grade 8

Children (4):
  ↓ Number Operations
  ↓ Fractions and Decimals
  ↓ Percentages
  ↓ Ratio and Proportion

Prerequisites (2):
  → Grade 7: Number Strand
  → Grade 7: Basic Fractions

Related (3):
  ↔ Science: Measurement
  ↔ Grade 8: Algebra Strand
  ↔ Grade 9: Number Strand
```

Clicking any relationship link: navigates the graph to that node (smooth pan + zoom animation) and opens its inspector.

**Curriculum Metadata:**
```
KICD Reference:   KIC/2024/MATH/G8/STR/NUM
Time allocation:  40%
Assessment weighting: 35%
Competencies:     Critical thinking, Problem solving
```

**Actions:**
```
[Open in API Playground]
[Query this node's children]
[Find path to another node ...]
[Export subgraph as JSON]
[View in Documentation]
```

### 8.5 Search Overlay

Triggered by `Cmd+F` or the search input in the toolbar.

A panel (`position: absolute, top: 60px, left: 16px, width: 300px, z-index: 40`) slides down with Motion spring animation.

```
[Search input — "Search curriculum nodes..."]
[Results list:]
  [Icon] Number Strand — Mathematics G8        [Center on node]
  [Icon] Number Theory — Mathematics G9        [Center on node]
  [Icon] Natural Numbers — Mathematics G7      [Center on node]
```

Clicking "Center on node": the graph smoothly pans + zooms to the node and opens its inspector.

### 8.6 Timeline View

Accessible via a "Timeline" toggle in the toolbar. Switches the layout to a horizontal timeline showing how concepts progress across grade levels.

**Y-axis:** Subjects
**X-axis:** Grade 7 → Grade 12

Each concept appears as a colored pill on the timeline. Connecting lines show prerequisite chains. Clicking a pill opens the inspector.

Useful for visualizing curriculum progression. An engineer building an adaptive learning system uses this to understand prerequisite sequencing.

### 8.7 Debug Tools Panel

A collapsible panel at the bottom of the canvas (accessed via "Debug" toolbar button):

```
[Nodes rendered: 247]    [Edges rendered: 814]    [Viewport: -200, 100 @ 1.2x zoom]
[Last query: GET /v2/ekg/nodes?grade=8&subject=Mathematics (89ms)]
[Cache: HIT — expires in 4m 23s]
[API calls this session: 12]    [Rate limit: 60/min — 48 remaining]
```

### 8.8 Export Options

"Export ▼" dropdown in toolbar:

- **Export current view as PNG** — Cytoscape `png()` export, downloads at 2x resolution
- **Export current view as SVG** — Cytoscape `svg()` export
- **Export visible nodes as JSON** — Downloads the node/edge data of the current view
- **Export full subgraph (from selected node)** — Downloads the traversed subgraph
- **Copy API query** — Copies the API call that would replicate the current graph state

---

# PART III — DASHBOARD

---

## Chapter 9 — Developer Dashboard (`/dashboard`)

### 9.1 Dashboard Layout

The dashboard uses the portal's top nav, and replaces the docs sidebar with a dashboard sidebar.

**Dashboard sidebar:**
```
OVERVIEW
  ↳ Dashboard Home

DEVELOPER
  ↳ API Keys
  ↳ Projects
  ↳ Webhooks
  ↳ OAuth Apps

MONITORING
  ↳ Usage & Requests
  ↳ Error Logs
  ↳ Analytics

MARKETPLACE
  ↳ My Plugins
  ↳ Revenue

ACCOUNT
  ↳ Billing
  ↳ Team
  ↳ Settings
```

### 9.2 Dashboard Home (`/dashboard/overview`)

A bento-grid layout of metric cards.

**Row 1 — Key metrics (4 cols):**
```
[API Requests Today]    [Error Rate]    [Avg Response Time]    [Tokens Used]
     12,847                0.3%              142ms               847K
   +12% vs yesterday    -0.1% vs yesterday  +8ms vs yesterday  68% of limit
```

Each card: `rounded-xl border bg-card p-6`. The number is large (`text-4xl font-bold`). The delta shows `↑` (green) or `↓` (red, or green if error rate goes down). Clicking the card navigates to the detailed view.

**Row 2 — Usage chart (8 cols) + API health (4 cols):**

Usage chart: a line chart (Recharts) showing request volume over the last 7 days. Hovering shows a tooltip with exact counts by endpoint.

API health widget: traffic light for each endpoint group:
```
● Curriculum API    Operational
● Learner API       Operational
● AI Generation     Degraded  ← yellow dot, links to /status
● Knowledge Graph   Operational
```

**Row 3 — Recent errors (6 cols) + Latest API keys (6 cols):**

Recent errors: a table showing the last 5 errors with: timestamp, endpoint, status code, error message. "View all errors →" link.

Latest API keys: shows the 3 most recently used keys with masked value (`sk-live-•••••••••gHj3`), last used timestamp, and usage count. "Manage keys →" link.

**Row 4 — Recent requests log (12 cols):**

A live-updating table of recent API requests:
```
Timestamp       Method  Endpoint                     Status   Time    Key
2min ago        GET     /v2/curriculum/strands        200     142ms   sk-live-•••gHj3
5min ago        POST    /v2/ai/lesson-plan            200     3.4s    sk-live-•••gHj3
8min ago        GET     /v2/learner/GR001/mastery     404     89ms    sk-live-•••abc1
```

Table has: search, filter by status, filter by endpoint, filter by key, date range picker. "Export as CSV" button. Virtualized with TanStack Virtual for large lists.

### 9.3 API Keys (`/dashboard/api-keys`)

**Page header:** "API Keys" + "Create new key" button (primary, top-right)

**Keys table:**
```
Name                  Key (masked)          Environment  Status    Last Used     Actions
Production School     sk-live-•••••gHj3     Production   Active    2 min ago     [Copy] [Edit] [Revoke]
Staging Integration   sk-live-•••••kPq7     Staging      Active    3 hours ago   [Copy] [Edit] [Revoke]
Testing              sk-test-•••••mRs2     Test         Active    2 days ago    [Copy] [Edit] [Revoke]
Old Key              sk-live-•••••zXw1     Production   Revoked   14 days ago   [Delete]
```

**"Create new key" flow (drawer, slides from right):**

```
Step 1: Configure
  [Name] required — "e.g., Production School Portal"
  [Environment] — Production / Staging / Test
  [Expiry] — Never / 30 days / 90 days / 1 year / Custom date
  [Permissions] checkboxes:
    ✓ Read curriculum
    ✓ Read learner data
    □ Write learner data
    □ AI generation
    □ Admin
  [Description] optional textarea
  [Create Key] button

Step 2: Copy Key (one-time display)
  "Your API key has been created. Copy it now — it will not be shown again."
  [sk-live-a7f3b2c1d4e5f6g7h8i9j0k1l2m3n4o5]  [Copy]
  [Show QR code for mobile]  (base64 QR)
  [Done]
```

After creation, the key appears in the table with status "Active."

**Revoking a key:** Click "Revoke" → confirmation dialog: "Revoke this key? Any applications using sk-live-•••gHj3 will stop working immediately." → [Cancel] [Revoke Key] (destructive red). No undo.

### 9.4 Projects (`/dashboard/projects`)

Projects are a way to group API keys, webhooks, and usage metrics by logical application.

**Project card grid (3 cols desktop):**
```
[Project icon / color]
[Project name]
[Description — 1 line]
[Keys: 2]  [Webhooks: 1]  [Requests today: 1,247]
[Open project →]
```

Empty state:
```
[Illustration: folder with lightning bolt]
"No projects yet."
"Projects help you organize your API keys and monitor usage per application."
[Create your first project]
```

**Project detail page:** Shows the project's keys, webhooks, and a usage chart filtered to that project's activity.

### 9.5 Usage & Requests (`/dashboard/usage`)

Full-page analytics view.

**Filters bar (sticky below page header):**
```
[Date range: Last 7 days ▼]    [Project: All ▼]    [API Key: All ▼]
[Endpoint: All ▼]    [Status: All ▼]    [Compare to previous period ☐]
```

**Metrics section (top):**
4 stat cards (same style as Dashboard Home but with more detail and sparkline charts).

**Charts section:**
- **Request volume over time** — Bar chart by day (or by hour for single-day view)
- **Request breakdown by endpoint** — Horizontal bar chart, top 10 endpoints
- **Status code distribution** — Donut chart: 2xx / 4xx / 5xx
- **Response time P50/P95/P99** — Line chart over time
- **Token usage (AI endpoints)** — Stacked bar chart: input vs output tokens

**Limits panel:**
```
API Requests
  [Progress bar] 12,847 / 100,000 this month   12.8% used

AI Tokens
  [Progress bar] 847K / 2M this month           42.3% used

Knowledge Graph Queries
  [Progress bar] 234 / 1,000 this month         23.4% used
```

Orange warning at 80%, red at 90%, with "Upgrade plan" link.

### 9.6 Error Logs (`/dashboard/logs`)

**Table columns:** Timestamp | Request ID | Method | Endpoint | Status | Error Message | Duration | Key | Actions

**Row detail expansion:** Clicking a row expands it inline to show:
```
Request headers
Request body (truncated, "show full" expandable)
Response body
Stack trace (if available)
Suggested fix (from EduNexus error catalog)
```

**"Suggested fix" panel:** Each error code has a documented fix in the EduNexus error catalog. For example, a 429 error shows: "You've exceeded the rate limit. Consider implementing exponential backoff. See the rate limiting guide."

The suggested fix links directly to the relevant docs page.

**Filters:** Status code, endpoint, date range, key, project.

**Export:** "Export as CSV" or "Export as JSON" for the filtered result set.

### 9.7 Webhooks (`/dashboard/webhooks`)

**Table of configured webhooks:**
```
Name                  URL                         Events       Status    Last delivery
Lesson Plan Events    https://school.co.ke/hook   3 events     Active    2 min ago ✓
Learner Progress      https://school.co.ke/prog   5 events     Paused    --
```

**Create webhook (drawer):**
```
[Name] required
[Endpoint URL] required — validated with Zod (must be https://)
[Secret] — auto-generated, user can override. "Used to verify webhook signatures."
[Events to subscribe to] — checkbox list:
  □ learner.assessment.completed
  □ learner.mastery.updated
  □ ai.lesson_plan.generated
  □ teacher.lesson_plan.saved
  □ curriculum.content.updated
  ... (all event types)
[Test webhook] — sends a test payload to the URL, shows result
[Save]
```

**Webhook delivery log:** Each webhook has a delivery log tab showing:
- Timestamp, Event type, Status (Delivered / Failed / Retrying), HTTP response code
- Retry count (EduNexus retries up to 5 times with exponential backoff)
- "Resend" button for failed deliveries (manual retry)

### 9.8 Billing (`/dashboard/billing`)

**Current plan card:**
```
[Plan badge: FREE / PRO / ENTERPRISE]
[Usage summary]
[Renewal date / next invoice date]
[Upgrade plan] or [Manage subscription] button
```

**Usage this period:**
Mirrors the usage page but focused on billable metrics.

**Invoice history:**
```
Date          Amount    Status        Actions
Jun 2026      KES 0     Free tier     [View]
May 2026      KES 0     Free tier     [View]
```

**Upgrade plan CTA:**
For Free tier users, a prominent upgrade card:
```
[Rocket icon]
"You're on the Free tier."
"Upgrade to Pro for 100x the API calls, priority support, and 
 advanced analytics."
[Compare plans]  [Upgrade to Pro — KES 2,500/month]
```

---

## Chapter 10 — Marketplace (`/marketplace`)

### 10.1 Marketplace Home

**Hero:**
```
[H1] "EduNexus Developer Marketplace"
[Subtitle] "Discover plugins, integrations, and tools built by the community."
[Search bar — full width, prominent: "Search plugins..."]
[Filters: All / Assessment / Content / Analytics / Productivity / Integrations]
```

**Featured plugins (editorial picks):**
3-column grid of featured cards with a "Featured" badge.

**Category tiles:**
A horizontal scrollable row of category cards with icons.

```
[Assessment Tools: 8 plugins]
[Content & Curriculum: 12 plugins]
[Analytics & Reporting: 6 plugins]
[School Systems: 4 plugins]
[Parent Communication: 3 plugins]
[AI Extensions: 7 plugins]
```

**All plugins grid:**
```
Filters: Sort by [Newest | Most downloaded | Highest rated | Certified first]
Per page: 12 | 24 | 48
```

### 10.2 Plugin Card

Each card in the grid:
```
[Plugin icon — 48px, rounded-lg]       [Certified badge if certified: ✓ EduNexus Certified]
[Plugin name — font-semibold]
[Publisher — "by Schooltech Kenya" — text-sm text-muted-foreground]
[Short description — 2 lines max]
[Tags — "Grade 7-9" "CBC" "Assessment"]
──────────────────────────────────────
[★ 4.8 (23 reviews)]    [2.4K downloads]    [Free | KES 500/mo]
[Install] or [View] button
```

### 10.3 Plugin Detail Page (`/marketplace/[slug]`)

**Header:**
```
[Large plugin icon]
[Plugin name — text-3xl]
[Publisher]                    [★ Rating] [N reviews]
[Install] (primary) [Save] (outline)
[Stats: Downloads · Version · Last updated · License]
```

**Tab navigation:**
```
Overview | Documentation | API Reference | Reviews | Changelog | Support
```

**Overview tab:**
- Hero screenshot or demo video
- Feature list (checklist)
- "How it works" narrative
- Code example (ready-to-run)
- Permissions required (what EduNexus data this plugin accesses)
- Compatibility (grade levels, subjects, curriculum types)

**Reviews tab:**
```
[Average: ★ 4.8]
[Rating distribution bar chart: 5★ ████████ 80%, 4★ ██ 15%, 3★ ▌ 5%]
[Individual reviews with: name, date, rating stars, comment]
[Write a review] (requires install)
```

**Submit a Review (drawer):**
```
[Rating: ★★★★★ selector]
[Title: text input]
[Review: textarea]
[I'm using this in production: toggle]
[Submit]
```

### 10.4 Plugin Submission Flow (`/marketplace/submit`)

Multi-step form (step indicator at top: 1 → 2 → 3 → 4 → 5).

**Step 1: Basic Information**
```
Plugin name (required)
Short description (required, max 120 chars, with character counter)
Full description (required, Markdown editor)
Category (required, select)
Tags (multi-select, max 5)
Plugin icon (upload, 512×512 PNG required)
Screenshots (upload, max 5, 1280×800 recommended)
```

**Step 2: Technical Details**
```
Plugin type: [Widget / API Extension / Webhook Handler / CLI Plugin / Theme]
Installation method: [NPM Package / CDN / Manual]
Package name (if npm)
Supported environments: [Web / Node.js / Python / Mobile]
EduNexus API version compatibility (min/max)
Permissions requested (checkboxes)
Webhook events consumed (checkboxes)
```

**Step 3: Pricing**
```
Pricing model: [Free / One-time / Monthly / Usage-based]
(If paid: price input, currency KES, description of what is included)
Free trial: [toggle — 14 days default]
```

**Step 4: Review Checklist**
Self-certification checklist (all required before submission):
```
✓ My plugin does not store learner PII outside of EduNexus
✓ My plugin handles API errors gracefully  
✓ My plugin includes documentation
✓ My plugin has been tested with EduNexus sandbox
✓ I agree to the EduNexus Marketplace Terms of Service
```

**Step 5: Submit**
Review summary of all entered information. "Submit for Review" button.

**Post-submission state:**
```
[Checkmark illustration]
"Your plugin has been submitted!"
"Our team will review it within 3-5 business days. 
 You'll receive an email at dev@example.com when it's approved."
[Track submission →]  [Submit another →]
```

### 10.5 Revenue Dashboard (`/dashboard/marketplace/my-plugins`)

For developers with paid plugins:

```
[Total earnings this month: KES 8,450]    [Active subscribers: 12]    [Downloads: 347]

[Per-plugin table:]
Plugin Name    Installs    Subs    MRR        Rating    Actions
My Quiz Tool   234         8       KES 4,000  ★ 4.7    [Analytics] [Edit] [Unpublish]
CBC Flashcards 113         4       KES 2,000  ★ 4.9    [Analytics] [Edit] [Unpublish]
```

**Plugin analytics:** Clicking a plugin opens a mini-analytics dashboard: installs over time, churn rate, rating trend, revenue chart.

---

# PART IV — UX SYSTEM

---

## Chapter 11 — Loading, Error, and Feedback States

### 11.1 Skeleton Loading

Every data-dependent UI component has a skeleton loading state. Skeletons are:
- The exact same dimensions as the loaded content
- `bg-muted animate-pulse rounded`
- Never shown for longer than necessary (prefer SSR data loading)
- Used only for client-side fetches (TanStack Query)

**Skeleton components:**
```tsx
<SkeletonText lines={3} />          // text block
<SkeletonCard />                    // card-shaped rectangle
<SkeletonTable rows={5} cols={4} /> // table skeleton
<SkeletonChart width="100%" height={200} />
<SkeletonCode lines={8} />          // code block skeleton
<SkeletonGraph />                   // circular placeholder for graph canvas
```

### 11.2 Streaming UI

For AI Studio and any streaming endpoint:
- First token appears immediately when the stream begins
- Text renders character by character with a blinking cursor at the end
- The streaming container does not re-render the entire tree on each token (uses a `ref` to update a text node directly for performance)
- A "Stop" button cancels the stream via `AbortController`
- If the stream is cancelled mid-way, the partial response is shown with a "Cancelled" badge

### 11.3 Progress Indicators

**Determinate progress:** For file uploads, batch operations with known counts. Use a `<Progress />` shadcn component with animated fill.

**Indeterminate progress:** For operations of unknown duration. Use a thin animated bar at the top of the page (like Next.js router indicator). Implemented with `nProgress` or a custom Motion animation.

**Multi-step progress:** For onboarding, plugin submission. Use a step indicator:
```
Step 1 of 5: Basic Information
[●──────] 20% complete
```

### 11.4 Success States

Success feedback uses a hierarchy of prominence based on the action's importance:

- **Toast (minor):** "API key copied to clipboard." — bottom-right, auto-dismisses after 3s, `bg-green-500/10 border-green-500/30`
- **Toast (moderate):** "Webhook saved successfully." — same style
- **Inline confirmation (significant):** After creating an API key — the key row in the table flashes green for 2 seconds
- **Full success screen (major):** Plugin submitted — full page state with illustration and next steps

**Toast implementation:** `sonner` library (already compatible with shadcn/ui). Maximum 3 toasts stacked. Each has an `×` dismiss button.

### 11.5 Error States

**Network error (no connection):**
```
[Wifi-off icon]
"No internet connection"
"Check your connection and try again."
[Retry]
```

**API error (4xx):**
```
[AlertCircle icon, yellow]
"Something went wrong"
"[Error message from API: human-readable]"
[Error code: E4012]  [View error docs →]
[Retry]  [Copy error details]
```

**API error (5xx):**
```
[AlertOctagon icon, red]  
"EduNexus API error"
"Our team has been notified. This is not a problem with your code."
[Status page →]  [Contact support →]
```

**Empty state (no data):**
Every empty state has three elements:
1. A relevant illustration (not a generic "no results" graphic — specific to the context)
2. A concise explanation of why it's empty
3. A clear action to resolve the emptiness

Example — empty API keys:
```
[Key illustration]
"No API keys yet"
"Create your first API key to start making requests."
[Create API key]
```

### 11.6 Offline Support

A top-of-page banner appears when `navigator.onLine` is false:

```
[Wifi-off icon] You're offline. Some features may be unavailable.
[Dismiss × ]
```

The banner uses `bg-yellow-500/10 border-b border-yellow-500/30`. It auto-dismisses when connectivity returns.

Docs pages and previously visited API reference pages are served from the service worker cache while offline. A subtle "Viewing cached version" badge appears on cached pages.

### 11.7 Retry Behavior

Operations that fail with a network error auto-retry with exponential backoff (via TanStack Query's `retry` configuration):
- Attempt 1: immediate
- Attempt 2: after 1s
- Attempt 3: after 3s
- Final failure: shows error state with manual "Retry" button

The retry state is shown to the user: "Retrying... (attempt 2 of 3)"

### 11.8 Undo

For destructive actions that cannot be immediately reversed (deleting a project, revoking a key):
- A confirmation dialog is shown first
- After confirmation, a toast appears with an undo countdown: "Key revoked. Undo (5s)" 
- During the undo window, the deletion is held in memory (not yet committed to the API)
- If undo is clicked within 5 seconds, the action is cancelled and the item is restored
- After 5 seconds, the action is committed

This pattern applies to: Delete project, Archive webhook, Remove team member.
It does NOT apply to: Revoking API keys (too security-sensitive for undo).

### 11.9 Notifications

The notification bell in the top nav shows a badge count. Clicking it opens a dropdown:

```
[Notifications]                      [Mark all read] [Settings]
─────────────────────────────────────────────────────────────
● Plugin submission approved          2 hours ago
  "CBC Flashcards v1.2 is now live in the marketplace."

● Rate limit warning                  5 hours ago
  "You've used 80% of your monthly API quota."

● New SDK version available           Yesterday
  "@edunexus/sdk v2.1.0 — breaking changes in Knowledge Graph API."

[View all notifications →]
```

Unread: left blue dot + `font-medium`. Read: no dot, normal weight.

Notification types: `info` (blue), `warning` (yellow), `error` (red), `success` (green). Each type has an icon.

---

## Chapter 12 — Accessibility

### 12.1 Keyboard Navigation

Every interactive element is reachable and operable via keyboard.

- **Tab order:** Follows DOM order. The sidebar navigates top-to-bottom. Modal dialogs trap focus within themselves.
- **Focus indicators:** `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` on all interactive elements. Never remove outline without replacing it.
- **Skip links:** A visually hidden "Skip to content" link is the first focusable element on every page. Becomes visible on focus.
- **Arrow keys:** Dropdown menus, command palette, and tab bars are navigable with arrow keys.
- **Escape key:** Closes any open modal, dialog, drawer, or dropdown.
- **Enter/Space:** Activates buttons, checkboxes, and toggle controls.

### 12.2 Screen Reader Support

- All images have meaningful `alt` text, or `alt=""` for decorative images.
- The graph canvas (Cytoscape.js) has an ARIA live region that announces the selected node name, type, and relationship count when a node is selected.
- Icon-only buttons have `aria-label`.
- Loading states announce via `aria-live="polite"` when content finishes loading.
- Status badges use `role="status"` with screen-reader-only text describing the status.
- Tab panels use correct `role="tablist"`, `role="tab"`, `role="tabpanel"` with `aria-selected` and `aria-controls`.
- The command palette uses `role="combobox"` with `aria-expanded` and `aria-activedescendant`.

### 12.3 Reduced Motion

All Motion animations check `prefers-reduced-motion`:

```tsx
const prefersReducedMotion = useReducedMotion()

const animation = prefersReducedMotion
  ? { opacity: [0, 1] }                          // fade only
  : { opacity: [0, 1], y: [20, 0], scale: [0.95, 1] }  // full animation
```

Graph animations (Cytoscape), typewriter effects, and number count-up animations are all disabled under `prefers-reduced-motion`.

### 12.4 Color Contrast

All text meets WCAG 2.1 AA minimum contrast ratios:
- Normal text: 4.5:1 minimum
- Large text (18px+ or 14px+ bold): 3:1 minimum
- UI components and graphical objects: 3:1 minimum

The design system tokens are audited against both light and dark mode. The `text-muted-foreground` token is specifically tuned to pass contrast in both modes.

Color is never the sole conveyor of information. All status indicators (error, warning, success) use both color and an icon. Graph node types use both color and shape. This ensures usability for colorblind users.

### 12.5 Responsive Design

**Breakpoints (Tailwind defaults):**
- `sm`: 640px — minor adjustments
- `md`: 768px — sidebar collapses to bottom sheet, mobile nav bar appears
- `lg`: 1024px — three-panel layouts become two-panel
- `xl`: 1280px — full three-panel layouts
- `2xl`: 1536px — maximum content widths enforced

**Mobile-specific design decisions:**
- The AI Studio becomes a tabbed layout (Prompt | Output | Context) instead of three panels
- The EKG Explorer is touch-navigable with pinch-zoom and pan
- The command palette scrolls internally, not the page
- Code blocks horizontally scroll, never wrap

### 12.6 Localization

The portal launches in English only. The system is built to support Swahili in v2.

**Preparation for i18n:**
- All user-facing strings are in `lib/i18n/en.json` (no hardcoded English in components)
- Dates and numbers use `Intl.DateTimeFormat` and `Intl.NumberFormat` with locale-awareness
- RTL layout is not required (Swahili is LTR), but the layout uses `dir="ltr"` explicitly
- Currency displays as KES with `Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' })`

---

# PART V — VISUAL SYSTEM

---

## Chapter 13 — Design Tokens and Visual Language

### 13.1 Spacing System

All spacing uses a base-4 scale derived from Tailwind defaults. No arbitrary values.

```
4px   (1)  — icon gap, compact padding
8px   (2)  — tight padding, badge inner padding
12px  (3)  — card inner gap, list item padding
16px  (4)  — standard padding, form field gap
24px  (6)  — section gap within a card
32px  (8)  — card gap, major section padding
48px  (12) — section separation
64px  (16) — major section separation (hero, page)
96px  (24) — hero vertical padding
```

The maximum content width is `max-w-screen-xl` (1280px) for the portal frame and `max-w-3xl` (768px) for documentation prose content.

### 13.2 Typography

**Font families:**
- Display / Headings: `Inter` (variable), `font-bold` to `font-extrabold`
- Body: `Inter` (variable), `font-normal` to `font-medium`
- Monospace (code): `JetBrains Mono` (variable), fallback `ui-monospace`

**Type scale:**
```
text-xs   (12px) — labels, captions, metadata
text-sm   (14px) — secondary body, table content, form labels
text-base (16px) — primary body text
text-lg   (18px) — lead paragraphs, important callouts
text-xl   (20px) — card headings, sub-section headings
text-2xl  (24px) — section headings
text-3xl  (30px) — page sub-headings
text-4xl  (36px) — page headings (h1 in most contexts)
text-5xl  (48px) — marketing headings
text-7xl  (72px) — hero heading
```

**Prose styles** (in docs content): Fumadocs' default prose styles, customized with the EduNexus design tokens. `leading-7` for body, `leading-snug` for headings.

### 13.3 Color Tokens

**Semantic tokens (HSL, supports dark mode via CSS variables):**

```css
--background       /* page background */
--foreground       /* primary text */
--card             /* card/surface background */
--card-foreground  /* text on cards */
--muted            /* subtle backgrounds */
--muted-foreground /* de-emphasized text */
--border           /* borders */
--input            /* form input backgrounds */
--ring             /* focus ring */
--primary          /* brand green #16a34a */
--primary-foreground
--secondary
--secondary-foreground
--destructive      /* red for errors/delete */
--destructive-foreground
```

**Graph node colors (constant, not affected by dark/light mode):**
```
Subject:            #16a34a (green-600)
Strand:             #2563eb (blue-600)
Topic:              #9333ea (purple-600)
Concept:            #ea580c (orange-600)
Learning Outcome:   #0891b2 (cyan-600)
Assessment:         #dc2626 (red-600)
```

**Syntax highlighting** (Shiki themes):
- Light: `github-light`
- Dark: `github-dark`

**Chart colors** (sequential palette, colorblind-safe):
```
Series 1: #16a34a  (green)
Series 2: #2563eb  (blue)
Series 3: #9333ea  (purple)
Series 4: #ea580c  (orange)
Series 5: #0891b2  (cyan)
Series 6: #dc2626  (red)
```

### 13.4 Elevation and Borders

**Card elevation levels:**
- Level 0: `border border-border` — flat, no shadow
- Level 1: `border border-border shadow-sm` — slightly raised (default for cards)
- Level 2: `border border-border shadow-md` — raised (hover state, active panels)
- Level 3: `shadow-xl` — floating (dropdowns, command palette)
- Level 4: `shadow-2xl` — modals, dialogs

**Border radius:**
```
rounded-sm  (4px)  — tags, badges, tight elements
rounded-md  (8px)  — buttons, inputs
rounded-lg  (12px) — cards
rounded-xl  (16px) — large cards, panel sections
rounded-2xl (20px) — hero cards, feature cards
rounded-full       — pills, avatars, icon buttons
```

### 13.5 Motion Tokens

All Motion animations use these tokens for consistency:

```tsx
const motionTokens = {
  // Durations
  instant: 0.1,
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  verySlow: 0.8,

  // Spring configs
  springSnappy: { type: 'spring', stiffness: 400, damping: 30 },
  springGentle: { type: 'spring', stiffness: 200, damping: 25 },
  springBouncy: { type: 'spring', stiffness: 300, damping: 15 },

  // Easings (for non-spring)
  easeOut: [0.0, 0.0, 0.2, 1.0],
  easeInOut: [0.4, 0.0, 0.2, 1.0],
}
```

**Standard entrance animation:**
```tsx
{ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: springGentle }
```

**Standard exit animation:**
```tsx
{ exit: { opacity: 0, y: -8 }, transition: { duration: 0.15, ease: 'easeIn' } }
```

**Staggered children** (for card grids, list items):
```tsx
const container = { animate: { transition: { staggerChildren: 0.05 } } }
const item = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }
```

### 13.6 Icons

All icons: Lucide React. `size={16}` for inline, `size={20}` for UI, `size={24}` for feature icons, `size={48}` for empty states.

Icons are never used without an accessible label (either visible text or `aria-label`).

**Custom icons** (not in Lucide):
- EduNexus logomark — SVG component
- CBC Knowledge Graph icon — custom SVG
- Curriculum strand icons (per subject) — custom SVG set

### 13.7 Illustrations

Empty states and onboarding use custom illustrations:

**Style:** Line illustrations with a single accent color fill, on transparent background. Match the page's accent color. All illustrations have dark mode variants.

**Required illustration set for v1:**
- Empty API keys
- Empty projects
- Empty webhooks
- Empty error logs
- Plugin submission success
- API key created
- Onboarding welcome
- EKG Explorer hero
- Playground hero
- 404 page
- 500 error page

Illustrations are SVG, loaded as React components (not `<img>`), so they respect dark mode via `currentColor`.

---

## Chapter 14 — Component Inventory

This is the complete set of UI components required for v1. All components extend shadcn/ui primitives unless noted.

### 14.1 Foundational Components

**`<Button>`**
Variants: `default` (green), `outline`, `ghost`, `destructive`, `link`
Sizes: `sm`, `default`, `lg`, `icon`
States: default, hover, active, disabled, loading (spinner replaces icon)

**`<Badge>`**
Variants: `default`, `secondary`, `outline`, `destructive`, `success`, `warning`
Used for: API method (GET/POST), status, plan tier, certification level, node type

**`<Input>`** / **`<Textarea>`**
Standard shadcn inputs with: label above, helper text below, error state (red border + error message), character counter (optional)

**`<Select>`** / **`<Combobox>`**
`<Select>` for short, fixed lists. `<Combobox>` (searchable) for long lists (subjects, endpoints, curriculum nodes).

**`<Switch>`** / **`<Checkbox>`** / **`<RadioGroup>`**
Standard shadcn with label text and optional description below.

### 14.2 Layout Components

**`<Card>`**
```tsx
<Card>
  <CardHeader>
    <CardTitle />
    <CardDescription />
  </CardHeader>
  <CardContent />
  <CardFooter />
</Card>
```
Variant: `default` (bordered), `ghost` (no border, no background), `featured` (gradient border)

**`<Separator>`** — horizontal or vertical divider

**`<ResizablePanelGroup>`** / **`<ResizablePanel>`** / **`<ResizableHandle>`**
From shadcn/ui resizable. Used in: AI Studio, Playground, API Reference try-it panel.

**`<Collapsible>`** — for sidebar sections, accordion items

### 14.3 Data Display Components

**`<Table>`**
Columns are sortable (clicking header). Virtualized for > 100 rows (TanStack Virtual). Rows are selectable (checkbox). Bulk actions appear in a floating bar when rows are selected.

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead sortable>Name</TableHead>
      ...
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow selectable>
      <TableCell>...</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**`<DataTable>`** — a higher-level wrapper for the common pattern of: Table + pagination + search + column visibility toggle. Built on TanStack Table.

**`<Timeline>`**
Used in: changelog, webhook delivery log, API request history.
```
[dot] ─── [Timestamp] [Event type badge]
           [Description]
           [Link or action]
```

**`<ActivityFeed>`**
Used in: dashboard overview, project detail.
Scrollable list of activity events with: avatar/icon, description, timestamp. Grouped by day.

**`<StatsCard>`**
```tsx
<StatsCard
  label="API Requests Today"
  value="12,847"
  delta="+12%"
  deltaDirection="up"
  sparkline={[...data]}
/>
```

**`<ProgressRing>`** — SVG circular progress. Used for token budget indicator.

### 14.4 Navigation Components

**`<Tabs>`** / **`<TabsList>`** / **`<TabsTrigger>`** / **`<TabsContent>`**
Variants: `default` (underline), `pills` (filled pills), `cards` (bordered cards)

**`<Breadcrumb>`** — see Chapter 2.3

**`<Pagination>`** — page-based navigation with: first/prev/page numbers/next/last, items-per-page selector

**`<CommandPalette>`** — see Chapter 2.9. Built on shadcn `<Command>`.

**`<DropdownMenu>`** — shadcn standard. All dropdown items have keyboard shortcuts displayed right-aligned.

### 14.5 Feedback Components

**`<Toast>`** — via Sonner. See Chapter 11.4.

**`<Alert>`** / **`<AlertDialog>`**
`<Alert>` for inline non-disruptive messages.
`<AlertDialog>` for destructive confirmations. Pattern:
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild><Button variant="destructive">Revoke</Button></AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogTitle>Revoke this key?</AlertDialogTitle>
    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction variant="destructive">Revoke Key</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**`<Skeleton>`** — see Chapter 11.1

**`<EmptyState>`** custom component:
```tsx
<EmptyState
  illustration="api-keys"
  title="No API keys yet"
  description="Create your first key to start making requests."
  action={{ label: 'Create API key', href: '/dashboard/api-keys/new' }}
/>
```

### 14.6 Advanced Components

**`<MonacoEditor>`** wrapper:
```tsx
<MonacoEditor
  language="typescript"
  value={code}
  onChange={setCode}
  readOnly={false}
  showLineNumbers
  theme="github-dark"  // or auto-detected from color scheme
  height={400}
  onRun={handleRun}
  filename="example.ts"
/>
```

**`<StreamingOutput>`** custom component:
```tsx
<StreamingOutput
  stream={streamReader}
  format="json"      // json | markdown | text
  onComplete={handleComplete}
  onError={handleError}
/>
```
Renders streamed text with typewriter effect using `requestAnimationFrame` for performance.

**`<GraphCanvas>`** wrapper (Cytoscape.js):
```tsx
<GraphCanvas
  nodes={nodes}
  edges={edges}
  layout="hierarchical"
  onNodeSelect={handleNodeSelect}
  onNodeExpand={handleNodeExpand}
  onContextMenu={handleContextMenu}
  theme={resolvedTheme}
/>
```

**`<SplitPane>`** — resizable two-pane layout. Horizontal or vertical split. Used in Playground and AI Studio.

**`<CodeBlock>`** static (Shiki) and interactive (Monaco) — see Chapter 5.4.

**`<ApiMethodBadge>`**:
```tsx
<ApiMethodBadge method="GET" />   // green
<ApiMethodBadge method="POST" />  // blue  
<ApiMethodBadge method="PUT" />   // orange
<ApiMethodBadge method="DELETE" /> // red
<ApiMethodBadge method="PATCH" /> // purple
```

**`<KeyMask>`** — displays a masked API key with a "Copy" button:
```tsx
<KeyMask value="sk-live-a7f3b2c1...gHj3" revealable />
```
"Reveal" button unmasks the key for 10 seconds, then re-masks.

---

# PART VI — IMPLEMENTATION

---

## Chapter 15 — Next.js Routing and Architecture

### 15.1 App Directory Structure

```
app/
  (portal)/                     ← route group: top nav + portal layout
    layout.tsx                  ← portal layout (top nav, no sidebar)
    page.tsx                    ← Home (/)
    playground/
      page.tsx                  ← /playground
    ai-studio/
      page.tsx                  ← /ai-studio
    ekg-explorer/
      page.tsx                  ← /ekg-explorer
    sdks/
      page.tsx                  ← /sdks
      [sdk]/
        page.tsx                ← /sdks/javascript
    marketplace/
      page.tsx                  ← /marketplace
      [category]/
        page.tsx
      plugin/
        [slug]/
          page.tsx
      submit/
        page.tsx
    changelog/
      page.tsx
      [version]/
        page.tsx
    roadmap/
      page.tsx
    rfcs/
      page.tsx
      [slug]/
        page.tsx
    community/
      page.tsx
    status/
      page.tsx
    certification/
      page.tsx
      [track]/
        page.tsx
      verify/
        [id]/
          page.tsx
    cli/
      page.tsx

  (docs)/                       ← route group: top nav + docs sidebar + TOC
    layout.tsx                  ← docs layout (sidebar, TOC)
    docs/
      [[...slug]]/
        page.tsx                ← Fumadocs dynamic page

  (api-reference)/              ← route group: top nav + Scalar
    layout.tsx
    api-reference/
      page.tsx                  ← Scalar root (loads /api-reference#...)
      [[...slug]]/
        page.tsx                ← deep links into Scalar

  (dashboard)/                  ← route group: top nav + dashboard sidebar, auth-required
    layout.tsx                  ← includes auth guard
    dashboard/
      overview/
        page.tsx
      api-keys/
        page.tsx
        new/
          page.tsx
      projects/
        page.tsx
        [id]/
          page.tsx
      usage/
        page.tsx
      logs/
        page.tsx
      webhooks/
        page.tsx
        new/
          page.tsx
        [id]/
          page.tsx
      marketplace/
        my-plugins/
          page.tsx
        revenue/
          page.tsx
      billing/
        page.tsx
      team/
        page.tsx
      settings/
        page.tsx

  (auth)/                       ← route group: minimal layout (no sidebar)
    layout.tsx
    sign-in/
      page.tsx
    sign-up/
      page.tsx
    forgot-password/
      page.tsx
    onboarding/
      page.tsx

  api/
    openapi.json/
      route.ts                  ← serves OpenAPI spec
    search/
      route.ts                  ← Fumadocs search API
    status/
      route.ts                  ← status aggregation
    proxy/
      sandbox/
        route.ts                ← sandbox API proxy (adds demo key)

  not-found.tsx                 ← 404 page
  error.tsx                     ← global error boundary
  global-error.tsx              ← uncaught error boundary
  layout.tsx                    ← root layout (html, body, providers)
```

### 15.2 Layouts

**Root layout (`app/layout.tsx`):**
```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.variable, jetbrainsMono.variable, 'font-sans')}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            <TooltipProvider>
              <Toaster />
              {children}
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Portal layout (`app/(portal)/layout.tsx`):**
```tsx
export default function PortalLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
```

**Docs layout (`app/(docs)/layout.tsx`):**
```tsx
export default function DocsLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <div className="flex flex-1">
        <DocsSidebar />
        <div className="flex flex-1">
          <main className="flex-1 min-w-0">{children}</main>
          <TableOfContents />
        </div>
      </div>
    </div>
  )
}
```

**Dashboard layout (`app/(dashboard)/layout.tsx`):**
```tsx
export default async function DashboardLayout({ children }) {
  const session = await getServerSession()
  if (!session) redirect('/sign-in?next=/dashboard')

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav session={session} />
      <div className="flex flex-1">
        <DashboardSidebar />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
```

### 15.3 Providers

All providers are in `components/providers/`:

```tsx
// query-provider.tsx
'use client'
const [queryClient] = useState(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,      // 1 minute
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
    }
  }
}))
```

### 15.4 Data Fetching Patterns

**Server Components (RSC) — for:**
- Initial page data (API status, changelog entries, featured plugins)
- Authentication-gated data (dashboard metrics, API keys list)
- SEO-critical content (marketplace listings, docs pages)

```tsx
// Server Component
export default async function DashboardOverview() {
  const [metrics, recentErrors, apiKeys] = await Promise.all([
    getDashboardMetrics(),
    getRecentErrors({ limit: 5 }),
    getApiKeys(),
  ])
  return <OverviewUI metrics={metrics} errors={recentErrors} apiKeys={apiKeys} />
}
```

**TanStack Query — for:**
- Interactive data (live request log, real-time metrics)
- User-triggered fetches (playground runs, AI Studio prompts)
- Infinite scroll (marketplace listings, error logs)

```tsx
// Client Component
export function LiveRequestLog() {
  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['requests'],
    queryFn: ({ pageParam }) => fetchRequests({ cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: 30_000,  // refresh every 30s
  })
  // ...
}
```

### 15.5 Streaming and Suspense

**Streaming dashboard metrics:**
```tsx
// page.tsx (Server Component)
export default function DashboardPage() {
  return (
    <div>
      <Suspense fallback={<StatsCardSkeleton count={4} />}>
        <DashboardMetrics />  {/* slow, deferred */}
      </Suspense>
      <Suspense fallback={<TableSkeleton rows={5} />}>
        <RecentRequests />    {/* slower, deferred */}
      </Suspense>
    </div>
  )
}
```

**Streaming AI Studio output:**
```tsx
// Uses the Vercel AI SDK streaming pattern
const { data: stream } = useQuery({
  queryKey: ['ai-studio', promptId],
  queryFn: () => runAIPrompt(prompt),
  enabled: isRunning,
})
```

### 15.6 State Management

**Global state:** Minimal. Only what cannot be co-located:
- `ThemeStore` (zustand) — current theme, keyboard shortcut state
- `CommandPaletteStore` (zustand) — open/closed, recent items
- `SessionStore` — current user session (derived from cookie, not duplicated)

**Local state:** React `useState` + `useReducer` for component-local state.

**Server state:** TanStack Query for all remote data.

**URL state:** `nuqs` for search params that should be shareable (e.g., EKG Explorer's selected node, AI Studio's selected endpoint, playground's request parameters). This means a developer can share a URL and the recipient sees the same state.

---

## Chapter 16 — Design System Integration

### 16.1 Token File Structure

```
styles/
  globals.css          ← CSS variables for all design tokens
  prose.css            ← Tailwind typography customization for docs
  animations.css       ← Keyframe animations
  syntax.css           ← Code syntax highlighting overrides

lib/
  design-system/
    tokens.ts          ← TypeScript re-export of token values (for use in JS)
    motion.ts          ← Motion token constants
    colors.ts          ← Color system constants

components/
  ui/                  ← All shadcn/ui components (generated, do not edit)
  custom/              ← Custom components extending shadcn
```

### 16.2 shadcn/ui Configuration

`components.json`:
```json
{
  "style": "default",
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "styles/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

All shadcn components are in `components/ui/`. They are generated by the shadcn CLI and not hand-edited. Custom extensions go in `components/custom/` and import from `components/ui/`.

### 16.3 Storybook

Storybook is configured at `/.storybook/` and runs at `localhost:6006`.

**Every component in `components/ui/` and `components/custom/` has a story.**

Story file convention: `ComponentName.stories.tsx` co-located with the component.

Stories document:
- All variants
- All states (loading, error, empty, disabled)
- All sizes
- Dark mode (via Storybook theme toggle)
- Mobile viewport (via Storybook viewport addon)
- Accessibility audit (via `@storybook/addon-a11y`)

**Storybook is the design system documentation.** Designers and engineers use it to understand what components exist and how they behave before implementing a screen.

### 16.4 Theming

Theme is controlled by a CSS class on `<html>`: `class="dark"` or `class="light"`.

`next-themes` manages theme persistence (`localStorage`, system preference detection) and applies the class to `<html>` without flash of unstyled content (via the `suppressHydrationWarning` pattern).

**Component theme contracts:**
- No component uses literal color values (`#16a34a`). All use semantic tokens (`text-primary`, `bg-muted`).
- Graph node colors are the one exception (they are data-semantic, not UI-semantic), and are defined in `lib/design-system/colors.ts` as constants.
- Syntax highlighting is Shiki dual-theme, switching based on the resolved theme.

### 16.5 Versioning the Design System

The design system follows the portal's version. Breaking changes to component APIs are documented in the changelog as "Breaking: Component API change."

A `COMPONENT_CHANGELOG.md` in `components/` tracks per-component changes. Engineers check this when upgrading shadcn components via the CLI.

---

# FINAL CHAPTER — VERSION 1 LAUNCH CHECKLIST

---

## Pre-Launch Screen Inventory

Every screen listed here must exist, function correctly, and meet accessibility standards before developers.edunexus.co.ke publicly launches.

---

### MUST HAVE — Portal does not launch without these

**Core Portal Screens:**
- [ ] Home page (`/`) — complete with live code demo, feature grid, quickstarts
- [ ] Sign-in page (`/sign-in`) — email/password + OAuth
- [ ] Sign-up page (`/sign-up`) — with email verification flow
- [ ] Onboarding flow (`/onboarding`) — 3 steps: persona, first API key, first request
- [ ] Forgot password / reset password

**Documentation:**
- [ ] Docs home (`/docs`) — with category cards
- [ ] Introduction (`/docs/introduction`)
- [ ] Authentication guide (`/docs/authentication`)
- [ ] Your first request (`/docs/your-first-request`)
- [ ] Rate limits (`/docs/rate-limits`)
- [ ] Errors reference (`/docs/errors`)
- [ ] Versioning (`/docs/versioning`)
- [ ] CBC Overview (`/docs/cbc-overview`)
- [ ] Grade levels (`/docs/grade-levels`)
- [ ] Competency strands (`/docs/competency-strands`)
- [ ] At least 3 complete API guides (Curriculum, Learner, AI Generation)
- [ ] JavaScript SDK guide (`/docs/sdks/javascript`)
- [ ] Python SDK guide (`/docs/sdks/python`)
- [ ] At least 2 complete quickstart guides

**API Reference:**
- [ ] Scalar integration live at `/api-reference`
- [ ] All endpoints documented in OpenAPI spec
- [ ] Try-it panel functional with sandbox
- [ ] Auth pre-fill for logged-in users

**Dashboard:**
- [ ] Dashboard overview (`/dashboard/overview`)
- [ ] API keys management (`/dashboard/api-keys`) — create, copy, revoke
- [ ] Usage metrics (`/dashboard/usage`) — request count, error rate
- [ ] Error logs (`/dashboard/logs`) — filterable, exportable
- [ ] Billing page (`/dashboard/billing`) — plan display, upgrade CTA

**Playground:**
- [ ] Playground (`/playground`) — no auth required, sandbox mode, request builder, response viewer

**Status:**
- [ ] Status page (`/status`) — real-time service health

**Utility:**
- [ ] 404 page (`/not-found`)
- [ ] 500 error page
- [ ] Search (command palette)
- [ ] Dark/light theme toggle

---

### SHOULD HAVE — High priority, ship in first 30 days if not at launch

- [ ] AI Studio (`/ai-studio`) — fully functional with all AI endpoints
- [ ] Knowledge Graph Explorer (`/ekg-explorer`) — live graph with real CBC data
- [ ] SDK pages (`/sdks`) — download links, version badges, changelogs
- [ ] Marketplace home (`/marketplace`) — browse and search
- [ ] Plugin detail page (`/marketplace/[slug]`)
- [ ] Webhooks management (`/dashboard/webhooks`)
- [ ] Projects (`/dashboard/projects`)
- [ ] Changelog (`/changelog`) — all versions
- [ ] Changelog version detail (`/changelog/[version]`)
- [ ] Community page (`/community`) — Discord embed + links
- [ ] Notification system (bell icon + dropdown)

---

### COULD HAVE — Ship in first 90 days

- [ ] Plugin submission flow (`/marketplace/submit`)
- [ ] Marketplace revenue dashboard (`/dashboard/marketplace/revenue`)
- [ ] Certification tracks (`/certification`)
- [ ] Roadmap page (`/roadmap`) — with voting
- [ ] RFC listing (`/rfcs`) and detail pages
- [ ] CLI documentation (`/cli`)
- [ ] Team management (`/dashboard/team`)
- [ ] OAuth Apps management
- [ ] Analytics deep-dive — per-endpoint charts, latency distributions
- [ ] Request replay (replay a logged request from error logs)
- [ ] Webhook delivery log with resend capability

---

### FUTURE — Post-v1 roadmap

- [ ] Swahili language support
- [ ] In-app AI assistant ("Ask the docs")
- [ ] Collaborative workspaces (shared projects, shared API keys)
- [ ] Advanced EKG Explorer — custom graph queries, path finding UI
- [ ] Certification exam delivery system
- [ ] Developer program (revenue sharing, co-marketing)
- [ ] Enterprise SSO (SAML, OIDC)
- [ ] Multi-region data residency settings
- [ ] GraphQL API surface
- [ ] Developer advocacy portal (content, grants, events)
- [ ] Mobile SDK documentation (iOS, Android)
- [ ] Plugin IDE extension (VS Code extension for plugin development)

---

## Launch Readiness Criteria

Before the portal goes public:

**Functionality:**
- [ ] All "Must Have" screens pass manual QA on Chrome, Firefox, Safari, and mobile Chrome
- [ ] All "Must Have" screens pass automated accessibility audit (axe-core — zero critical violations)
- [ ] Performance: Lighthouse score ≥ 90 on Home, Docs, and Dashboard Overview
- [ ] Search returns relevant results for: "authentication," "lesson plan," "grade 8," "webhook"
- [ ] Sandbox API is operational and returns real responses for all documented endpoints
- [ ] At least 5 complete, tested quickstart guides exist

**Developer Experience:**
- [ ] Time from sign-up to first successful API call is < 15 minutes (tested by 3 external developers)
- [ ] TypeScript SDK is published to npm and installable
- [ ] Python SDK is published to PyPI and installable
- [ ] Postman collection is downloadable and importable
- [ ] OpenAPI spec is downloadable and valid (passes OpenAPI 3.1 validation)

**Operations:**
- [ ] Status page is live and connected to real uptime monitoring
- [ ] Error monitoring (Sentry or equivalent) is active
- [ ] Analytics (portal usage, not learner data) is active
- [ ] Support channel (Discord + email) is staffed and responsive
- [ ] Developer-facing incident communication process is documented

---

> *developers.edunexus.co.ke is not documentation about EduNexus. It is the operating system through which developers build on Educational Intelligence.*

---

**Document Control**

| Field | Value |
|-------|-------|
| Title | EduNexus Developer Portal — UI & Product Blueprint |
| Version | 1.0 |
| Status | Implementation-Ready |
| Date | 2026 |
| Owner | Product Engineering |
| Stack | Next.js 16 · Tailwind · shadcn/ui · Motion · Cytoscape.js · Monaco · TanStack Query · Fumadocs · Scalar |
| Location | `docs/developer-portal-ui-blueprint.md` |

*This document is the authoritative specification for the developer portal UI. Frontend engineers begin implementation from this document. Changes to this document require a product review.*

---

*End of EduNexus Developer Portal UI & Product Blueprint.*
