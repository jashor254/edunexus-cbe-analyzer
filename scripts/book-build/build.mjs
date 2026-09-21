// Build pipeline: frozen Markdown manuscript -> assembled HTML -> print-quality PDF.
//
// Pipeline choice (see publication-artifact report for the full rationale):
// marked (Markdown -> HTML) -> Paged.js (via pagedjs-cli's Printer, used as a
// library — see render.mjs) for CSS Paged Media pagination (running headers,
// page counters, generated TOC page numbers) -> Chromium print-to-pdf ->
// pdf-lib passes for PDF Info metadata, real link annotations, and a bookmark
// outline (render.mjs reconstructs the latter two directly from the rendered
// DOM, because Chromium's print-to-pdf silently drops link annotations for
// anything laid out inside Paged.js's paginated page fragments).
//
// No LaTeX/TeX Live install was introduced: this repo already has Google Chrome
// and Node, so the HTML/CSS route reuses what's present instead of installing a
// multi-hundred-MB TeX toolchain for a single 33k-word manuscript.

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { metadata } from "./metadata.mjs";
import { renderWithLinks } from "./render.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const MANUSCRIPT_DIR = path.join(
  REPO_ROOT,
  "docs/manuscript/engineering-educational-intelligence"
);
const DIST_DIR = path.join(MANUSCRIPT_DIR, "dist");

const CHAPTER_FILES = [
  { file: "00-preface.md", kicker: null, css: "preface" },
  { file: "01-chapter-1-learning-is-not-data.md", kicker: "Chapter One" },
  {
    file: "02-chapter-2-architecture-of-educational-intelligence.md",
    kicker: "Chapter Two",
  },
  { file: "03-chapter-3-the-reasoning-engine.md", kicker: "Chapter Three" },
  { file: "04-chapter-4-computational-intelligence.md", kicker: "Chapter Four" },
  { file: "05-chapter-5-operational-architecture.md", kicker: "Chapter Five" },
  { file: "06-chapter-6-the-institution.md", kicker: "Chapter Six" },
];

