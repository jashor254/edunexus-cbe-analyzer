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
