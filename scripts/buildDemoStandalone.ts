// scripts/buildDemoStandalone.ts
//
// Emits the /demo reviewer presentation as a single self-contained .html file
// that opens by double-clicking — no server, no network, no install. For
// handing the walkthrough to someone on a laptop, a USB stick, or an email.
//
// Content comes from lib/demo/presentation.ts, the same module the real route
// renders, so the offline copy cannot drift from the app's story or timings.
// The ~30 lines of autoplay logic below mirror lib/demo/presentationController.ts;
// that module stays the source of truth for the product route.
//
// Screenshots present in public/demo/google-africa/ are inlined as data URIs so
// the file stays portable. Missing ones render the same honest "Screen not
// attached" panel the route uses — no product UI is ever invented here either.
//
// Run: npx tsx scripts/buildDemoStandalone.ts [outputPath]

import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  DEMO_SLIDES,
  DEMO_ASSETS,
  DEMO_ASSET_DIR,
  DEMO_DATA_QUALIFIER,
  DEMO_LOOPS,
  type DemoSlide,
} from '../lib/demo/presentation'

const ASSET_ROOT = path.join(process.cwd(), 'public', DEMO_ASSET_DIR)

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function inlineAssets(): Promise<Record<string, string>> {
  const wanted = new Set<string>(Object.values(DEMO_ASSETS))
  const inlined: Record<string, string> = {}
  let entries: string[] = []
  try {
    entries = await readdir(ASSET_ROOT)
  } catch {
    return inlined
  }
  for (const entry of entries) {
    if (!wanted.has(entry)) continue
    const bytes = await readFile(path.join(ASSET_ROOT, entry))
    const mime = entry.endsWith('.jpg') || entry.endsWith('.jpeg') ? 'image/jpeg' : 'image/png'
    inlined[entry] = `data:${mime};base64,${bytes.toString('base64')}`
  }
  return inlined
}

function renderVisual(slide: DemoSlide, assets: Record<string, string>): string {
  const visual = slide.visual

  if (visual.kind === 'wordmark') return '<div class="rule"></div>'

  if (visual.kind === 'problem') {
    return `
      <div class="problem-grid">
        ${['Marks', 'Attendance', 'Reports'].map(i => `<div class="tile">${i}</div>`).join('')}
        <div class="tile tile-gold">Accumulated learner understanding</div>
      </div>`
  }

  if (visual.kind === 'loop') {
    const stages = [
      ['Evidence', 'What was actually recorded'],
      ['Understanding', 'What it means for this learner'],
      ['Teacher / Learner Action', 'A next step someone can take'],
      ['New Evidence', 'What the step leaves behind'],
    ]
    return `
      <div class="loop">
        ${stages
          .map(
            ([label, note], i) => `
          <div class="loop-stage">
            <span class="loop-label">${label}</span>
            <span class="loop-note">${note}</span>
          </div>
          ${i < stages.length - 1 ? '<span class="loop-arrow" aria-hidden="true">&rarr;</span>' : ''}`,
          )
          .join('')}
      </div>
      <p class="loop-return">Each step feeds the next round</p>`
  }

  if (visual.kind === 'closing') {
    return `
      <div class="closing">
        <div class="rule"></div>
        <p class="closing-name">EduNexus Kenya</p>
        <a class="closing-link" href="https://edunexus.co.ke">edunexus.co.ke</a>
      </div>`
  }

  const file = visual.asset ? DEMO_ASSETS[visual.asset] : null
  const alt = escapeHtml(visual.alt ?? slide.headline)
  const steps =
    visual.kind === 'workflow' && slide.points?.length
      ? `<ol class="steps">${slide.points
          .map(
            (s, i) =>
              `<li><span class="step">${escapeHtml(s)}</span>${
                i < slide.points!.length - 1 ? '<span class="step-arrow" aria-hidden="true">&rarr;</span>' : ''
              }</li>`,
          )
          .join('')}</ol>`
      : ''

  if (!file) return steps

  const src = assets[file]
  const screen = src
    ? `<figure class="shot"><img src="${src}" alt="${alt}"></figure>`
    : `<div class="shot shot-missing" role="img" aria-label="${alt} — screenshot not yet attached.">
         <p class="shot-title">Screen not attached</p>
         <p class="shot-alt">${alt}</p>
         <p class="shot-file">public/${DEMO_ASSET_DIR}/${file}</p>
       </div>`

  return steps + screen
}