const usedSlugs = new Map();
function slugify(text) {
  const base = text
    .toLowerCase()
    .replace(/[*_`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const count = usedSlugs.get(base) ?? 0;
  usedSlugs.set(base, count + 1);
  // Prefix with a letter: CSS id selectors (used by pagedjs-cli's
  // target-counter/querySelector for TOC page numbers) are invalid if they
  // start with a digit, and several headings here start with "1.1", "2.4", etc.
  const slug = count === 0 ? base : `${base}-${count}`;
  return `sec-${slug}`;
}

function makeMarked() {
  const marked = new Marked();
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = tokens.map((t) => t.raw ?? "").join("");
        const id = slugify(plain || text);
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
    },
  });
  return marked;
}

/** Split front-matter.md into named sections keyed by their "## Heading" text. */
function splitFrontMatterSections(raw) {
  const sections = {};
  const parts = raw.split(/^## (.+)$/m);
  // parts[0] is preamble before the first "## "; subsequent entries alternate
  // [heading, body, heading, body, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].trim();
    const body = parts[i + 1] ?? "";
    sections[heading] = body.replace(/\n---\s*$/m, "").trim();
  }
  return sections;
}

// Bare, unlabeled ring standing in for the book's one recurring diagram, the
// six-station Educational Intelligence Loop (Evidence -> Projection ->
// Reasoning -> Recommendation -> Intervention -> Observation -> Evidence).
// Geometry only, on the cover — the labeled version appears inside the book.
const COVER_MARK_SVG = `<svg class="cover-mark" viewBox="0 0 200 200" fill="none" aria-hidden="true">
  <circle cx="100" cy="100" r="86" stroke="currentColor" stroke-width="0.6" opacity="0.4"/>
  <circle cx="100" cy="100" r="60" stroke="currentColor" stroke-width="0.4" opacity="0.25" stroke-dasharray="1 4"/>
</svg>`;

// ---------------------------------------------------------------------------
// Chapter Two opener diagram — the labeled six-station Educational
// Intelligence Loop, drawn as an architecture (bounded contexts, one-way
// dependency) rather than a circular process wheel. Interior-page only: uses
// the existing light-paper surface, plus the Design System's ink/brass as
// scoped literals (not the dark cover tokens — the interior stays locked to
// light paper).
//
// Bracket placement follows 2.1's own text, not an invented grouping: the
// Learner context "owns the accumulated evidence ... and the projections
// derived from it" (Evidence, Projection); the Reasoning context "owns the
// derived judgments ... recommendation, and eventually, intervention"
// (Reasoning, Recommendation, Intervention). Observation is deliberately left
// outside both brackets — Chapter 2 never assigns it a context, and what
// closes the loop through it is Chapter 3's argument (3.7, "Closing the
// Loop"), not this chapter's to spend.
const CH2_INK = "#0A0D12";
const CH2_BRASS = "#C09A48";
const CH2_PAPER = "#fefdfb"; // matches the interior page background exactly

function ch2CornerBrackets(x1, y1, x2, y2, len = 12) {
  const corners = [
    [x1 + len, y1, x1, y1, x1, y1 + len],
    [x2 - len, y1, x2, y1, x2, y1 + len],
    [x1 + len, y2, x1, y2, x1, y2 - len],
    [x2 - len, y2, x2, y2, x2, y2 - len],
  ];
  return corners
    .map(
      ([ax, ay, bx, by, cx, cy]) =>
        `<path d="M ${ax} ${ay} L ${bx} ${by} L ${cx} ${cy}" stroke="${CH2_BRASS}" stroke-width="1.1" fill="none"/>`
    )
    .join("\n    ");
}

function renderCh2Architecture() {
  const bracketLearner = ch2CornerBrackets(90, 70, 350, 160);
  const bracketReasoning = ch2CornerBrackets(505, 70, 575, 395);

  return `
<figure class="ch2-architecture">
  <svg viewBox="0 0 660 430" fill="none" role="img" aria-label="The six-station Educational Intelligence Loop: Evidence, Projection, Reasoning, Recommendation, Intervention, Observation, returning to Evidence.">
    <defs>
      <marker id="ch2arrow-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH2_INK}"/>
      </marker>
      <marker id="ch2arrow-brass" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH2_BRASS}"/>
      </marker>
    </defs>

    <!-- bounded-context brackets: secondary weight, brass, subordinate to the loop -->
    ${bracketLearner}
    ${bracketReasoning}
    <text x="220" y="58" text-anchor="middle" font-family="IBM Plex Sans, Noto Sans, sans-serif" font-size="9.5" letter-spacing="0.08em" fill="${CH2_BRASS}">LEARNER CONTEXT</text>
    <text x="540" y="58" text-anchor="middle" font-family="IBM Plex Sans, Noto Sans, sans-serif" font-size="9.5" letter-spacing="0.08em" fill="${CH2_BRASS}">REASONING CONTEXT</text>

    <!-- the loop itself: primary weight, ink -->
    <line x1="127" y1="120" x2="313" y2="120" stroke="${CH2_INK}" stroke-width="1.6" marker-end="url(#ch2arrow-ink)"/>
    <line x1="327" y1="120" x2="533" y2="120" stroke="${CH2_INK}" stroke-width="1.6" marker-end="url(#ch2arrow-ink)"/>
    <line x1="540" y1="127" x2="540" y2="233" stroke="${CH2_INK}" stroke-width="1.6" marker-end="url(#ch2arrow-ink)"/>
    <line x1="540" y1="247" x2="540" y2="353" stroke="${CH2_INK}" stroke-width="1.6" marker-end="url(#ch2arrow-ink)"/>
    <line x1="533" y1="360" x2="127" y2="360" stroke="${CH2_INK}" stroke-width="1.6" marker-end="url(#ch2arrow-ink)"/>
    <!-- revision: observation back to evidence — quaternary weight, brass, dashed, not yet closed by this chapter -->
    <path d="M 120 353 L 120 127" stroke="${CH2_BRASS}" stroke-width="1" stroke-dasharray="2 4" opacity="0.75" fill="none" marker-end="url(#ch2arrow-brass)"/>

    <!-- confidence: an edge attribute, never a station -->
    <text x="220" y="112" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="8.5" fill="${CH2_BRASS}" opacity="0.9">confidence-banded</text>
    <text x="55" y="244" text-anchor="middle" font-family="IBM Plex Mono, Fira Code, monospace" font-size="8" letter-spacing="0.06em" fill="${CH2_BRASS}" opacity="0.85">REVISION</text>

    <!-- stations: tertiary weight -->
    <g font-family="IBM Plex Mono, Fira Code, monospace" font-size="9.5" fill="${CH2_INK}">
      <circle cx="120" cy="120" r="6" fill="${CH2_PAPER}" stroke="${CH2_INK}" stroke-width="1.6"/>
      <text x="120" y="100" text-anchor="middle">EVIDENCE</text>

      <circle cx="320" cy="120" r="6" fill="${CH2_PAPER}" stroke="${CH2_INK}" stroke-width="1.6"/>
      <text x="320" y="100" text-anchor="middle">PROJECTION</text>

      <circle cx="540" cy="120" r="6" fill="${CH2_PAPER}" stroke="${CH2_INK}" stroke-width="1.6"/>
      <text x="540" y="100" text-anchor="middle">REASONING</text>

      <circle cx="540" cy="240" r="6" fill="${CH2_PAPER}" stroke="${CH2_INK}" stroke-width="1.6"/>
      <text x="495" y="236" text-anchor="end">RECOMMENDATION</text>

      <circle cx="540" cy="360" r="6" fill="${CH2_PAPER}" stroke="${CH2_INK}" stroke-width="1.6"/>
      <text x="495" y="348" text-anchor="end">INTERVENTION</text>

      <circle cx="120" cy="360" r="6" fill="${CH2_PAPER}" stroke="${CH2_INK}" stroke-width="1.6"/>
      <text x="120" y="386" text-anchor="middle">OBSERVATION</text>
    </g>
  </svg>
  <figcaption>Two of the six stations already belong to a named bounded context — Learner, and Reasoning. Observation, bottom left, is deliberately left outside either boundary: this chapter has not yet built what closes the loop.</figcaption>
</figure>`;
}

// ---------------------------------------------------------------------------
// Chapter Three opener diagram — "competing explanations" (3.4-3.5). Same
// Design System tokens as renderCh2Architecture() (ink/brass/paper), same
// station/label conventions, deliberately NOT the generic
// evidence->judgment->recommendation funnel a first pass might reach for:
// 3.4-3.5 explicitly reject collapsing to one ranked answer ("The correct
// discipline is to let more than one explanation remain live at once ...
// rather than forced into a single ranking that implies more certainty than
// exists"), and 3.5 has each recommendation candidate tied to its own
// hypothesis, banded no higher than that hypothesis, not merged into a
// single verdict. So the figure keeps three parallel lanes from evidence
// through to recommendation candidate, never converging.
//
// Line treatment is the only semantic device (per the brief): weight and
// dash carry evidential strength, brass stays structural. No red/green,
// no numeric confidence score.
//   - PREREQUISITE GAP: "one live possibility, and a well-supported one" ->
//     solid, primary weight.
//   - ATTENDANCE: "might show ... if the system tracks it" -> unconfirmed,
//     dashed.
//   - ASSESSMENT ARTIFACT: gated behind the Instrument Validity Gate, the
//     most provisional of the three -> dashed, lighter weight, lower opacity.
// Each recommendation-candidate edge repeats its hypothesis's exact
// treatment, visualizing 3.5's rule that a recommendation "can never carry a
// stronger confidence band than" what it depends on.
const CH3_INK = "#0A0D12";
const CH3_BRASS = "#C09A48";
const CH3_PAPER = "#fefdfb";

function renderCh3Reasoning() {
  return `
<figure class="ch3-reasoning">
  <svg viewBox="0 0 660 430" fill="none" role="img" aria-label="Evidence branching into three independently-banded live hypotheses about Daniel's decline, each carrying its own recommendation candidate rather than converging on one answer: prerequisite gap, well-supported; attendance, unconfirmed; assessment artifact, gated and provisional.">
    <defs>
      <marker id="ch3arrow-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH3_INK}"/>
      </marker>
      <marker id="ch3arrow-brass" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH3_BRASS}" opacity="0.8"/>
      </marker>
      <marker id="ch3arrow-brass-light" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH3_BRASS}" opacity="0.55"/>
      </marker>
    </defs>

    <text x="330" y="58" text-anchor="middle" font-family="IBM Plex Sans, Noto Sans, sans-serif" font-size="9.5" letter-spacing="0.08em" fill="${CH3_BRASS}">LIVE HYPOTHESES, INDEPENDENTLY BANDED</text>

    <!-- lane A: prerequisite gap -- well-supported, solid, primary weight -->
    <line x1="106" y1="140" x2="304" y2="100" stroke="${CH3_INK}" stroke-width="1.6" marker-end="url(#ch3arrow-ink)"/>
    <line x1="356" y1="100" x2="544" y2="100" stroke="${CH3_INK}" stroke-width="1.6" marker-end="url(#ch3arrow-ink)"/>

    <!-- lane B: attendance -- unconfirmed, dashed, mid weight -->
    <line x1="110" y1="215" x2="300" y2="215" stroke="${CH3_BRASS}" stroke-width="1" stroke-dasharray="2 4" opacity="0.75" marker-end="url(#ch3arrow-brass)"/>
    <line x1="356" y1="215" x2="544" y2="215" stroke="${CH3_BRASS}" stroke-width="1" stroke-dasharray="2 4" opacity="0.75" marker-end="url(#ch3arrow-brass)"/>

    <!-- lane C: assessment artifact -- gated, most provisional, lightest -->
    <line x1="106" y1="290" x2="304" y2="330" stroke="${CH3_BRASS}" stroke-width="0.7" stroke-dasharray="1 4" opacity="0.5" marker-end="url(#ch3arrow-brass-light)"/>
    <line x1="356" y1="330" x2="544" y2="330" stroke="${CH3_BRASS}" stroke-width="0.7" stroke-dasharray="1 4" opacity="0.5" marker-end="url(#ch3arrow-brass-light)"/>

    <text x="220" y="130" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="8" fill="${CH3_INK}" opacity="0.85">well-supported</text>
    <text x="220" y="208" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="8" fill="${CH3_BRASS}" opacity="0.85">unconfirmed</text>
    <text x="220" y="322" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="8" fill="${CH3_BRASS}" opacity="0.75">gated, provisional</text>

    <g font-family="IBM Plex Mono, Fira Code, monospace" font-size="9.5" fill="${CH3_INK}">
      <circle cx="90" cy="215" r="7" fill="${CH3_PAPER}" stroke="${CH3_INK}" stroke-width="1.6"/>
      <text x="90" y="242" text-anchor="middle">EVIDENCE</text>

      <circle cx="330" cy="100" r="6" fill="${CH3_PAPER}" stroke="${CH3_INK}" stroke-width="1.6"/>
      <text x="330" y="82" text-anchor="middle">PREREQUISITE GAP</text>

      <circle cx="330" cy="215" r="6" fill="${CH3_PAPER}" stroke="${CH3_BRASS}" stroke-width="1.1"/>
      <text x="330" y="197" text-anchor="middle">ATTENDANCE</text>

      <circle cx="330" cy="330" r="6" fill="${CH3_PAPER}" stroke="${CH3_BRASS}" stroke-width="0.8" opacity="0.85"/>
      <text x="330" y="350" text-anchor="middle">ASSESSMENT ARTIFACT</text>

      <circle cx="560" cy="100" r="6" fill="${CH3_PAPER}" stroke="${CH3_INK}" stroke-width="1.6"/>
      <text x="560" y="82" text-anchor="middle" font-size="8.5">REMEDIATE FLUENCY</text>

      <circle cx="560" cy="215" r="6" fill="${CH3_PAPER}" stroke="${CH3_BRASS}" stroke-width="1.1"/>
      <text x="560" y="197" text-anchor="middle" font-size="8.5">REVIEW ATTENDANCE</text>

      <circle cx="560" cy="330" r="6" fill="${CH3_PAPER}" stroke="${CH3_BRASS}" stroke-width="0.8" opacity="0.85">
      </circle>
      <text x="560" y="350" text-anchor="middle" font-size="8.5">CHECK CALIBRATION</text>
    </g>

    <text x="560" y="58" text-anchor="middle" font-family="IBM Plex Sans, Noto Sans, sans-serif" font-size="9.5" letter-spacing="0.08em" fill="${CH3_BRASS}">RECOMMENDATION CANDIDATES</text>
  </svg>
  <figcaption>Three live explanations for Daniel's decline, each independently banded and each carrying its own recommendation candidate — not ranked, not merged into one verdict. Line weight marks evidential support; dashed lines mark what remains unconfirmed. The set narrows only as evidence, not convenience, rules an explanation out (3.4).</figcaption>
