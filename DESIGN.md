# EduNexus Design System

## Brand Identity
EduNexus is Kenya's AI-powered education 
platform. The design feels:
- Premium but warm
- Intelligent but approachable  
- Kenyan but world-class
- Dark, modern, trustworthy

## Color Palette

### Primary Colors
- Background: #020817 (slate-950) — deepest dark
- Surface: #0f172a (slate-900) — cards/panels
- Border: rgba(255,255,255,0.08) — subtle borders

### Accent Colors
- Amber/Gold: #f59e0b → #f97316 (amber-500 to orange-500)
  Used for: Learning Compass, CTAs, highlights
- Violet/Purple: #8b5cf6 → #ec4899 (violet-500 to pink-500)  
  Used for: Academic Clinic, branding
- Teal/Cyan: #14b8a6 → #06b6d4 (teal-500 to cyan-500)
  Used for: Teacher portal, trust signals
- Blue: #3b82f6 → #06b6d4 (blue-500 to cyan-500)
  Used for: IGCSE, information
- Green: #22c55e (green-500)
  Used for: Success, M-PESA, early access
- Red/Rose: #ef4444 → #f43f5e
  Used for: Alerts, warnings

### Semantic Colors
- Success: #22c55e
- Warning: #f59e0b  
- Error: #ef4444
- AI indicator: #8b5cf6

## Typography
- Font: System font stack (font-black for headings)
- Hero headings: text-5xl to text-8xl, font-black
- Section headings: text-3xl to text-6xl, font-black
- Body: text-lg to text-xl, text-white/60
- Micro: text-sm, text-white/40

## Spacing & Layout
- Max width: max-w-7xl mx-auto
- Section padding: py-20 to py-24
- Card padding: p-6 to p-8
- Border radius: rounded-2xl (cards), rounded-3xl (sections)
- Gap: gap-6 (grids)

## Component Patterns

### Cards
bg-white/5 border border-white/10 rounded-3xl
hover: bg-white/8 transition-all
glow: absolute -inset-0.5 bg-gradient blur opacity-20

### Buttons (Primary)
bg-gradient-to-r from-amber-500 to-orange-500
text-white px-8 py-4 rounded-2xl font-black
hover:scale-105 transition-all shadow-xl

### Buttons (Secondary)  
bg-white/5 border-2 border-white/10
hover:bg-white/10 transition-all

### Badges/Pills
bg-[color]/10 border border-[color]/20 
text-[color]-300 px-4 py-2 rounded-full
text-sm font-black

### Chat Bubbles (Student)
bg-white/10 border border-white/10 
rounded-2xl rounded-bl-sm

### Chat Bubbles (AI)
bg-gradient-to-r from-amber-500/30 to-orange-500/30
border border-amber-400/30
rounded-2xl rounded-br-sm

## Animation Patterns
- Entrance: animate-in fade-in slide-in-from-bottom duration-1000
- Hover scale: hover:scale-105 transition-all
- Pulse: animate-pulse (for live indicators)
- Ping: animate-ping (for status dots)

## Ambient Effects
- Gradient orbs: fixed, pointer-events-none
  purple top-left, blue bottom-right, amber center
- Grain texture: opacity-[0.02] overlay
- Backdrop blur: backdrop-blur-xl on sticky elements

## AI Branding Rules
- Always show: "AI-Powered" badge in violet
- Always show: "Parents in control" in green
- Never hide AI — transparency is the brand
- Use: Sparkles icon for AI features

## Avoiding the Generic "AI Slop" Aesthetic (research, 2026-07-27)

**Why this matters:** every AI-tooling default (v0, Lovable, Cursor scaffolds, ChatGPT-written
Tailwind) converges on the same look, because it's the statistical average of every dark-mode
AI-startup site made since 2023. That look now reads as *template*, not *premium*. An audit of
[app/(marketing)/page.tsx](app/(marketing)/page.tsx) against the current checklist for that look
found we hit nearly every marker:

