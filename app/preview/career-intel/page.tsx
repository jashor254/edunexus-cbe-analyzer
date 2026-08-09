export const metadata = {
  title: 'EduNexus — Career Intelligence',
  description: 'Mtoto wako ana career path yake. Je, umeiona? EduNexus Career Intelligence — AI-powered paths for every Kenyan student.',
  openGraph: {
    title: 'EduNexus Career Intelligence 🇰🇪',
    description: 'Soma → Degree → Kazi? That world is gone. See the real paths for your child.',
    type: 'website',
  },
}

export default function CareerIntelPreviewPage() {
  return (
    <html lang="en" style={{ margin: 0, padding: 0, background: '#000', height: '100%' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
      </head>
      <body
        dangerouslySetInnerHTML={{ __html: PRESENTATION_HTML }}
        style={{ margin: 0, padding: 0, height: '100%' }}
      />
    </html>
  )
}

const PRESENTATION_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  :root {
    --navy:#050d1a; --blue:#1d4ed8; --lblue:#3b82f6; --cyan:#06b6d4;
    --green:#10b981; --amber:#f59e0b; --purple:#7c3aed; --red:#ef4444;
    --white:#ffffff; --off:#e2e8f0; --slate:#94a3b8;
  }
  html,body { width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;font-family:'Segoe UI',system-ui,-apple-system,sans-serif; }
  #phone { position:relative;width:min(390px,100vw);height:min(844px,100vh);background:var(--navy);overflow:hidden;border-radius:min(40px,5vw);box-shadow:0 0 0 2px #1e293b,0 40px 120px rgba(0,0,0,.9); }
  .scene { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 28px;opacity:0;pointer-events:none;transition:opacity .5s ease;text-align:center; }
  .scene.active { opacity:1;pointer-events:all; }
  #dots { position:absolute;bottom:22px;left:0;right:0;display:flex;justify-content:center;gap:6px;z-index:50; }
  .dot { width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.25);transition:background .3s,width .3s; }
  .dot.active { background:#fff;width:18px;border-radius:3px; }
  #progbar { position:absolute;top:0;left:0;right:0;height:3px;z-index:50;background:rgba(255,255,255,.1); }
  #progfill { height:100%;background:var(--cyan);transition:width .3s linear;width:0%; }
  #hint { position:absolute;top:12px;right:16px;z-index:60;font-size:11px;color:rgba(255,255,255,.35);letter-spacing:.5px;cursor:pointer; }
  #tap-zone { position:absolute;inset:0;z-index:40;cursor:pointer; }

  /* Scene 1 */
  #sc1 { background:linear-gradient(160deg,#050d1a 0%,#0f2744 100%); }
  .hook-eyebrow { font-size:13px;letter-spacing:4px;text-transform:uppercase;color:var(--cyan);font-weight:600;margin-bottom:18px; }
  .hook-q { font-size:clamp(28px,7vw,36px);font-weight:900;color:#fff;line-height:1.2;margin-bottom:20px; }
  .hook-q span { color:var(--amber); }
  .hook-sub { font-size:clamp(15px,4vw,18px);color:var(--slate);line-height:1.6; }
  .hook-arrow { margin-top:28px;font-size:32px;animation:bounce 1.2s ease infinite; }
  @keyframes bounce { 0%,100%{transform:translateY(0)}50%{transform:translateY(8px)} }

  /* Scene 2 */
  #sc2 { background:#0a0a0a; }
  .sc2-label { font-size:12px;letter-spacing:3px;color:var(--slate);text-transform:uppercase;margin-bottom:20px; }
  .old-path { display:flex;align-items:center;gap:10px;background:#111;border:1px solid #222;border-radius:12px;padding:14px 18px;margin-bottom:10px;width:100%; }
  .old-icon { font-size:22px; }
  .old-text { font-size:15px;color:#e2e8f0;font-weight:600; }
  .old-arr { margin-left:auto;color:#334155;font-size:18px; }
  .old-xmark { font-size:clamp(32px,8vw,42px);font-weight:900;color:var(--red);margin-top:20px;line-height:1; }
  .old-verdict { font-size:clamp(13px,3.5vw,16px);color:var(--slate);margin-top:10px;line-height:1.5; }
  .old-verdict strong { color:#fff; }

  /* Scene 3 */
  #sc3 { background:linear-gradient(160deg,#0c0a1e 0%,#1a0535 100%); }
  .dis-title { font-size:clamp(20px,5vw,24px);font-weight:900;color:#fff;margin-bottom:24px;line-height:1.3; }
  .dis-title span { color:var(--purple); }
  .stat-row { width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px 18px;margin-bottom:10px;text-align:left;display:flex;align-items:center;gap:14px; }
  .stat-big { font-size:clamp(28px,7vw,36px);font-weight:900;min-width:72px;text-align:center;line-height:1; }
  .stat-desc { font-size:clamp(13px,3.2vw,15px);color:var(--off);line-height:1.4; }
  .stat-desc em { color:var(--slate);font-style:normal;font-size:.85em;display:block;margin-top:2px; }

  /* Scene 4 */
  #sc4 { background:linear-gradient(160deg,#050d1a 0%,#0c2340 100%); }
  .rev-logo { font-size:13px;letter-spacing:3px;font-weight:700;color:var(--cyan);text-transform:uppercase;margin-bottom:8px; }
  .rev-title { font-size:clamp(24px,6vw,30px);font-weight:900;color:#fff;margin-bottom:6px;line-height:1.2; }
  .rev-sub { font-size:clamp(13px,3.5vw,15px);color:var(--slate);margin-bottom:22px; }
  .path-card { width:100%;border-radius:10px;padding:13px 16px;margin-bottom:8px;text-align:left;display:flex;align-items:center;gap:12px;border:1.5px solid; }
  .path-icon { font-size:20px; }
  .path-name { font-size:14px;font-weight:700; }
  .path-tag { font-size:11px;margin-left:auto;padding:3px 8px;border-radius:20px;font-weight:600; }

  /* Scene 5 */
  #sc5 { background:#050d1a; }
  .demo-chip { font-size:11px;letter-spacing:3px;color:var(--green);text-transform:uppercase;font-weight:700;margin-bottom:14px; }
  .demo-card { width:100%;background:#0a1929;border:1px solid #1e3a5f;border-radius:16px;padding:18px 16px;margin-bottom:14px; }
  .demo-name { font-size:11px;color:var(--slate);margin-bottom:4px;text-align:left; }
  .demo-val { font-size:15px;font-weight:700;color:#fff;text-align:left; }
  .ai-scanning { font-size:12px;color:var(--cyan);letter-spacing:1px;margin-bottom:14px;animation:pulse 1.5s ease infinite; }
  @keyframes pulse { 0%,100%{opacity:.4}50%{opacity:1} }
  .result-row { display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #0f2744; }
  .result-row:last-child { border-bottom:none; }
  .result-key { font-size:12px;color:var(--slate); }
  .result-val { font-size:13px;font-weight:700; }

  /* Scene 6 */
  #sc6 { background:linear-gradient(160deg,#051a0f 0%,#0a2d1a 100%); }
  .par-title { font-size:clamp(22px,5.5vw,26px);font-weight:900;color:#fff;margin-bottom:6px;line-height:1.3; }
  .par-title span { color:var(--green); }
  .par-sub { font-size:13px;color:var(--slate);margin-bottom:20px; }
  .par-item { width:100%;display:flex;align-items:center;gap:12px;background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:12px 14px;margin-bottom:9px;text-align:left; }
  .par-item-icon { font-size:20px; }
  .par-item-text { font-size:14px;color:var(--off);line-height:1.4; }
  .par-item-text strong { color:#fff;display:block;font-size:13px; }

  /* Scene 7 */
  #sc7 { background:linear-gradient(160deg,#050d1a 0%,#0f2744 100%); }
  .cta-pre { font-size:12px;letter-spacing:3px;color:var(--cyan);text-transform:uppercase;font-weight:700;margin-bottom:14px; }
  .cta-main { font-size:clamp(26px,7vw,34px);font-weight:900;color:#fff;line-height:1.2;margin-bottom:8px; }
  .cta-main span { color:var(--amber); }
  .cta-sub { font-size:clamp(13px,3.5vw,16px);color:var(--slate);margin-bottom:28px;line-height:1.55; }
  .cta-btn { background:linear-gradient(135deg,var(--blue),var(--cyan));color:#fff;font-size:15px;font-weight:800;padding:15px 36px;border-radius:50px;border:none;letter-spacing:.5px;cursor:pointer;box-shadow:0 8px 32px rgba(6,182,212,.35);margin-bottom:14px; }
  .cta-url { font-size:13px;color:var(--slate);letter-spacing:.5px; }
  .cta-url strong { color:var(--cyan); }
  .cta-logos { margin-top:20px;display:flex;align-items:center;gap:10px;justify-content:center; }
  .cta-logos span { font-size:11px;color:#334155;letter-spacing:2px;text-transform:uppercase; }

  /* Entrance animations */
  .scene.active .anim { animation:fadeUp .6s ease both; }
  .anim-d1{animation-delay:.1s!important} .anim-d2{animation-delay:.25s!important}
  .anim-d3{animation-delay:.4s!important} .anim-d4{animation-delay:.55s!important}
  .anim-d5{animation-delay:.7s!important} .anim-d6{animation-delay:.85s!important}
  .anim-d7{animation-delay:1s!important}
  @keyframes fadeUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
</style>
</head>
<body>
<div id="phone">
  <div id="progbar"><div id="progfill"></div></div>
  <div id="hint" onclick="togglePause()">⏸ tap</div>
  <div id="tap-zone" onclick="advance()"></div>

  <div class="scene active" id="sc1">
    <p class="hook-eyebrow anim anim-d1">Kwa wazazi wa Kenya 🇰🇪</p>
    <h1 class="hook-q anim anim-d2">"Mtoto wako<br>ataenda <span>wapi</span><br>baada ya shule?"</h1>
    <p class="hook-sub anim anim-d3">Unadhani unajua jibu.<br>Lakini career ya mtoto wako<br>si kazi tu — na dunia imebadilika.</p>
    <div class="hook-arrow anim anim-d4">👇</div>
  </div>

  <div class="scene" id="sc2">
    <p class="sc2-label anim anim-d1">Fikira ya zamani</p>
    <div class="old-path anim anim-d2"><span class="old-icon">📚</span><span class="old-text">Soma vizuri</span><span class="old-arr">→</span></div>
    <div class="old-path anim anim-d3"><span class="old-icon">🎓</span><span class="old-text">Pata degree</span><span class="old-arr">→</span></div>
    <div class="old-path anim anim-d4"><span class="old-icon">💼</span><span class="old-text">Tafuta kazi</span><span class="old-arr">→</span></div>
    <div class="old-path anim anim-d5"><span class="old-icon">🏦</span><span class="old-text">Staafu. Kwisha.</span><span class="old-arr">✓</span></div>
    <p class="old-xmark anim anim-d6">❌ IMEKWISHA.</p>
    <p class="old-verdict anim anim-d7">Dunia ya <strong>2030</strong> inacheza rules mpya kabisa.</p>
  </div>

  <div class="scene" id="sc3">
    <h2 class="dis-title anim anim-d1">Ukweli wa <span>dunia</span><br>mtoto wako anaenda:</h2>
    <div class="stat-row anim anim-d2"><div class="stat-big" style="color:var(--red)">40%</div><div class="stat-desc">ya kazi za ofisi zitafutwa na <strong style="color:#fff">AI</strong> ifikapo 2030<em>World Economic Forum</em></div></div>
    <div class="stat-row anim anim-d3"><div class="stat-big" style="color:var(--amber)">85%</div><div class="stat-desc">ya kazi za 2040 <strong style="color:#fff">hazipo bado</strong> leo<em>Institute for the Future</em></div></div>
    <div class="stat-row anim anim-d4"><div class="stat-big" style="color:var(--green)">3×</div><div class="stat-desc">ukuaji wa <strong style="color:#fff">self-employment &amp; digital economy</strong> Afrika<em>African Development Bank</em></div></div>
    <div class="stat-row anim anim-d5"><div class="stat-big" style="color:var(--cyan)">1</div><div class="stat-desc">jibu linalofanya kazi — <strong style="color:#fff">Career Intelligence</strong> ya kweli<em>si speculation — AI-powered paths</em></div></div>
  </div>

  <div class="scene" id="sc4">
    <p class="rev-logo anim anim-d1">✦ EduNexus</p>
    <h2 class="rev-title anim anim-d2">Tunaangalia<br>paths ZOTE —<br>si kazi tu.</h2>
    <p class="rev-sub anim anim-d3">Career Intelligence inayoangalia mustakabali kamili:</p>
    <div class="path-card anim anim-d4" style="border-color:var(--blue);background:rgba(29,78,216,.1)"><span class="path-icon">💼</span><span class="path-name" style="color:var(--lblue)">Traditional Employment</span><span class="path-tag" style="background:rgba(29,78,216,.2);color:var(--lblue)">Still here</span></div>
    <div class="path-card anim anim-d5" style="border-color:var(--green);background:rgba(16,185,129,.1)"><span class="path-icon">🏗️</span><span class="path-name" style="color:var(--green)">Self-Employment</span><span class="path-tag" style="background:rgba(16,185,129,.2);color:var(--green)">Growing fast</span></div>
    <div class="path-card anim anim-d6" style="border-color:var(--purple);background:rgba(124,58,237,.1)"><span class="path-icon">🤖</span><span class="path-name" style="color:var(--purple)">AI-Proof Careers</span><span class="path-tag" style="background:rgba(124,58,237,.2);color:var(--purple)">Future-safe</span></div>
    <div class="path-card anim anim-d7" style="border-color:var(--amber);background:rgba(245,158,11,.1)"><span class="path-icon">🚀</span><span class="path-name" style="color:var(--amber)">Digital Entrepreneurship</span><span class="path-tag" style="background:rgba(245,158,11,.2);color:var(--amber)">Your choice</span></div>
  </div>

  <div class="scene" id="sc5">
    <p class="demo-chip anim anim-d1">⚡ Live Career Intelligence</p>
    <div class="demo-card anim anim-d2"><div class="demo-name">Student Profile</div><div class="demo-val">Amina W. · Grade 11 · CBC Senior</div></div>
    <p class="ai-scanning anim anim-d3">▸ AI inasoma profile... ✓ Done</p>
    <div class="demo-card anim anim-d4">
      <div class="result-row"><span class="result-key">Top Career Match</span><span class="result-val" style="color:var(--cyan)">Data Analyst</span></div>
      <div class="result-row"><span class="result-key">Match Score</span><span class="result-val" style="color:var(--green)">91% ✓</span></div>
      <div class="result-row"><span class="result-key">Salary Range (KES)</span><span class="result-val" style="color:var(--amber)">85K – 200K /mo</span></div>
      <div class="result-row"><span class="result-key">AI Disruption Risk</span><span class="result-val" style="color:var(--green)">LOW 🛡️</span></div>
      <div class="result-row"><span class="result-key">University Route</span><span class="result-val" style="color:#fff;font-size:12px">UoN · KU · Strathmore</span></div>
      <div class="result-row"><span class="result-key">Self-Employ Option</span><span class="result-val" style="color:var(--purple)">Yes — Freelance ✓</span></div>
    </div>
  </div>

  <div class="scene" id="sc6">
    <h2 class="par-title anim anim-d1">Wewe kama mzazi <span>unaona hii</span> yote —</h2>
    <p class="par-sub anim anim-d2">Real data. Si matumaini tu.</p>
    <div class="par-item anim anim-d3"><span class="par-item-icon">🗺️</span><span class="par-item-text"><strong>5 career paths</strong> matched specifically to your child</span></div>
    <div class="par-item anim anim-d4"><span class="par-item-icon">💰</span><span class="par-item-text"><strong>Realistic salary ranges</strong> for Kenya's actual job market</span></div>
    <div class="par-item anim anim-d5"><span class="par-item-icon">🤖</span><span class="par-item-text"><strong>AI disruption rating</strong> — is this career safe in 10 years?</span></div>
    <div class="par-item anim anim-d6"><span class="par-item-icon">🏫</span><span class="par-item-text"><strong>University courses</strong> + self-employment pathways side by side</span></div>
    <div class="par-item anim anim-d7"><span class="par-item-icon">📊</span><span class="par-item-text"><strong>Skills gap report</strong> — what your child needs to build RIGHT NOW</span></div>
  </div>

  <div class="scene" id="sc7">
    <p class="cta-pre anim anim-d1">✦ Take action today</p>
    <h2 class="cta-main anim anim-d2">Mtoto wako ana<br><span>future yake</span>.<br>Je, umeiona?</h2>
    <p class="cta-sub anim anim-d3">Anza na EduNexus Career Intelligence<br>uone njia halisi za mtoto wako<br>kwa dunia ya kweli.</p>
    <button class="cta-btn anim anim-d4">Jaribu Bure Leo →</button>
    <p class="cta-url anim anim-d5"><strong>edunexus.co.ke</strong></p>
    <div class="cta-logos anim anim-d6"><span>CBC · 8-4-4 · IGCSE</span></div>
  </div>

  <div id="dots">
    <div class="dot active"></div><div class="dot"></div><div class="dot"></div>
    <div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div>
  </div>
</div>

<script>
  const scenes=[...document.querySelectorAll('.scene')]
  const dots=[...document.querySelectorAll('.dot')]
  const fill=document.getElementById('progfill')
  const hint=document.getElementById('hint')
  const total=scenes.length
  const DURATIONS=[5000,7000,8000,8000,9000,8000,9000]
  let current=0,paused=false,elapsed=0,lastTick=null

  function showScene(idx){
    scenes[current].classList.remove('active')
    dots[current].classList.remove('active')
    current=(idx+total)%total
    scenes[current].classList.add('active')
    dots[current].classList.add('active')
    fill.style.width='0%';elapsed=0;lastTick=null
  }
  function advance(){ showScene(current<total-1?current+1:0) }
  function togglePause(){ paused=!paused;hint.textContent=paused?'▶ tap':'⏸ tap' }

  function tick(ts){
    if(!lastTick)lastTick=ts
    if(!paused){
      elapsed+=ts-lastTick
      const dur=DURATIONS[current]||8000
      fill.style.width=Math.min(100,(elapsed/dur)*100)+'%'
      if(elapsed>=dur)advance()
    }
    lastTick=ts
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  document.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'||e.key===' '){e.preventDefault();advance()}
    if(e.key==='p'||e.key==='P')togglePause()
  })
  let tx=null
  document.addEventListener('touchstart',e=>{tx=e.touches[0].clientX},{passive:true})
  document.addEventListener('touchend',e=>{
    if(tx===null)return
    if(e.changedTouches[0].clientX-tx<-40)advance()
    tx=null
  },{passive:true})
</script>
</body>
</html>
`