</figure>`;
}

// ---------------------------------------------------------------------------
// Chapter Four opener diagram — classical computation as backbone, the
// language model as a small, bounded, supervised component. Same Design
// System tokens as renderCh2Architecture() / renderCh3Reasoning(); reuses
// ch2CornerBrackets() for the one boundary this figure actually draws.
//
// Deliberately NOT a funnel with the LLM at its center: 4.6 ("Hybrid
// Educational Intelligence") is explicit that "classical computation remains
// the backbone, unchanged by anything in this chapter," and that the model
// is "invited in only at the two seams classical computation cannot close on
// its own." So the classical stations (evidence log, curriculum graph,
// confidence band, reasoning) get no bounding box at all — they are the
// ambient architecture, not a boundary that needs justifying — while the
// language model sits inside the one boundary this chapter actually draws,
// labeled SUPERVISED, deliberately smaller and visually subordinate.
//
// The two seams, drawn as the only two edges that touch the supervised
// boundary, are the two 4.6 actually names, not a generic input/output pair:
//   1. A free-text note (ambiguous, not yet evidence) enters the model and
//      leaves as a CANDIDATE — "not a claim, not evidence yet" — which
//      re-enters the evidence log gated at the fixed, lowest source-
//      reliability tier 4.6 assigns an "AI-inferred signal." Dashed, brass,
//      low opacity: the same "uncertain" treatment Chapter 3 already
//      established, at its lightest weight.
//   2. An already-banded claim leaves REASONING for the model and returns as
//      hedged language: "The model chooses words. It does not choose
//      certainty." Solid, brass, because the band itself is already fixed
//      before translation — this edge carries no new uncertainty, only a
//      change of register — deliberately distinct from the dashed candidate
//      edge so the same brass color cannot be misread as meaning the same
//      thing twice.
// A third, quiet-grey edge (not ink, not brass — a token this figure alone
// introduces, for raw unstructured input that is neither evidence nor a
// structural relationship yet) carries the free-text note itself, before the
// model has done anything with it.
const CH4_INK = "#0A0D12";
const CH4_BRASS = "#C09A48";
const CH4_PAPER = "#fefdfb";
const CH4_GREY = "#616B7A";

function renderCh4Computation() {
  const supervisedBracket = ch2CornerBrackets(458, 150, 602, 256);

  return `