| AI-slop tell | Found on our landing page |
|---|---|
| Indigo/violet→purple gradient as the signature color | Yes — hero gradient text, primary CTA gradient, violet default role/badge |
| Dark base (#0A0A0A–#1A1A2E) + translucent glass cards | Yes — `#020817` bg, `bg-white/5 border-white/10` on ~11 elements |
| Rounded-full pills everywhere (badges, filters, curriculum tags) | Yes — 18 occurrences of `rounded-full` |
| `hover:scale-105` gradient CTA buttons | Yes — 3 occurrences |
| Thin-line icon set (Lucide, generic across every AI product) | Yes — Lucide throughout |
| System/Inter-style font with no distinct headline system | Yes — no custom or distinctive type pairing |
| Weightless CTA copy ("Get Started", generic verbs) | Partially avoided — copy is more specific than most, keep this |

This isn't a criticism of the copy or IA (those are genuinely differentiated — role-based hero
variants, specific CBC/TSC language, evidence-first framing). It's that the *visual system* is
currently interchangeable with any dark-mode AI SaaS template, which undercuts a brand that wants
to feel "Kenyan but world-class" — nothing in the current palette or type is Kenyan; it's the
default palette of the tools that built it.

### What to change, in priority order

1. **Kill the violet/purple gradient as the default identity color.** Keep amber/gold (teacher),
   teal (family) — those already carry local, warm meaning per this doc's own Brand Identity
   section. Give the neutral/school-default state its own real color decision, not violet-by-default
   just because that's what AI page-builders reach for. Consider a color genuinely tied to Kenya
   (terracotta/ochre earth tones, savanna gold, deep forest green) instead of adding a fourth
   generic tech-purple to the existing amber/teal/violet/blue set.

2. **Replace the generic Lucide-icon-in-a-glass-card pattern with something illustrated or
   custom for the 3-4 highest-visibility moments** (hero, the three role cards, the evidence
   section). Doesn't need to be expensive — even simple custom line marks or a distinct icon
   family instantly breaks the "every AI product" fingerprint. Keep Lucide for utility chrome
   (nav, footer, form icons) where custom art isn't worth it.

3. **Get a real typographic system.** Currently system-font-stack + font-black everywhere is
   the "no decision was made" default. Pick one distinctive display face for H1/H2 (even a single
   licensed or Google Font used with intent) paired with a plain body face. This is the single
   highest-leverage, lowest-cost differentiator per current design research — typography reads as
   premium without needing new illustration or motion budget.

4. **Break the symmetry.** Replace at least the hero and one feature section from the standard
   centered-stack-of-rounded-cards layout with an asymmetric composition — off-center headline,
   overlapping real product screenshots instead of card grids, a diagonal or organic section
   break instead of a straight `py-24` band. One asymmetric moment above the fold does more for
   memorability than the rest of the page combined.

5. **Cut `rounded-full` pill overuse.** Not every badge/tag needs to be a pill — mix in
   underlines, small squares, or plain text labels with a colored dot. Reserve full-rounding for
   actual buttons.

6. **Ground it visibly in Kenya**, not just in the copy. Real teacher/student photography (even
   phone-shot, unpolished — that reads as *more* credible for a pioneer-stage platform, not less),
   a texture or motif drawn from local visual language, or county/school names used as concrete
   detail instead of generic "50+ pioneer teachers." Specificity beats polish for trust with this
   audience.

7. **Retire `hover:scale-105` as the universal hover state.** It's the default AI-template
   micro-interaction. A color/shadow shift or a more considered custom transition reads as more
   deliberate.

**What NOT to change:** the role-based hero copy variants, the evidence-first / "catch it early"
framing, and the CBC/TSC-specific trust signals — these are already the differentiated part of the
page. The fix here is entirely visual-system, not messaging.

Sources consulted: [925studios — AI Slop Design Tells](https://www.925studios.co/blog/ai-slop-design-tells),
[925studios — AI Slop Web Design Guide](https://www.925studios.co/blog/ai-slop-web-design-guide),
[Gezar — 11 Web Design Trends 2026](https://gezar.dk/en/blog/web-design-trends-2026).