function renderSlide(slide: DemoSlide, index: number, assets: Record<string, string>): string {
  const isTitle = slide.visual.kind === 'wordmark' || slide.visual.kind === 'closing'
  const listPoints =
    slide.points?.length && slide.visual.kind !== 'workflow'
      ? `<ul class="points">${slide.points.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
      : ''

  return `
  <section class="slide${isTitle ? ' slide-title' : ''}" data-index="${index}"
           aria-roledescription="slide"
           aria-label="${index + 1} of ${DEMO_SLIDES.length}: ${escapeHtml(slide.label)}"${
             index === 0 ? '' : ' hidden'
           }>
    <h2 class="${isTitle ? 'headline headline-lg' : 'headline'}">${escapeHtml(slide.headline)}</h2>
    ${slide.support ? `<p class="support">${escapeHtml(slide.support)}</p>` : ''}
    ${listPoints}
    <div class="visual">${renderVisual(slide, assets)}</div>
  </section>`
}

function renderHtml(assets: Record<string, string>): string {
  const durations = JSON.stringify(DEMO_SLIDES.map(s => s.durationMs))
  const loops = DEMO_LOOPS ? 'true' : 'false'
  const attached = Object.keys(assets).length

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>EduNexus — Educational Intelligence Demo</title>
<style>
  :root{
    --ink:#0b1220; --ink-soft:#131c2e; --paper:#f6f5f1;
    --muted:#a8b3c4; --muted-dim:#6f7d91;
    --teal:#00a896; --gold:#c8a45c;
    --line:rgba(255,255,255,.08); --line-strong:rgba(255,255,255,.16);
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    background:var(--ink); color:var(--paper);
    font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    min-height:100svh; display:flex; flex-direction:column;
  }
  .progress{display:flex; gap:6px; max-width:1152px; margin:0 auto; padding:24px 24px 0; width:100%}
  .progress span{flex:1; height:2px; border-radius:999px; background:rgba(255,255,255,.1)}
  .progress span.on{background:var(--teal)}
  main{flex:1; display:flex; align-items:center}
  .slide{max-width:1152px; margin:0 auto; padding:40px 24px; width:100%;
         animation:enter .42s ease-out both}
  .slide-title{text-align:center; display:flex; flex-direction:column; align-items:center}
  @keyframes enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .headline{font-family:'Montserrat',Georgia,serif; font-weight:700; letter-spacing:-.02em;
            font-size:clamp(1.6rem,4vw,2.75rem); margin:0; line-height:1.15}
  .headline-lg{font-size:clamp(2.5rem,8vw,4.5rem)}
  .support{color:var(--muted); font-size:clamp(1rem,2vw,1.25rem); line-height:1.6; margin:16px 0 0; max-width:48rem}
  .slide-title .support{font-size:clamp(1.1rem,2.6vw,1.5rem)}
  .points{margin:16px 0 0; padding:0; list-style:none}
  .points li{font-size:clamp(1rem,2vw,1.25rem); line-height:1.6; margin-top:8px}
  .visual{margin-top:40px; width:100%}
  .rule{width:96px; height:1px; background:var(--gold); margin:0 auto}
  .problem-grid{display:grid; gap:12px; grid-template-columns:repeat(3,1fr); max-width:48rem; margin:0 auto}
  .tile{border:1px solid var(--line); background:var(--ink-soft); border-radius:8px;
        padding:20px 16px; text-align:center; color:var(--muted); font-weight:500}
  .tile-gold{grid-column:1/-1; border-color:rgba(200,164,92,.45); background:rgba(200,164,92,.07);
             color:var(--gold); font-weight:600}
  .loop{display:flex; align-items:stretch; gap:12px; flex-wrap:wrap; justify-content:center}
  .loop-stage{flex:1; min-width:180px; border:1px solid var(--line); background:var(--ink-soft);
              border-radius:8px; padding:24px 20px; text-align:center;
              display:flex; flex-direction:column; justify-content:center}
  .loop-label{font-family:'Montserrat',Georgia,serif; font-weight:600; font-size:1.05rem}
  .loop-note{margin-top:8px; font-size:.85rem; color:var(--muted); line-height:1.4}
  .loop-arrow{align-self:center; color:var(--teal); font-size:1.3rem}
  .loop-return{text-align:center; color:var(--muted-dim); font-size:.8rem; margin-top:16px;
               border-top:1px dashed var(--line-strong); padding-top:14px}
  .steps{display:flex; gap:12px; flex-wrap:wrap; justify-content:center; list-style:none; margin:0 0 24px; padding:0}
  .steps li{display:flex; align-items:center; gap:12px}
  .step{border:1px solid var(--line-strong); background:var(--ink-soft); border-radius:6px;
        padding:8px 16px; font-weight:500}
  .step-arrow{color:var(--teal)}
  .shot{margin:0; border:1px solid var(--line-strong); border-radius:12px; overflow:hidden;
        background:var(--ink-soft); box-shadow:0 18px 50px -24px rgba(0,0,0,.8)}
  .shot img{display:block; width:100%; height:auto}
  .shot-missing{border-style:dashed; padding:48px 24px; text-align:center; box-shadow:none}
  .shot-title{font-weight:600; margin:0; font-size:.9rem}
  .shot-alt{color:var(--muted); margin:8px 0 0; font-size:.9rem; line-height:1.6}
  .shot-file{color:var(--muted-dim); font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
             font-size:11px; margin:16px 0 0}
  .closing{text-align:center}
  .closing-name{font-family:'Montserrat',Georgia,serif; font-weight:600; font-size:1.15rem; margin:32px 0 0}
  .closing-link{color:var(--teal); font-size:.95rem; text-decoration:none}
  .closing-link:hover,.closing-link:focus{text-decoration:underline}
  footer{padding:0 24px 28px}
  .bar{max-width:1152px; margin:0 auto; display:flex; gap:16px; align-items:center;
       justify-content:space-between; flex-wrap:wrap}
  .controls{display:flex; gap:8px}
  button{border:1px solid var(--line-strong); border-radius:8px; background:transparent;
         color:var(--paper); padding:8px 16px; font-size:.875rem; font-weight:500;
         font-family:inherit; cursor:pointer; transition:background-color .15s,border-color .15s}
  button:hover:not(:disabled){background:rgba(255,255,255,.06); border-color:var(--teal)}
  button:focus-visible{outline:2px solid var(--teal); outline-offset:2px}
  button:disabled{opacity:.4; cursor:not-allowed}
  .qualifier{color:var(--muted-dim); font-size:.75rem; margin:0}
  [hidden]{display:none !important}
  @media (max-width:768px){
    .problem-grid{grid-template-columns:1fr}
    .loop{flex-direction:column}
    .loop-arrow{transform:rotate(90deg)}
    .bar{flex-direction:column; align-items:flex-start}
  }
  @media (prefers-reduced-motion:reduce){
    .slide{animation:none}
    button{transition:none}
  }
</style>
</head>
<body>
  <div class="progress" id="progress" aria-label="Presentation progress">
    ${DEMO_SLIDES.map(() => '<span></span>').join('')}
  </div>

  <main aria-live="polite" aria-atomic="true" id="stage">
    ${DEMO_SLIDES.map((slide, i) => renderSlide(slide, i, assets)).join('\n')}
  </main>

  <footer>
    <div class="bar">
      <div class="controls">
        <button id="prev" aria-label="Previous slide">Previous</button>
        <button id="play" aria-label="Pause presentation" aria-pressed="true">Pause</button>
        <button id="next" aria-label="Next slide">Next</button>
      </div>
      <p class="qualifier">${DEMO_DATA_QUALIFIER}</p>
    </div>
  </footer>

<script>
(function () {
  // Mirrors lib/demo/presentationController.ts. The rules, in one place:
  // autoplay advances; reaching the last slide always stops it; it never
  // loops; manual navigation never resumes a paused deck; reduced motion
  // disables autoplay entirely while leaving the buttons working.
  var DURATIONS = ${durations};
  var LOOPS = ${loops};
  var COUNT = DURATIONS.length;
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var pips = Array.prototype.slice.call(document.querySelectorAll('#progress span'));
  var prevBtn = document.getElementById('prev');
  var playBtn = document.getElementById('play');
  var nextBtn = document.getElementById('next');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var index = 0;
  var playing = !reduced;
  var hoveringControls = false;
  var timer = null;

  function isLast(i) { return i >= COUNT - 1; }
  function resolve(i) {
    // Looping wraps both ways so the deck never reaches a dead end.
    if (!LOOPS) return Math.min(Math.max(i, 0), COUNT - 1);
    return ((i % COUNT) + COUNT) % COUNT;
  }

  function render() {
    slides.forEach(function (el, i) {
      if (i === index) { el.removeAttribute('hidden'); }
      else { el.setAttribute('hidden', ''); }
    });
    pips.forEach(function (p, i) { p.className = (LOOPS ? i === index : i <= index) ? 'on' : ''; });

    prevBtn.disabled = !LOOPS && index === 0;
    nextBtn.disabled = !LOOPS && isLast(index);

    if (!LOOPS && isLast(index)) {
      playBtn.textContent = 'Replay presentation';
      playBtn.setAttribute('aria-label', 'Replay presentation from the beginning');
      playBtn.removeAttribute('aria-pressed');
      playBtn.disabled = false;
    } else {
      playBtn.textContent = playing ? 'Pause' : 'Play';
      playBtn.setAttribute('aria-label', playing ? 'Pause presentation' : 'Play presentation');
      playBtn.setAttribute('aria-pressed', String(playing));
      playBtn.disabled = reduced;
    }
    schedule();
  }

  function schedule() {
    if (timer) { clearTimeout(timer); timer = null; }
    var ms = DURATIONS[index];
    if (!playing || reduced || hoveringControls || document.hidden || ms === null) return;
    timer = setTimeout(function () { goTo(index + 1); }, ms);
  }

  function goTo(target) {
    var next = resolve(target);
    if (next === index) { schedule(); return; }
    index = next;
    if (!LOOPS && isLast(index)) playing = false;   // holds at the end
    render();
  }

  prevBtn.addEventListener('click', function () { goTo(index - 1); });
  nextBtn.addEventListener('click', function () { goTo(index + 1); });
  playBtn.addEventListener('click', function () {
    if (!LOOPS && isLast(index)) { index = 0; playing = !reduced; render(); return; }
    if (reduced) return;
    playing = !playing;
    render();
  });

  document.querySelector('footer').addEventListener('mouseenter', function () {
    hoveringControls = true; schedule();
  });
  document.querySelector('footer').addEventListener('mouseleave', function () {
    hoveringControls = false; schedule();
  });
  document.addEventListener('visibilitychange', schedule);

  document.addEventListener('keydown', function (e) {
    var onControl = e.target && e.target.closest && e.target.closest('button, a');
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1); }
    else if (e.key === ' ' && !onControl) {
      e.preventDefault();
      if ((LOOPS || !isLast(index)) && !reduced) { playing = !playing; render(); }
    }
  });

  var touchX = null;
  document.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var d = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(d) < 48) return;
    goTo(index + (d < 0 ? 1 : -1));
  }, { passive: true });

  render();
})();
</script>
<!-- Screenshots inlined: ${attached} of ${Object.keys(DEMO_ASSETS).length} -->
</body>
</html>`
}

async function main() {
  const outPath = process.argv[2] ?? path.join(process.cwd(), 'EduNexus-Demo.html')
  const assets = await inlineAssets()
  const html = renderHtml(assets)
  await writeFile(outPath, html, 'utf8')

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(0)
  console.log(`Wrote ${outPath}`)
  console.log(`  ${DEMO_SLIDES.length} slides, ${kb} KB, fully self-contained`)
  console.log(`  screenshots inlined: ${Object.keys(assets).length} of ${Object.keys(DEMO_ASSETS).length}`)
  for (const [key, file] of Object.entries(DEMO_ASSETS)) {
    if (!assets[file]) console.log(`    missing: ${file}  (${key})`)
  }
}

main().catch(err => { console.error(err); process.exitCode = 1 })