<figure class="ch4-computation">
  <svg viewBox="0 0 660 430" fill="none" role="img" aria-label="Classical computation — evidence log, curriculum graph, confidence band, reasoning — as the unbounded backbone, with a language model confined to a small supervised boundary, entered only to turn a free-text note into a low-tier candidate and to translate an already-banded claim into hedged language.">
    <defs>
      <marker id="ch4arrow-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH4_INK}"/>
      </marker>
      <marker id="ch4arrow-brass" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH4_BRASS}"/>
      </marker>
      <marker id="ch4arrow-brass-light" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH4_BRASS}" opacity="0.55"/>
      </marker>
      <marker id="ch4arrow-grey" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH4_GREY}"/>
      </marker>
    </defs>

    <text x="330" y="30" text-anchor="middle" font-family="IBM Plex Sans, Noto Sans, sans-serif" font-size="9.5" letter-spacing="0.08em" fill="${CH4_BRASS}">EDUCATIONAL INTELLIGENCE ARCHITECTURE</text>
    <text x="218" y="60" text-anchor="middle" font-family="IBM Plex Sans, Noto Sans, sans-serif" font-size="8.5" letter-spacing="0.06em" fill="${CH4_BRASS}" opacity="0.9">CLASSICAL COMPUTATION — THE BACKBONE</text>

    <!-- classical backbone: no boundary of its own, primary weight, ink -->
    <line x1="112" y1="141" x2="207" y2="102" stroke="${CH4_INK}" stroke-width="1.6" marker-end="url(#ch4arrow-ink)"/>
    <line x1="232" y1="102" x2="327" y2="141" stroke="${CH4_INK}" stroke-width="1.6" marker-end="url(#ch4arrow-ink)"/>
    <line x1="106" y1="163" x2="213" y2="228" stroke="${CH4_INK}" stroke-width="1.6" marker-end="url(#ch4arrow-ink)"/>
    <line x1="334" y1="163" x2="227" y2="228" stroke="${CH4_INK}" stroke-width="1.6" marker-end="url(#ch4arrow-ink)"/>
    <text x="220" y="178" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="7.8" fill="${CH4_INK}" opacity="0.7">deterministic, reproducible</text>

    <g font-family="IBM Plex Mono, Fira Code, monospace" font-size="8.5" fill="${CH4_INK}">
      <circle cx="100" cy="150" r="6" fill="${CH4_PAPER}" stroke="${CH4_INK}" stroke-width="1.6"/>
      <text x="80" y="153" text-anchor="end">EVIDENCE LOG</text>

      <circle cx="220" cy="100" r="6" fill="${CH4_PAPER}" stroke="${CH4_INK}" stroke-width="1.6"/>
      <text x="220" y="86" text-anchor="middle">CURRICULUM GRAPH</text>

      <circle cx="340" cy="150" r="6" fill="${CH4_PAPER}" stroke="${CH4_INK}" stroke-width="1.6"/>
      <text x="360" y="153" text-anchor="start">CONFIDENCE BAND</text>

      <circle cx="220" cy="235" r="6" fill="${CH4_PAPER}" stroke="${CH4_INK}" stroke-width="1.6"/>
      <text x="220" y="258" text-anchor="middle">REASONING</text>
    </g>

    <!-- the one boundary this figure draws: small, subordinate, labeled -->
    ${supervisedBracket}
    <text x="530" y="138" text-anchor="middle" font-family="IBM Plex Sans, Noto Sans, sans-serif" font-size="9" letter-spacing="0.09em" fill="${CH4_BRASS}">SUPERVISED</text>
    <circle cx="530" cy="202" r="5" fill="${CH4_PAPER}" stroke="${CH4_INK}" stroke-width="1.1"/>
    <text x="530" y="222" text-anchor="middle" font-family="IBM Plex Mono, Fira Code, monospace" font-size="8" fill="${CH4_INK}">LANGUAGE MODEL</text>

    <!-- seam 1, upper band: free-text note -> model -> candidate, gated back in at the lowest tier -->
    <circle cx="618" cy="76" r="5" fill="${CH4_PAPER}" stroke="${CH4_GREY}" stroke-width="1.1"/>
    <text x="618" y="60" text-anchor="middle" font-family="IBM Plex Mono, Fira Code, monospace" font-size="7.6" fill="${CH4_GREY}">FREE-TEXT NOTE</text>
    <line x1="608" y1="90" x2="548" y2="180" stroke="${CH4_GREY}" stroke-width="1" stroke-dasharray="2 3" marker-end="url(#ch4arrow-grey)"/>
    <text x="655" y="128" text-anchor="end" font-style="italic" font-family="Noto Serif, serif" font-size="7.4" fill="${CH4_GREY}">ambiguous,</text>
    <text x="655" y="139" text-anchor="end" font-style="italic" font-family="Noto Serif, serif" font-size="7.4" fill="${CH4_GREY}">not yet evidence</text>

    <!-- seam 2, middle band: already-banded claim -> model -> hedged language -->
    <line x1="227" y1="223" x2="509" y2="209" stroke="${CH4_BRASS}" stroke-width="1" marker-end="url(#ch4arrow-brass)"/>
    <text x="370" y="204" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="7.6" fill="${CH4_BRASS}">already-banded claim</text>

    <line x1="548" y1="214" x2="592" y2="320" stroke="${CH4_BRASS}" stroke-width="1" marker-end="url(#ch4arrow-brass)"/>
    <text x="604" y="270" text-anchor="start" font-style="italic" font-family="Noto Serif, serif" font-size="7.6" fill="${CH4_BRASS}">hedged</text>
    <text x="604" y="281" text-anchor="start" font-style="italic" font-family="Noto Serif, serif" font-size="7.6" fill="${CH4_BRASS}">language</text>

    <!-- lower band: candidate re-entering the evidence log, gated at the lowest tier -->
    <path d="M 508 222 C 400 305, 230 300, 108 168" stroke="${CH4_BRASS}" stroke-width="0.7" stroke-dasharray="1 4" opacity="0.55" fill="none" marker-end="url(#ch4arrow-brass-light)"/>
    <text x="300" y="308" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="7.6" fill="${CH4_BRASS}" opacity="0.85">candidate — lowest source-reliability tier</text>

    <circle cx="600" cy="345" r="6" fill="${CH4_PAPER}" stroke="${CH4_INK}" stroke-width="1.6"/>
    <text x="600" y="369" text-anchor="middle" font-family="IBM Plex Mono, Fira Code, monospace" font-size="8.5" fill="${CH4_INK}">TEACHER DECIDES</text>
    <text x="600" y="384" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="7.6" fill="${CH4_BRASS}" opacity="0.85">accountability, not computation</text>
  </svg>
  <figcaption>Classical computation is the backbone, unbounded, unchanged by this chapter — evidence, curriculum structure, confidence, and the rule-governed core of reasoning stay deterministic. The language model works only inside the one boundary drawn here, entered at exactly two seams: a free-text note becomes a candidate, gated at the lowest source-reliability tier, never trusted as evidence outright; and an already-banded claim is translated into hedged language, its confidence fixed before the model ever sees it. It chooses words. It does not choose certainty (4.6).</figcaption>
</figure>`;
}

// ---------------------------------------------------------------------------
// Chapter Five opener diagram — the architecture on a time axis, not a
// redrawn version of Chapter 2's loop. Same Design System tokens as
// renderCh2/3/4; grounded directly in 5.2-5.7 rather than a generic
// event-driven-architecture template. No LLM appears — this chapter's
// argument (operational reliability over time) does not need one, and
// Chapter 4's model boundary is not this figure's to touch.
//
// What each element cites:
//   - PROJECTION reachable only through EVIDENCE EVENT, never independently:
//     5.2 ("An observation was recorded; something needed to react").
//   - REASONING's edge starts at PROJECTION, not at the evidence event
//     directly, and only after it: 5.4's ordering argument — "only after
//     that projection reflects the new evidence should the Reasoning context
//     reconsider a hypothesis." No orchestrator box is drawn; the dependency
//     is shown structurally, by what an edge starts from, exactly because 5.4
//     insists orchestration is "not a seventh context with its own truth to
//     protect."
//   - The two source-timing annotations (seconds / recorded days later) are
//     5.6's own examples, not invented ones.
//   - The interrupted-then-retried edge into PROJECTION is 5.7's own worked
//     failure: "the event announcing it is lost before the Learner context's
//     projection ever reacts to it ... evidence sits, technically present in
//     the log, and functionally invisible." Drawn as a cut line with a visible
//     gap, then a lighter, later brass recovery — never red, never a status
//     icon, per the book's confidence/failure grammar already locked in
//     Chapters 2-4.
//   - REASONING -> OBSERVATION is deliberately labeled as passing through
//     recommendation and intervention rather than redrawing them (5.10 ties
//     back to the Chapter 2/3 loop without re-owning it), and OBSERVATION's
//     trailing edge does not close back to the first EVIDENCE EVENT the way
//     Chapter 2's loop closes — it continues past the frame, because 5.1's
//     entire point is that this "has to keep turning ... continuously,
//     without being asked," not complete one cycle and stop.
const CH5_INK = "#0A0D12";
const CH5_BRASS = "#C09A48";
const CH5_PAPER = "#fefdfb";
const CH5_GREY = "#616B7A";

function renderCh5Operational() {
  const projectionService = ch2CornerBrackets(238, 182, 284, 200, 6);
  const reasoningService = ch2CornerBrackets(378, 140, 424, 158, 6);

  return `
<figure class="ch5-operational">
  <svg viewBox="0 0 660 440" fill="none" role="img" aria-label="A time axis showing evidence becoming an event, a projection continuously recomputed, reasoning reacting only after the projection completes, a delayed evidence event whose announcement is lost and later retried, and observation continuing forward into new evidence rather than closing a loop.">
    <defs>
      <marker id="ch5arrow-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH5_INK}"/>
      </marker>
      <marker id="ch5arrow-brass" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH5_BRASS}"/>
      </marker>
      <marker id="ch5arrow-brass-light" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH5_BRASS}" opacity="0.6"/>
      </marker>
    </defs>

    <text x="330" y="28" text-anchor="middle" font-family="IBM Plex Sans, Noto Sans, sans-serif" font-size="9.5" letter-spacing="0.08em" fill="${CH5_BRASS}">THE ARCHITECTURE IN OPERATION</text>

    <!-- time axis -->
    <line x1="60" y1="250" x2="615" y2="250" stroke="${CH5_INK}" stroke-width="1" opacity="0.5"/>
    <line x1="110" y1="246" x2="110" y2="254" stroke="${CH5_INK}" stroke-width="1" opacity="0.6"/>
    <line x1="260" y1="246" x2="260" y2="254" stroke="${CH5_INK}" stroke-width="1" opacity="0.6"/>
    <line x1="400" y1="246" x2="400" y2="254" stroke="${CH5_INK}" stroke-width="1" opacity="0.6"/>
    <line x1="540" y1="246" x2="540" y2="254" stroke="${CH5_INK}" stroke-width="1" opacity="0.6"/>
    <g font-family="IBM Plex Mono, Fira Code, monospace" font-size="8" fill="${CH5_INK}" opacity="0.6">
      <text x="110" y="267" text-anchor="middle">t&#8320;</text>
      <text x="260" y="267" text-anchor="middle">t&#8321;</text>
      <text x="400" y="267" text-anchor="middle">t&#8322;</text>
      <text x="540" y="267" text-anchor="middle">t&#8323;</text>
    </g>

    <!-- t0: evidence arrives promptly, becomes an event -->
    <circle cx="110" cy="250" r="6" fill="${CH5_PAPER}" stroke="${CH5_INK}" stroke-width="1.6"/>
    <text x="110" y="232" text-anchor="middle" font-family="IBM Plex Mono, Fira Code, monospace" font-size="8.5" fill="${CH5_INK}">EVIDENCE EVENT</text>
    <text x="110" y="288" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="7.6" fill="${CH5_GREY}">digital quiz — seconds</text>

    <line x1="116" y1="241" x2="250" y2="179" stroke="${CH5_INK}" stroke-width="1.6" marker-end="url(#ch5arrow-ink)"/>
    <text x="165" y="200" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="7.6" fill="${CH5_INK}" opacity="0.75">continuously recomputed</text>

    <!-- t1: projection, a living representation, not a station evidence merely visits -->
    ${projectionService}
    <circle cx="260" cy="170" r="6" fill="${CH5_PAPER}" stroke="${CH5_INK}" stroke-width="1.6"/>
    <text x="260" y="152" text-anchor="middle" font-family="IBM Plex Mono, Fira Code, monospace" font-size="8.5" fill="${CH5_INK}">PROJECTION</text>

    <line x1="270" y1="163" x2="390" y2="135" stroke="${CH5_INK}" stroke-width="1.6" marker-end="url(#ch5arrow-ink)"/>
    <text x="352" y="164" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="7.4" fill="${CH5_BRASS}">only once projection completes</text>

    <!-- t2: reasoning reacts, but only after projection, never in parallel with it -->
    ${reasoningService}
    <circle cx="400" cy="128" r="6" fill="${CH5_PAPER}" stroke="${CH5_INK}" stroke-width="1.6"/>
    <text x="400" y="110" text-anchor="middle" font-family="IBM Plex Mono, Fira Code, monospace" font-size="8.5" fill="${CH5_INK}">REASONING</text>

    <line x1="416" y1="124" x2="524" y2="108" stroke="${CH5_BRASS}" stroke-width="1" marker-end="url(#ch5arrow-brass)"/>
    <text x="470" y="98" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="7.2" fill="${CH5_BRASS}">recommendation, intervention (Ch. 2-3)</text>

    <!-- t3: observation, continuing forward rather than closing the loop -->
    <circle cx="540" cy="105" r="6" fill="${CH5_PAPER}" stroke="${CH5_INK}" stroke-width="1.6"/>
    <text x="540" y="87" text-anchor="middle" font-family="IBM Plex Mono, Fira Code, monospace" font-size="8.5" fill="${CH5_INK}">OBSERVATION</text>
    <path d="M 547 109 C 580 128, 602 158, 611 188" stroke="${CH5_BRASS}" stroke-width="1" stroke-dasharray="2 3" fill="none" marker-end="url(#ch5arrow-brass)"/>
    <text x="614" y="205" text-anchor="start" font-style="italic" font-family="Noto Serif, serif" font-size="7.6" fill="${CH5_BRASS}" opacity="0.9">new</text>
    <text x="614" y="216" text-anchor="start" font-style="italic" font-family="Noto Serif, serif" font-size="7.6" fill="${CH5_BRASS}" opacity="0.9">evidence</text>

    <!-- a second, delayed evidence event: recorded well after it happened -->
    <circle cx="400" cy="250" r="6" fill="${CH5_PAPER}" stroke="${CH5_GREY}" stroke-width="1.3"/>
    <text x="400" y="290" text-anchor="middle" font-family="IBM Plex Mono, Fira Code, monospace" font-size="8" fill="${CH5_GREY}">EVIDENCE EVENT, DELAYED</text>
    <text x="400" y="303" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="7.6" fill="${CH5_GREY}">paper assessment — recorded days later</text>

    <!-- its announcement is lost before projection reacts: a visible gap, not a red icon -->
    <path d="M 396 244 L 358 212" stroke="${CH5_GREY}" stroke-width="1" stroke-dasharray="2 3" fill="none"/>
    <g stroke="${CH5_INK}" stroke-width="1" opacity="0.7">
      <line x1="340" y1="203" x2="348" y2="193" />
      <line x1="348" y1="203" x2="356" y2="193" />
    </g>
    <text x="380" y="228" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="7.2" fill="${CH5_GREY}">event lost</text>
    <path d="M 330 190 C 300 165, 278 158, 266 172" stroke="${CH5_BRASS}" stroke-width="0.8" stroke-dasharray="1 4" opacity="0.65" fill="none" marker-end="url(#ch5arrow-brass-light)"/>
    <text x="278" y="214" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="7.2" fill="${CH5_BRASS}" opacity="0.9">retried, resolved late</text>
  </svg>
  <figcaption>Evidence becomes an event the instant it is recorded, whether or not anyone asks — the projection it feeds is continuously recomputed, never merely capable of being rebuilt on request. Reasoning's own reaction begins only once that projection has actually completed, not beside it: orchestration is this ordering, not a seventh context. Evidence arrives unevenly — a delayed assessment can lose its event before a projection ever reacts to it, and reliability means that loss stays visible and is retried, never silently absorbed. Observation does not close the loop; it continues it, into evidence the system has not received yet (5.1-5.7).</figcaption>
</figure>`;
}

// ---------------------------------------------------------------------------
// Chapter Six opener — deliberately not another architecture diagram. This
// chapter's own argument (6.1) is that the machinery built in Chapters 2-5
// changes nothing about Daniel directly; it only changes what an institution
// is told, and everything downstream depends on what the institution chooses
// to do with that honesty. The figure has to read as editorial/typographic
// rather than technical for exactly that reason — a system diagram here
// would visually contradict the chapter's claim that the engineering is
// finished and what remains is a question of institutional posture.
//
// The four rows are 6.2-6.5's own transformations, in the chapter's own
// order and wording, not an invented taxonomy. Hierarchy between source and
// destination term is carried only by type (quiet sans vs. bold serif,
// matching this book's own h1 treatment) and by ink density (grey vs. full
// ink) — never by colour-as-verdict, per the book's locked rule that brass
// marks structure, not correctness. The small brass arrow between each pair
// is the only brass in a row; it marks a transformation, not an improvement
// score.
//
// PREDICTION -> CONTINUAL REVISION carries a small open-loop glyph (↺)
// immediately after it — the one row where 6.4 is explicit that the
// destination is not a settled state ("a claim that is never allowed to
// strengthen past what current evidence justifies is equally never allowed
// to calcify"). No other row gets this mark; revision is not the same claim
// as evidence or understanding, and treating all four destinations as
// equally "finished" would misstate 6.4 specifically.
//
// EVIDENCE, beneath all four rows rather than as a fifth row, makes 6.1's own
// point structural: the four are not separate instruments, they are one
// shift in what the same evidentiary record is read for. The small learner
// mark beneath that is the chapter's own closing
// image (6.10-6.11) — knowing a learner as "a standing relationship with
// evidence," never a completed file — kept to a single unlabeled circle, not
// an icon of a person.
const CH6_INK = "#0A0D12";
const CH6_BRASS = "#C09A48";
const CH6_PAPER = "#fefdfb";
const CH6_GREY = "#616B7A";

function renderCh6Institution() {
  // The "ranking -> understanding" row alone carries a question-level gloss
  // (6.5's own contrast: "where they stand relative to everyone else" versus
  // "what is specifically true of this learner's own progress"), because
  // it's the one pair in this figure where the destination term on its own
  // could read as a value judgment ("understanding" sounds simply nicer than
  // "ranking") rather than a different, harder question — which is exactly
  // 6.5's point: "The point is not ranking is bad. It answers a narrower
  // question than the one the architecture now equips a school to ask."
  // The other three rows don't get this treatment: it would turn one
  // clarifying device into a repeated four-row pattern, which is its own
  // kind of infographic.
  const rows = [
    { y: 130, source: "AVERAGE", dest: "Trajectory", revisable: false },
    { y: 210, source: "GRADE", dest: "Evidence", revisable: false },
    { y: 290, source: "PREDICTION", dest: "Continual Revision", revisable: true },
    {
      y: 370,
      source: "RANKING",
      dest: "Understanding",
      revisable: false,
      sourceQuestion: "where do they stand?",
      destQuestion: "what is actually true of their progress?",
    },
  ];

  // The open-loop mark (revision that never closes into a settled verdict)
  // is drawn as vector arc geometry, not the ↺ character — a literal text
  // glyph for ↺ (and, below, → for the row transform mark) isn't covered by
  // this book's embedded Noto Sans/Serif subsets, so Chromium silently
  // substitutes a fallback font for just those two characters. A short
  // brass arc with the same arrowhead marker used for the row transform
  // reads the same way (an unclosed loop) without leaving the book's own
  // typography.
  function revisionLoop(cx, cy, r) {
    const startX = cx;
    const startY = cy - r;
    const endX = cx - 0.9397 * r;
    const endY = cy - 0.342 * r;
    return `<path d="M ${startX} ${startY} A ${r} ${r} 0 1 1 ${endX} ${endY}" stroke="${CH6_BRASS}" stroke-width="1" fill="none" marker-end="url(#ch6arrow-brass)"/>`;
  }

  const rowsSvg = rows
    .map(
      ({ y, source, dest, revisable, sourceQuestion, destQuestion }) => `
    <line x1="105" y1="${y}" x2="119" y2="${y}" stroke="${CH6_BRASS}" stroke-width="1.1"/>
    <text x="134" y="${y - 3}" text-anchor="start" font-family="IBM Plex Sans, Noto Sans, sans-serif" font-size="10" letter-spacing="0.07em" fill="${CH6_GREY}">${source}</text>
    <line x1="230" y1="${y - 2}" x2="244" y2="${y - 2}" stroke="${CH6_BRASS}" stroke-width="1.1" marker-end="url(#ch6arrow-brass)"/>
    <text x="250" y="${y + 5}" text-anchor="start" font-family="Noto Serif, serif" font-weight="700" font-size="16" fill="${CH6_INK}">${dest}</text>${
        revisable ? `\n    ${revisionLoop(432, y - 5, 6.5)}` : ""
      }${
        sourceQuestion
          ? `
    <text x="134" y="${y + 17}" text-anchor="start" font-style="italic" font-family="Noto Serif, serif" font-size="7.6" fill="${CH6_GREY}" opacity="0.85">${sourceQuestion}</text>`
          : ""
      }${
        destQuestion
          ? `
    <text x="250" y="${y + 21}" text-anchor="start" font-style="italic" font-family="Noto Serif, serif" font-size="7.6" fill="${CH6_GREY}" opacity="0.85">${destQuestion}</text>`
          : ""
      }`
    )
    .join("\n");

  return `
<figure class="ch6-institution">
  <svg viewBox="0 0 660 522" fill="none" role="img" aria-label="Four transformations in what an institution treats as meaningful: average to trajectory, grade to evidence, prediction to continual revision, ranking to understanding — all resting on the same evidence, which itself exists only in relation to one learner.">
    <defs>
      <marker id="ch6arrow-brass" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10 z" fill="${CH6_BRASS}"/>
      </marker>
    </defs>

    <text x="330" y="34" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="11" fill="${CH6_GREY}">What an institution learns to ask</text>

    <line x1="110" y1="70" x2="110" y2="416" stroke="${CH6_BRASS}" stroke-width="1" opacity="0.75"/>
    ${rowsSvg}

    <line x1="70" y1="416" x2="590" y2="416" stroke="${CH6_BRASS}" stroke-width="1" opacity="0.7"/>
    <text x="330" y="437" text-anchor="middle" font-family="IBM Plex Sans, Noto Sans, sans-serif" font-size="9" letter-spacing="0.12em" fill="${CH6_BRASS}">EVIDENCE</text>
    <text x="330" y="452" text-anchor="middle" font-style="italic" font-family="Noto Serif, serif" font-size="8.5" fill="${CH6_GREY}">the same record, differently understood</text>

    <line x1="330" y1="461" x2="330" y2="478" stroke="${CH6_INK}" stroke-width="1" opacity="0.6"/>
    <circle cx="330" cy="485" r="4" fill="${CH6_PAPER}" stroke="${CH6_INK}" stroke-width="1.3"/>
    <text x="330" y="503" text-anchor="middle" font-family="IBM Plex Sans, Noto Sans, sans-serif" font-size="8" letter-spacing="0.1em" fill="${CH6_INK}" opacity="0.8">THE LEARNER</text>
  </svg>
  <figcaption>Four shifts in what an institution treats as meaningful — not four instruments, but one movement: the same evidence, read differently once a school stops mistaking compression for knowledge. Revision stays open by design, marked here rather than left to look finished like the other three. Ranking is not wrong so much as narrower: it answers where a learner stands, not what is actually true of their progress — the harder question the architecture now equips a school to ask (6.2-6.5, 6.10).</figcaption>
</figure>`;
}

function renderCoverPage() {
  return `
<section class="cover-page">
  ${COVER_MARK_SVG}
  <div class="cover-title">${metadata.title}</div>
  <div class="cover-rule"></div>
  <div class="cover-subtitle">${metadata.subtitle}</div>
  <div class="cover-author">${metadata.author}</div>
</section>`;
}

function renderHalfTitlePage() {
  return `
<section class="frontmatter-page halftitle-page">
  <div class="book-title">${metadata.title}</div>
</section>`;
}

function renderTitlePage() {
  return `
<section class="frontmatter-page title-page">
  <div class="book-title">${metadata.title}</div>
  <div class="book-subtitle">${metadata.subtitle}</div>
  <div class="book-author">${metadata.author}</div>
</section>`;
}

function renderCopyrightPage() {
  const isbnLine = metadata.isbn
    ? `<p>ISBN: ${metadata.isbn}${metadata.isbnFormat ? ` (${metadata.isbnFormat})` : ""}</p>`
    : ""; // Rule: never print "[pending]" or any placeholder in the artifact.

  return `
<section class="frontmatter-page copyright-page">
  <p class="cp-title">${metadata.title}</p>
  <p>Copyright &copy; ${metadata.year} ${metadata.author}</p>
  <p>All rights reserved. No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the copyright holder, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.</p>
  <p>This book is a work of engineering nonfiction. The systems, architectures, and case examples described are illustrative and, unless explicitly stated otherwise, do not describe any single named product, platform, or organization. Any resemblance to a specific commercial system is a description of a common pattern, not a claim about that system.</p>
  <p>Every effort has been made to ensure the accuracy of the information in this book at the time of publication. The author assumes no responsibility for errors, omissions, or for any outcomes resulting from the use of the information contained herein.</p>
  <p>${metadata.edition}, ${metadata.year}</p>
  ${isbnLine}
  <p>Published by ${metadata.publisher}<br>${metadata.website}</p>
</section>`;
}

const ABOUT_AUTHOR_ID = "sec-about-the-author";

function renderAboutAuthorPage(marked, aboutMarkdown) {
  // aboutMarkdown is the manuscript's own "About the Author" body (minus the
  // "Contact:" line, which we render separately using the approved config so the
  // email/website stay in one place).
  const bodyOnly = aboutMarkdown.replace(/^Contact:[\s\S]*$/m, "").trim();
  const html = marked.parse(bodyOnly);
  return `
<section class="frontmatter-page about-author-page">
  <h1 id="${ABOUT_AUTHOR_ID}">About the Author</h1>
  ${html}
  <div class="contact-block">
    <a href="mailto:${metadata.contactEmail}">${metadata.contactEmail}</a><br>
    <a href="https://${metadata.website}">${metadata.website}</a>
  </div>
</section>`;
}

function renderTocPage(headingIndex) {
  const items = headingIndex
    .map((h) => {
      const cls = h.depth === 1 ? "toc-chapter" : "toc-section";
      return `<li class="${cls}"><a href="#${h.id}"><span class="toc-title">${h.text}</span></a></li>`;
    })
    .join("\n");

  return `
<section class="toc-page">
  <h1>Contents</h1>
  <nav class="toc"><ul>
    ${items}
  </ul></nav>
</section>`;
}

async function main() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  const marked = makeMarked();

  const frontMatterRaw = await readFile(
    path.join(MANUSCRIPT_DIR, "front-matter.md"),
    "utf-8"
  );
  const fmSections = splitFrontMatterSections(frontMatterRaw);

  const headingIndex = [];
  const bodySections = [];

  for (const { file, kicker } of CHAPTER_FILES) {
    const raw = await readFile(path.join(MANUSCRIPT_DIR, file), "utf-8");
    const html = marked.parse(raw);

    // Extract the h1/h2 we just tagged with ids, in document order, for the TOC.
    const headingRe = /<h([12]) id="([^"]+)">(.*?)<\/h\1>/g;
    let match;
    while ((match = headingRe.exec(html))) {
      headingIndex.push({
        depth: Number(match[1]),
        id: match[2],
        text: match[3].replace(/<[^>]+>/g, ""),
      });
    }

    const isPreface = kicker === null;
    const sectionClass = isPreface ? "preface" : "chapter";
    const kickerHtml = kicker
      ? `<p class="chapter-kicker">${kicker}</p>`
      : "";
    // Chapter Two / Three / Four / Five / Six openers only. See
    // renderCh2Architecture(), renderCh3Reasoning(), renderCh4Computation(),
    // renderCh5Operational(), renderCh6Institution().
    const openerVisual =
      file === "02-chapter-2-architecture-of-educational-intelligence.md"
        ? renderCh2Architecture()
        : file === "03-chapter-3-the-reasoning-engine.md"
          ? renderCh3Reasoning()
          : file === "04-chapter-4-computational-intelligence.md"
            ? renderCh4Computation()
            : file === "05-chapter-5-operational-architecture.md"
              ? renderCh5Operational()
              : file === "06-chapter-6-the-institution.md"
                ? renderCh6Institution()
                : "";

    bodySections.push(`
<section class="${sectionClass}">
  <div class="${isPreface ? "preface-open" : "chapter-open"}">
    ${kickerHtml}
    ${html.replace(
      /<h1 id="([^"]+)">(.*?)<\/h1>/,
      `<h1 id="$1">$2</h1><div class="chapter-open-rule"></div>${openerVisual}`
    )}
  </div>
</section>`);
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${metadata.title}</title>
<link rel="stylesheet" href="style.css">
<style>
  /* Set on body (not a separate flow element) so it never occupies its own
     page before the cover: a standalone element assigned a named page value
     forces a page break, which produced a stray leading blank page 1. */
  body { string-set: book-title "${metadata.title}"; }
</style>
</head>
<body>
${renderCoverPage()}
${renderHalfTitlePage()}
${renderTitlePage()}
${renderCopyrightPage()}
${renderTocPage(headingIndex)}
${bodySections.join("\n")}
${renderAboutAuthorPage(marked, fmSections["About the Author"])}
</body>
</html>`;

  const htmlPath = path.join(DIST_DIR, "book.html");
  await writeFile(htmlPath, html, "utf-8");
  await writeFile(
    path.join(DIST_DIR, "style.css"),
    await readFile(path.join(__dirname, "style.css"), "utf-8"),
    "utf-8"
  );

  const pdfPath = path.join(
    DIST_DIR,
    "engineering-educational-intelligence.pdf"
  );

  // PUPPETEER_EXECUTABLE_PATH must be set in the environment *before* this
  // process starts (see package.json's book:pdf script) — puppeteer reads it
  // when the "pagedjs-cli" -> "puppeteer" module is first imported, which
  // happens at this file's top-level `import`, before any code here runs.

  // The outline includes About the Author (end matter) even though it is
  // deliberately absent from the printed Table of Contents — this only adds
  // an invisible PDF bookmark entry, it does not touch the visible page.
  const outlineHeadings = [
    ...headingIndex,
    { depth: 1, id: ABOUT_AUTHOR_ID, text: "About the Author" },
  ];

  console.log("- Rendering PDF (Paged.js) and reconstructing link annotations...");
  const { pdfDoc, stats } = await renderWithLinks(htmlPath, outlineHeadings);

  // Chromium's print-to-pdf does not expose PDF Info metadata (Title/Author/
  // Subject) through CSS/HTML, so set it directly on the generated file.
  pdfDoc.setTitle(metadata.title);
  pdfDoc.setAuthor(metadata.author);
  pdfDoc.setSubject(
    "An architecture for systems that reason about learner evidence, trajectory, and confidence."
  );
  pdfDoc.setProducer(`${metadata.publisher} book-build pipeline`);
  pdfDoc.setCreator(metadata.author);
  const finalBytes = await pdfDoc.save();
  await writeFile(pdfPath, finalBytes);

  console.log(`\nBuilt: ${pdfPath}`);
  console.log(`Pages: ${stats.totalPages}`);
  console.log(`Size: ${(finalBytes.length / 1024).toFixed(0)} KB`);
  console.log(`Internal (TOC) links: ${stats.internalLinks}`);
  console.log(`External links: ${stats.externalLinks}`);
  console.log(`Bookmarks: ${stats.bookmarks}`);
  console.log(`ISBN in artifact: ${metadata.isbn ?? "(omitted — none supplied)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
