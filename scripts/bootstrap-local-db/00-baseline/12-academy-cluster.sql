-- 20260612064836 academy_tables_and_seed

-- ─── Academy Modules ──────────────────────────────────────────────────────────
create table if not exists academy_modules (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  slug           text unique not null,
  phase          int  not null default 1,
  "order"        int  not null,
  description    text,
  estimated_mins int,
  color          text,
  published      boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists idx_academy_modules_phase_order on academy_modules (phase, "order");

alter table academy_modules enable row level security;
create policy "Authenticated read academy_modules"
  on academy_modules for select
  using (auth.role() = 'authenticated');

-- ─── Academy Lessons ──────────────────────────────────────────────────────────
create table if not exists academy_lessons (
  id         uuid primary key default gen_random_uuid(),
  module_id  uuid references academy_modules(id) on delete cascade,
  title      text not null,
  "order"    int  not null,
  content    text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_academy_lessons_module on academy_lessons (module_id, "order");

alter table academy_lessons enable row level security;
create policy "Authenticated read academy_lessons"
  on academy_lessons for select
  using (auth.role() = 'authenticated');

-- ─── Academy Progress ─────────────────────────────────────────────────────────
create table if not exists academy_progress (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid references teachers(id) on delete cascade,
  lesson_id    uuid references academy_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique(teacher_id, lesson_id)
);

create index if not exists idx_academy_progress_teacher on academy_progress (teacher_id);
create index if not exists idx_academy_progress_lesson  on academy_progress (lesson_id);

alter table academy_progress enable row level security;

create policy "Teachers manage own progress"
  on academy_progress for all
  using  (teacher_id = (select id from teachers where user_id = auth.uid()))
  with check (teacher_id = (select id from teachers where user_id = auth.uid()));

-- ─── Seed: 6 Phase 1 Modules ─────────────────────────────────────────────────
insert into academy_modules (title, slug, phase, "order", description, estimated_mins, color, published)
values
  ('What AI Actually Is',          'what-ai-actually-is',        1, 1, 'Demystify AI from the ground up — no jargon, no hype. Understand what large language models really do and why it matters for your classroom.',  25, '#14b8a6', true),
  ('AI in Kenya''s Education Landscape', 'ai-landscape-kenya',   1, 2, 'Explore how AI is already shaping Kenyan schools, the CBC rollout, and what this means for teachers in 2025 and beyond.',                    20, '#8b5cf6', true),
  ('The Art of Prompting',         'art-of-prompting',           1, 3, 'Master the skill that separates good AI users from great ones. Learn to write prompts that get exactly what you need — every time.',            30, '#f59e0b', true),
  ('AI as Your Time Machine',      'ai-time-machine',            1, 4, 'Discover how AI can collapse hours of prep into minutes: schemes, lesson plans, assessments, and parent reports generated in seconds.',          25, '#3b82f6', true),
  ('AI Safety & Responsible Use',  'ai-safety',                  1, 5, 'Navigate the real risks: bias, hallucination, data privacy, and academic integrity. Become a responsible AI practitioner in your school.',       20, '#ef4444', true),
  ('Where Do You Go From Here?',   'where-do-you-go-from-here',  1, 6, 'Chart your personal AI learning path beyond Phase 1. Tools, communities, and habits that will keep you ahead of the curve.',                   15, '#10b981', true)
on conflict (slug) do nothing;

-- ─── Seed: 3 placeholder lessons per module ──────────────────────────────────
insert into academy_lessons (module_id, title, "order", content)
select
  m.id,
  ls.title,
  ls.ord,
  ls.content
from academy_modules m
cross join (
  values
    (1, 'Introduction', '<h2>Coming soon</h2><p>This lesson content will be available shortly. Check back after the full Academy launch.</p>'),
    (2, 'Core Concepts', '<h2>Coming soon</h2><p>This lesson content will be available shortly. Check back after the full Academy launch.</p>'),
    (3, 'Putting It Into Practice', '<h2>Coming soon</h2><p>This lesson content will be available shortly. Check back after the full Academy launch.</p>')
) as ls(ord, title, content)
where m.phase = 1
on conflict do nothing;


-- 20260612075458 academy_phase1_content
-- ============================================================
-- EduNexus AI Academy — Phase 1 Content Migration
-- Replaces placeholder lessons with real content
-- ============================================================

DELETE FROM academy_lessons;

-- ============================================================
-- MODULE 1: What AI Actually Is
-- ============================================================
INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'The chalk → blackboard → internet moment', 1,
'<h2>The chalk → blackboard → internet moment</h2>
<p>Think back to every technology that entered the Kenyan classroom. The radio lessons of the 1970s. The VCR tapes. The computer lab that most students used once a term. The e-learning platforms. The digital content on CD-ROMs.</p>
<p>Every single one carried the same promise: <strong>this will transform education.</strong></p>
<p>And every single one did the same thing — it changed the tool, but it never changed the teacher.</p>
<p>The student still sat in the same row. The teacher still stood at the front. The scheme of work still had to be written by hand on Sunday night. The marking pile still waited on Monday morning.</p>
<div class="callout">Here is what is different about AI: For the first time, the technology is not asking students to learn differently. It is asking <em>you</em> — the teacher — to work differently. AI does not replace the classroom. It replaces the parts of your job that were never really teaching in the first place.</div>
<p>Writing a scheme of work is not teaching. Copying report comments is not teaching. Formatting a lesson plan is not teaching. These are administrative tasks wearing a teacher''s uniform.</p>
<p>AI takes those tasks. And gives you back the thing you became a teacher to do — actually teach.</p>
<div class="example-card"><strong>Real example:</strong> A Grade 8 Science teacher in Nairobi spent every Sunday evening — 3 to 4 hours — writing her schemes of work for the coming week. After joining this course and using EduNexus, her full term SOW was ready in 4 minutes. She used her Sunday evening to prepare actual lesson demonstrations instead. Her students noticed within two weeks.</div>'
FROM academy_modules m WHERE m.slug = 'what-ai-actually-is';

INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'AI explained through marking', 2,
'<h2>AI explained through marking</h2>
<p>You do not need to understand code to understand AI. You already understand the core idea — because you do something similar every time you mark a set of papers.</p>
<p>Imagine you receive 45 scripts for a Mathematics test. As you mark the first 10, you start to notice a pattern. Most students are getting question 3 wrong — specifically the part where they convert fractions. You did not tell yourself to look for this. Your brain found the pattern automatically because it has seen thousands of student mistakes over your career.</p>
<p><strong>That is exactly what AI does.</strong> It has been shown millions of examples — text, questions, answers, documents — and it learned patterns from all of them. When you give it a task, it uses those patterns to respond.</p>
<div class="callout callout--purple"><strong>The key difference:</strong> You learned from 20 years of teaching. AI learned from billions of pages of text in a few months. It is not smarter than you — it has simply read more. Your judgment, your knowledge of your students, your understanding of CBC — that is still yours alone.</div>
<h3>What AI is good at</h3>
<p>Generating text quickly. Finding patterns. Following instructions precisely. Producing consistent output at any time of day or night. Remembering everything you tell it in a conversation.</p>
<h3>What AI cannot do</h3>
<p>AI cannot know your students. It cannot feel the energy in your classroom on a difficult Friday afternoon. It cannot tell when Kamau is quiet because he is confused versus quiet because something happened at home. It cannot replace the relationship between a teacher and a child.</p>
<div class="callout callout--amber"><strong>The honest truth:</strong> AI is a very powerful assistant. An assistant that never sleeps, never complains, never asks for leave. But it is still an assistant. You are still the professional. You are still the one who decides what gets taught, how it gets taught, and whether the output is good enough for your students.</div>'
FROM academy_modules m WHERE m.slug = 'what-ai-actually-is';

INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'AI myths every Kenyan teacher has heard', 3,
'<h2>AI myths every Kenyan teacher has heard</h2>
<p>Before you can use AI confidently, we need to clear the air. These are the four myths that are stopping most teachers from even trying.</p>
<div class="myth-item"><div class="myth-wrong"><strong>Myth:</strong> "AI is going to replace teachers."</div><div class="myth-right"><strong>Reality:</strong> AI cannot build trust with a child. It cannot motivate a struggling student. It cannot adapt in real time to a classroom. Teachers who use AI will replace teachers who do not — but AI alone will never replace a teacher.</div></div>
<div class="myth-item"><div class="myth-wrong"><strong>Myth:</strong> "You need to understand technology to use AI."</div><div class="myth-right"><strong>Reality:</strong> You talk to AI in plain English or Swahili. If you can write a WhatsApp message, you can use AI. No coding. No special skills. Just clear instructions.</div></div>
<div class="myth-item"><div class="myth-wrong"><strong>Myth:</strong> "AI content is not accurate — it makes things up."</div><div class="myth-right"><strong>Reality:</strong> AI can make mistakes, especially on specific facts. That is why you — the professional — always review the output. You are the editor. AI is the first draft. A very fast, very thorough first draft.</div></div>
<div class="myth-item"><div class="myth-wrong"><strong>Myth:</strong> "AI is only for young people and tech companies."</div><div class="myth-right"><strong>Reality:</strong> The most powerful users of AI right now are professionals with deep domain knowledge — doctors, lawyers, engineers — and teachers. Because AI needs someone who knows what good output looks like. That is you.</div></div>
<div class="task-box"><strong>Before next module — your task:</strong> Open WhatsApp. Find Meta AI (the blue circle). Type this exact message: "I am a Grade 8 Science teacher in Kenya. Write me 5 discussion questions about photosynthesis for CBC learners." Read what comes back. Notice what is good. Notice what is wrong or missing. Share your observation in the WhatsApp group.</div>'
FROM academy_modules m WHERE m.slug = 'what-ai-actually-is';

-- ============================================================
-- MODULE 2: AI Landscape Kenya
-- ============================================================
INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'You have already used AI', 1,
'<h2>You have already used AI</h2>
<p>Before we look at the tools, there is something important to understand. Most Kenyan teachers have already used AI — they just did not know it had a name.</p>
<p>When WhatsApp suggests the next word as you type a message — that is AI. When Google corrects your spelling automatically — that is AI. When YouTube recommends the next video — that is AI. When your phone unlocks using your face — that is AI.</p>
<div class="callout"><strong>The tools we are about to explore are simply more powerful versions of things you already use every day.</strong> The difference is that now you can have a conversation with them and ask them to help you work.</div>
<p>In Kenya right now, when most teachers hear "AI" they think of one thing — the blue circle on WhatsApp called Meta AI. That is a real AI tool and it is a perfectly fine place to start. But it is the beginning of the story, not the whole story.</p>
<p>By the end of this module you will understand exactly where Meta AI ends and where more powerful tools begin — and you will know which one to open depending on what you need to do.</p>'
FROM academy_modules m WHERE m.slug = 'ai-landscape-kenya';

INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'The tools — honestly explained', 2,
'<h2>The tools — honestly explained</h2>
<p>There are five tools every teacher should know. For each one: what it is, what it is good at for teachers, what it cannot do, and an honest verdict for a Kenyan classroom context.</p>
<h3>Meta AI on WhatsApp</h3>
<p>Built directly into WhatsApp — the app already on every teacher''s phone. No new app, no account. <strong>Kenyan teacher verdict:</strong> Great for quick tasks on your phone between lessons. Not the right tool for a full SOW or detailed lesson plan. Think of it as the quick question you ask a colleague in the staffroom.</p>
<h3>ChatGPT — chat.openai.com</h3>
<p>The tool that made AI famous globally. Powerful, available on phone and computer, free version works well for most teacher tasks. <strong>Kenyan teacher verdict:</strong> One of the best free tools available. Works well for lesson planning and assessment creation when you give it clear CBC context in your prompt.</p>
<h3>Claude — claude.ai</h3>
<p>Made by Anthropic. Known for being careful, thorough, and honest about what it does not know. Better for long documents. <strong>Kenyan teacher verdict:</strong> Excellent for detailed, careful work — full term SOW, detailed rubrics, professional letters. Also the engine powering EduNexus behind the scenes.</p>
<h3>Gemini — gemini.google.com</h3>
<p>Google''s AI. Can search the internet in real time — meaning current information, recent news, up-to-date content. <strong>Kenyan teacher verdict:</strong> Best for research. When you need current examples for a lesson, recent CBC updates, or today''s news for Social Studies.</p>
<h3>Microsoft Copilot — copilot.microsoft.com</h3>
<p>Works directly inside Word, Excel, and PowerPoint. <strong>Kenyan teacher verdict:</strong> Useful if your school already uses Microsoft. If starting from scratch, focus on ChatGPT and Claude first.</p>'
FROM academy_modules m WHERE m.slug = 'ai-landscape-kenya';

INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'Which tool for which task', 3,
'<h2>Which tool for which task</h2>
<p>You do not need all of them. Most teachers need two — one for quick tasks, one for serious work. Here is the honest guide.</p>
<table class="guide-table"><thead><tr><th>Task</th><th>Best tool</th></tr></thead><tbody><tr><td>Full term SOW</td><td>EduNexus — fastest, CBC-specific</td></tr><tr><td>Detailed lesson plan</td><td>Claude or ChatGPT</td></tr><tr><td>Quick discussion questions</td><td>Meta AI or ChatGPT</td></tr><tr><td>Research for lesson content</td><td>Gemini — searches internet</td></tr><tr><td>Report comments (bulk)</td><td>ChatGPT or Claude</td></tr><tr><td>Professional parent letter</td><td>Claude — careful language</td></tr><tr><td>Exam paper creation</td><td>ChatGPT or EduNexus</td></tr><tr><td>Presentations</td><td>Gamma — 60 seconds</td></tr></tbody></table>
<div class="callout callout--amber"><strong>The honest truth about all these tools:</strong> None of them know CBC the way you know CBC. They are powerful assistants — but they need your direction, your context, and your professional judgment to produce work that is actually useful in a Kenyan classroom. That is what the next module teaches you.</div>
<div class="example-card"><strong>Real example — same task, two tools:</strong> A Kiswahili teacher asked Meta AI for Grade 8 exam questions. She got five reasonable questions — but none referenced CBC competencies. She then asked Claude the same question but added CBC context, strand number, and format requirements. The second response was ready to use in a test. The tool did not change — the prompt did.</div>
<div class="task-box"><strong>Your task:</strong> Pick one task you need to do this week. Ask the same question to Meta AI and ChatGPT. Compare results. Share your comparison in the WhatsApp group — one sentence per tool.</div>'
FROM academy_modules m WHERE m.slug = 'ai-landscape-kenya';

-- ============================================================
-- MODULE 3: Art of Prompting
-- ============================================================
INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'Why most teachers get bad results', 1,
'<h2>Why most teachers get bad results</h2>
<p>Most teachers — when they first try AI — write prompts the same way they would type into Google. Short. Vague. No context. Google is designed for short vague questions. AI is not. AI is designed to follow detailed instructions. The more context you give it, the better the result — every single time without exception.</p>
<div class="compare-block"><div class="compare-bad"><strong>What most teachers type:</strong><br>"Write me a lesson plan for Grade 7 Science"<br><em>Result: Generic lesson. Wrong curriculum. Wrong format. Feels like it was written for a school in the UK. Needs rewriting from scratch.</em></div><div class="compare-good"><strong>What gets real results:</strong><br>"I am a Grade 7 Integrated Science teacher in Kenya using CBC. Write a 40-minute lesson plan for Strand 4: Living Things and Their Environment, Sub-strand 4.2: Habitats. Include introduction, learning activities, and a closing reflection question. Use simple English suitable for Grade 7 learners."<br><em>Result: CBC-aligned, correct strand, correct format, ready to use. Saves 45 minutes.</em></div></div>
<p>Same tool. Same AI. Completely different output. The only difference is the quality of the instruction.</p>
<div class="callout callout--teal"><strong>Think of it this way:</strong> Imagine you ask a new teacher to "write a lesson plan for Science." They will ask — which grade? Which topic? How long? What format? AI cannot ask those questions back. So you must include the answers before it even starts.</div>'
FROM academy_modules m WHERE m.slug = 'art-of-prompting';

INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'The CTCF formula', 2,
'<h2>The CTCF formula</h2>
<p>Every strong prompt for a teacher contains four parts. We call it CTCF.</p>
<div class="formula-box">
<div class="formula-part formula-part--purple"><strong>C — Context:</strong> Who you are, what curriculum, which grade, which subject. The most important part. Without context, AI guesses — and it usually guesses wrong for Kenya.<br><br><em>"I am a Grade 9 Mathematics teacher in Kenya using CBC..."</em></div>
<div class="formula-part formula-part--teal"><strong>T — Task:</strong> Exactly what you want the AI to produce. Be specific about the document, topic, and level of detail.<br><br><em>"...write a 5-question structured assessment on Linear Equations, Strand 2..."</em></div>
<div class="formula-part formula-part--amber"><strong>C — Constraints:</strong> The rules and boundaries. Time limits, word counts, language level, what to include or avoid.<br><br><em>"...questions should progress from simple to complex, include a word problem using a Kenyan context such as farming or business..."</em></div>
<div class="formula-part formula-part--red"><strong>F — Format:</strong> How you want the output to look. A table, numbered list, fill-in-the-blank, marking scheme.<br><br><em>"...present each question with a blank answer space below and include a marking scheme at the end."</em></div>
</div>
<div class="callout callout--purple"><strong>When your result disappoints you, look at which part is missing.</strong> That is almost always the problem. Missing Context = wrong curriculum. Missing Constraints = wrong level. Missing Format = wrong layout.</div>'
FROM academy_modules m WHERE m.slug = 'art-of-prompting';

INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'The 5 mistakes that ruin good prompts', 3,
'<h2>The 5 mistakes that ruin good prompts</h2>
<p>Even with CTCF, teachers sometimes still get disappointing results. Almost always, the cause is one of these five mistakes.</p>
<div class="mistake-item"><strong>1. Forgetting you are in Kenya.</strong> AI defaults to American or British curriculum if you do not specify. Always say "Kenya" and "CBC" explicitly. Every single time.</div>
<div class="mistake-item"><strong>2. Accepting the first response.</strong> The first response is a draft. If something is wrong, tell the AI exactly what to fix: "The questions are too easy — make them suitable for high-performing Grade 9 learners."</div>
<div class="mistake-item"><strong>3. Asking for too many things at once.</strong> "Write a lesson plan, assessment, rubric, and parent letter for Science" produces shallow output for everything. One task per prompt.</div>
<div class="mistake-item"><strong>4. Not specifying the learner level.</strong> AI does not know your class. Tell it: "My learners are below grade level" or "this is a high-ability class."</div>
<div class="mistake-item"><strong>5. Using AI output without reviewing it.</strong> AI can state incorrect facts confidently. Always read the output before using it with learners. You are the editor — AI is the first draft writer.</div>
<div class="callout callout--coral"><strong>The golden rule:</strong> AI output is a starting point, not a finished product. A good prompt gives you a first draft that is 80% ready. Your professional knowledge takes it to 100%.</div>
<div class="task-box"><strong>Your task:</strong> Build your first CTCF prompt from scratch for one document you genuinely need this week. Share your prompt AND the result in the WhatsApp group.</div>'
FROM academy_modules m WHERE m.slug = 'art-of-prompting';

-- ============================================================
-- MODULE 4: AI Time Machine
-- ============================================================
INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'Where your time actually goes', 1,
'<h2>Where your time actually goes</h2>
<p>Most teachers, when asked how many hours they spend on paperwork per week, underestimate. They count the big sessions — Sunday evening, Friday night — but forget the small ones. The lesson plan written during lunch. The report comments finished after lights out. The scheme of work started on a public holiday.</p>
<p>Add it up honestly and the number is usually between 8 and 15 hours per week on administrative work that has nothing to do with standing in front of a class and teaching.</p>
<div class="time-grid"><div class="time-card"><div class="time-before">Was taking</div><div class="time-num">3–4 hrs</div><div class="time-task">Full term SOW</div><div class="time-after">Now: 4 minutes</div></div><div class="time-card"><div class="time-before">Was taking</div><div class="time-num">45 min</div><div class="time-task">One lesson plan</div><div class="time-after">Now: 3 minutes</div></div><div class="time-card"><div class="time-before">Was taking</div><div class="time-num">2 hrs</div><div class="time-task">40 report comments</div><div class="time-after">Now: 8 minutes</div></div><div class="time-card"><div class="time-before">Was taking</div><div class="time-num">30 min</div><div class="time-task">Parent letter</div><div class="time-after">Now: 2 minutes</div></div></div>
<div class="callout callout--teal"><strong>What teachers do with the time they get back:</strong> More preparation for actual lessons. More individual attention to struggling learners. More rest. One teacher said — "I stopped dreading Sunday evenings. That alone was worth it."</div>'
FROM academy_modules m WHERE m.slug = 'ai-time-machine';

INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'Every document — step by step', 2,
'<h2>Every document — step by step</h2>
<p>Five documents that steal the most teacher time. For each one, exactly how to generate it.</p>
<h3>Scheme of Work — 4 minutes via EduNexus</h3>
<p>Go to Teacher Tools → Scheme of Work. Select subject, grade, term, curriculum. Click Generate. The system allocates lessons to weeks, respects term dates, sequences strands correctly. Review, edit, download PDF.</p>
<h3>Lesson Plans — 3 minutes via EduNexus</h3>
<p>Go to Teacher Tools → Lesson Plans. Select the lesson from your SOW. System generates full lesson plan: Introduction, Steps, Conclusion, Extended Activities — correct KICD flow. Edit any section, download.</p>
<h3>Record of Work — automatic via EduNexus</h3>
<p>As you complete lessons in EduNexus, the Record of Work updates automatically. Go to Teacher Tools → Record of Work at any time to view, edit, or download. Format: clean 5-column portrait table — Date, Week/Lesson, Work Done, Reflection, Signature. No more filling in three weeks retroactively the night before the HOD visits.</p>
<h3>Report Comments — 8 minutes for 40 learners</h3>
<p>Generate comments by performance category using ChatGPT or Claude. Prompt: "I am a [subject] teacher in a Kenyan school. Write 5 different 2-sentence comments for learners who are [excellent/good/average/needs improvement]. Each comment should mention subject-specific progress, be encouraging, and suggest one area to focus on next term. Vary the sentence structure so no two comments sound the same."</p>
<h3>Parent Letters — 2 minutes</h3>
<p>Prompt: "I am a class teacher in a Kenyan school. Write a professional letter to parents informing them that [describe situation]. Keep the tone warm and respectful. Include a request for the parent to contact me by [date]. One page maximum. Leave space for my name and signature."</p>
<h3>Presentations — 2 minutes via Gamma</h3>
<p>Go to gamma.app. Click Create New → Generate. Type one sentence describing your presentation. Gamma generates a complete deck — slides, layout, content, visuals — in under 60 seconds. Edit, then export to PowerPoint or present directly. <strong>Important for low-bandwidth:</strong> always export to PDF before going to a venue without internet.</p>'
FROM academy_modules m WHERE m.slug = 'ai-time-machine';

INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'Your personal AI workflow', 3,
'<h2>Your personal AI workflow</h2>
<p>The teachers who benefit most from AI build it into a repeatable weekly routine. Here is a suggested weekly workflow — adjust based on what your week actually looks like.</p>
<div class="week-grid"><div class="day-card"><strong>Monday</strong><br>Review this week SOW<br>Generate Mon–Wed lesson plans if not done<br>Check EduNexus for student progress alerts</div><div class="day-card"><strong>Tuesday</strong><br>Teach, mark classwork<br>Use AI to generate any worksheet needed<br>Draft any parent communication</div><div class="day-card"><strong>Wednesday</strong><br>Midweek check — learners on track?<br>Generate Thu–Fri lesson plans<br>Record of Work updates automatically</div><div class="day-card"><strong>Thursday</strong><br>Teach, give and mark assessment<br>Use AI to generate rubric if needed<br>Generate next week assessment questions</div><div class="day-card"><strong>Friday</strong><br>Week wrap-up<br>EduNexus auto-generates next week plans<br><strong>Sunday evening is now free.</strong></div></div>
<div class="callout callout--purple"><strong>The shift that changes everything:</strong> Most teachers plan reactively — they plan this week''s lessons this week. AI teachers plan proactively — 20 minutes on Monday and the rest of the week is already prepared.</div>
<div class="task-box"><strong>Live lab — do this now:</strong> Open EduNexus and generate one real document for your class. SOW for this term, a lesson plan for next week, or view your Record of Work. Share a screenshot in the WhatsApp group.</div>'
FROM academy_modules m WHERE m.slug = 'ai-time-machine';

-- ============================================================
-- MODULE 5: AI Safety
-- ============================================================
INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'What AI gets wrong and why it matters', 1,
'<h2>What AI gets wrong and why it matters</h2>
<p>As a professional whose work directly affects children, you need to understand exactly what AI mistakes look like, how to spot them, and what to do about them. There are three types every teacher must know.</p>
<h3>1. Hallucinations — AI inventing facts confidently</h3>
<p>This is the most dangerous AI error for teachers. AI sometimes generates information that sounds completely correct but is entirely false — wrong dates, wrong people, wrong curriculum details, wrong scientific facts. And it states these fabrications with complete confidence.</p>
<div class="example-card"><strong>Real example:</strong> A teacher asked AI to list the CBC strands for Grade 8 Science. The AI listed six strands with correct-sounding names — but two of them do not exist in the KICD curriculum.</div>
<div class="callout callout--teal"><strong>Fix:</strong> Always verify subject-specific facts, strand names, curriculum details against your KICD materials before using with learners.</div>
<h3>2. Outdated information — AI knowledge has a cutoff</h3>
<p>AI tools were trained on data up to a certain date. They do not know about CBC updates, policy changes, or curriculum developments that happened after their training ended.</p>
<div class="callout callout--teal"><strong>Fix:</strong> For anything policy-related or recently updated, verify with official KICD or Ministry of Education sources. Use AI for structure and language — not as your policy reference.</div>
<h3>3. Foreign context — AI defaults to non-Kenyan examples</h3>
<p>Without clear instructions, AI pulls examples, names, currencies, and cultural references from where it has seen the most data — usually the United States, United Kingdom, or India.</p>
<div class="callout callout--teal"><strong>Fix:</strong> Always include "use Kenyan examples, Kenyan names, Kenya Shillings, and Kenyan contexts" in your CTCF Constraints section. Every time.</div>'
FROM academy_modules m WHERE m.slug = 'ai-safety';

INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'Data privacy — what never to share', 2,
'<h2>Data privacy — what never to share</h2>
<p>When you type something into an AI tool, that information leaves your device and goes to a company''s servers. As a teacher, you handle sensitive information every day. Here is a clear guide.</p>
<div class="privacy-grid"><div class="privacy-safe"><strong>✓ Safe to share:</strong> Subject topics, strand names, general teaching scenarios, anonymised examples ("a learner who struggles with fractions"), curriculum structures, generic lesson content.</div><div class="privacy-caution"><strong>⚠ Use caution:</strong> School name, your own name in professional documents. Not dangerous — but be aware these details are stored. Avoid on public or shared devices.</div><div class="privacy-avoid"><strong>✗ Never share:</strong> Learner full names and performance data together, learner medical or family information, disciplinary case details with identifying information, parent contact details, school financial data.</div></div>
<div class="callout callout--teal"><strong>The simple rule:</strong> If you would not put the information on a public notice board outside your classroom, do not put it into a free AI tool.</div>
<h3>Report comments — the specific risk</h3>
<p>Generate comments by performance category, not by individual learner name. Never type "Write a report comment for Wanjiku who scored 34% and has been disruptive." Instead, generate a bank of comments for each performance level, then select and personalise manually.</p>'
FROM academy_modules m WHERE m.slug = 'ai-safety';

INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'Learners, AI, and academic integrity in CBC', 3,
'<h2>Learners, AI, and academic integrity in CBC</h2>
<p>Learners are using AI. Some are using it to do their assignments entirely. As a teacher, you need a clear, honest position on this.</p>
<div class="callout callout--coral"><strong>The uncomfortable truth:</strong> You cannot reliably detect AI-written work by reading it. AI detection tools are inaccurate and frequently flag human writing as AI. The smarter approach is to design assessments where AI use does not undermine learning.</div>
<h3>The honest conversation to have with your class</h3>
<p>"AI tools exist and I know you use them. Using AI to do your work for you means you learn nothing and you will struggle when I test you face to face. Using AI to help you understand and improve your work is a skill I want you to develop. The difference is in how you use it — and your results will show me which one you chose."</p>
<h3>Assessments AI cannot easily do for learners</h3>
<table class="guide-table"><thead><tr><th>Assessment type</th><th>Safer design</th></tr></thead><tbody><tr><td>Take-home essay</td><td>Require specific personal experience or in-class oral defence</td></tr><tr><td>Research project</td><td>Require a process portfolio — notes, drafts, sources over time</td></tr><tr><td>In-class written</td><td>Most reliable — no device access</td></tr><tr><td>Oral presentation</td><td>Add Q&A — AI cannot answer spontaneous questions for them</td></tr><tr><td>Practical / hands-on</td><td>Science experiments, art — cannot be AI-generated</td></tr></tbody></table>
<div class="task-box"><strong>Two tasks this week:</strong> (1) Fact-check one AI-generated document against your KICD materials. Share your finding in the group. (2) Have a 5-minute honest conversation with your class about AI. Share one thing a learner said that surprised you.</div>'
FROM academy_modules m WHERE m.slug = 'ai-safety';

-- ============================================================
-- MODULE 6: Where Do You Go From Here
-- ============================================================
INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'What you can now do', 1,
'<h2>What you can now do</h2>
<p>When you started Phase 1, AI felt like something for other people — engineers, tech companies, young people in Nairobi with laptops. Look at where you are now.</p>
<div class="achievement-grid"><div class="achievement"><strong>You understand AI</strong><br>You can explain what AI is and is not to any colleague — without jargon, without fear.</div><div class="achievement"><strong>You know the tools</strong><br>ChatGPT, Claude, Gemini, Meta AI, Gamma — you know what each one does and when to use it.</div><div class="achievement"><strong>You can prompt</strong><br>The CTCF formula is yours. You can write a prompt that gets CBC-quality output every time.</div><div class="achievement"><strong>You save real time</strong><br>SOW, lesson plans, records of work, report comments, parent letters, presentations — done in minutes.</div><div class="achievement"><strong>You use AI safely</strong><br>You know what to verify, what data never to share, and how to guide learners responsibly.</div><div class="achievement"><strong>You have a stake</strong><br>You understand why Kenyan teachers must be at the centre of how AI enters education.</div></div>
<div class="callout callout--teal"><strong>That is not a small list.</strong> Most Kenyan teachers — most teachers anywhere in the world — cannot say all six of those things. You can. That is what Phase 1 built.</div>'
FROM academy_modules m WHERE m.slug = 'where-do-you-go-from-here';

INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'The 30-day challenge', 2,
'<h2>The 30-day challenge</h2>
<p>Knowledge without practice fades. The teachers who get the most from this course are the ones who built a consistent weekly habit. One focused task per week for four weeks.</p>
<div class="challenge-grid"><div class="challenge-week"><strong>Week 1 — Your workflow established</strong><br>Use AI for every administrative document you need this week. No going back to the old way. Share in the group: total time saved this week vs the old way. One number.</div><div class="challenge-week"><strong>Week 2 — Teach a colleague</strong><br>Pick one colleague who has not joined this course. Show them one thing you learned — the SOW demo, a prompt that saves time, Gamma for presentations. Share their reaction in the group.</div><div class="challenge-week"><strong>Week 3 — AI conversation with your class</strong><br>Have the honest conversation with your learners that Module 5 described. Listen to what they say. Share one thing a learner said that surprised you.</div><div class="challenge-week"><strong>Week 4 — Create something new</strong><br>Use AI to create one resource you have never had time to make before — a revision worksheet, a rubric, a visual aid. Share a screenshot in the group.</div></div>'
FROM academy_modules m WHERE m.slug = 'where-do-you-go-from-here';

INSERT INTO academy_lessons (module_id, title, "order", content)
SELECT m.id, 'Your stake in AI''s future in Kenya', 3,
'<h2>Your stake in AI''s future in Kenya</h2>
<p>This is not a motivational speech. It is a factual statement about where things are heading and why your position as a Kenyan teacher matters more than you might think.</p>
<p>Foreign technology companies are building AI tools for education right now. Some are already approaching Kenyan schools. Most of these tools were built without a single Kenyan teacher in the room. They do not know CBC. They do not know what a Grade 8 classroom in Kangai looks like on a Wednesday afternoon.</p>
<div class="sovereignty-box"><strong>EduNexus was built by a Kenyan teacher, for Kenyan teachers, on Kenyan curriculum.</strong> Every prompt you write, every document you generate, every piece of feedback you give makes this platform more accurate, more Kenyan, more yours. You are not just a user. You are a co-creator of what AI in Kenyan education becomes. That is the difference between a future where Kenyan education is shaped by Kenyans — and one where it is shaped by whoever arrived first with the most money.</div>
<div class="callout callout--purple"><strong>That is what "AI Pioneer Teacher" means.</strong> Not that you know the most about technology. That you were one of the first Kenyan teachers who decided this mattered — and did something about it.</div>
<h3>Phase 2 — what comes next</h3>
<p><strong>Teacher Creator Economy:</strong> Your knowledge is a product. How to create revision books, worksheets, digital resources — and sell them.</p>
<p><strong>No-code and vibe coding:</strong> Build a marks calculator. Build a quiz generator. Build a revision website. Using AI, no coding knowledge required.</p>
<p><strong>Advanced AI tools:</strong> Image generation for teaching materials. AI for differentiated instruction. Supporting learners with different needs.</p>
<p><strong>Community leadership:</strong> Phase 2 teachers become mentors for incoming Phase 1 cohorts. Your experience becomes someone else''s starting point.</p>
<div class="task-box"><strong>Three things before you close this module:</strong><br>1. Download your certificate. Share it in the WhatsApp group with one sentence — what Phase 1 changed for you as a teacher.<br>2. Write the name of one colleague you will tell about EduNexus this week.<br>3. Read the Phase 2 preview. Pick the one pillar that excites you most.</div>
<div class="final-message"><strong>You started this course as a teacher who had heard of AI.</strong> You are finishing it as a teacher who uses AI — confidently, safely, and in a way that gives your learners better lessons and gives you your evenings back. Welcome to the EduNexus AI Teachers Circle. See you in Phase 2.</div>'
FROM academy_modules m WHERE m.slug = 'where-do-you-go-from-here';


-- 20260614155724 add_practice_prompt_to_academy_lessons
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS practice_prompt text;

-- 20260620104131 academy_phase2_practice_link
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS practice_link TEXT;

-- 20260621083403 add_learning_objective_and_competency_tags_to_academy_lessons
ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS learning_objective text, ADD COLUMN IF NOT EXISTS competency_tags text[] NOT NULL DEFAULT '{}';

-- 20260621083416 create_academy_reflections
CREATE TABLE IF NOT EXISTS academy_reflections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, lesson_id uuid NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE, module_id uuid NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE, tried text NOT NULL DEFAULT '', worked text NOT NULL DEFAULT '', failed text NOT NULL DEFAULT '', surprised text NOT NULL DEFAULT '', next_action text NOT NULL DEFAULT '', ai_feedback text, quality_score smallint CHECK (quality_score BETWEEN 1 AND 5), word_count int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(teacher_id, lesson_id)); CREATE INDEX IF NOT EXISTS idx_academy_reflections_teacher ON academy_reflections(teacher_id); CREATE INDEX IF NOT EXISTS idx_academy_reflections_lesson ON academy_reflections(lesson_id); CREATE INDEX IF NOT EXISTS idx_academy_reflections_module ON academy_reflections(module_id);

-- 20260621084600 create_academy_missions_and_xp
CREATE TABLE IF NOT EXISTS academy_missions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), module_id uuid NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE, phase smallint NOT NULL, title text NOT NULL, description text NOT NULL, instructions text NOT NULL DEFAULT '', mission_type text NOT NULL CHECK (mission_type IN ('compare','create','apply','investigate','teach','build')), tool_a_label text, tool_b_label text, tool_a_prompt text, tool_b_link text, evaluation_rubric jsonb, xp_reward int NOT NULL DEFAULT 50, "order" int NOT NULL DEFAULT 1, published boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()); CREATE INDEX IF NOT EXISTS idx_academy_missions_module ON academy_missions(module_id); CREATE INDEX IF NOT EXISTS idx_academy_missions_phase ON academy_missions(phase); CREATE TABLE IF NOT EXISTS academy_mission_completions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, mission_id uuid NOT NULL REFERENCES academy_missions(id) ON DELETE CASCADE, tool_a_output text, tool_b_output text, comparison_notes text, self_scores jsonb, ai_score smallint CHECK (ai_score BETWEEN 1 AND 5), ai_verdict text, completed_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(teacher_id, mission_id)); CREATE INDEX IF NOT EXISTS idx_mission_completions_teacher ON academy_mission_completions(teacher_id); CREATE INDEX IF NOT EXISTS idx_mission_completions_mission ON academy_mission_completions(mission_id); CREATE TABLE IF NOT EXISTS academy_xp_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, event_type text NOT NULL, xp_earned int NOT NULL, metadata jsonb, created_at timestamptz NOT NULL DEFAULT now()); CREATE INDEX IF NOT EXISTS idx_xp_events_teacher ON academy_xp_events(teacher_id);

-- 20260621090319 create_academy_evidence
CREATE TABLE IF NOT EXISTS academy_evidence (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, lesson_id uuid NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE, evidence_type text NOT NULL CHECK (evidence_type IN ('text','link','plan_id')), content text, linked_id uuid, linked_title text, description text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- 20260621090326 create_academy_evidence_indexes
CREATE INDEX IF NOT EXISTS idx_academy_evidence_teacher ON academy_evidence(teacher_id); CREATE INDEX IF NOT EXISTS idx_academy_evidence_lesson ON academy_evidence(lesson_id);

-- 20260621092406 academy_competencies

CREATE TABLE academy_competencies (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  description text NOT NULL,
  category    text NOT NULL,
  color       text NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE academy_competencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read academy_competencies" ON academy_competencies FOR SELECT USING (true);

INSERT INTO academy_competencies (id, label, description, category, color) VALUES
  ('AIL-01', 'AI Literacy',              'Understanding AI capabilities, limitations, and how it works',                   'ai_skills',   '#14b8a6'),
  ('AIJ-01', 'AI Judgement',             'Critically evaluating AI outputs before using them in class',                    'ai_skills',   '#0891b2'),
  ('DIG-01', 'Digital Integration',      'Using digital and AI tools effectively in daily teaching',                       'ai_skills',   '#6366f1'),
  ('CLC-01', 'CBC Curriculum Literacy',  'Deep knowledge of CBC strands, sub-strands, competencies, and assessment',       'pedagogy',    '#f97316'),
  ('PED-01', 'Learner-Centred Pedagogy', 'Facilitating rather than delivering — learner agency and inquiry at the centre', 'pedagogy',    '#ec4899'),
  ('ASS-01', 'Competency-Based Assessment', 'Designing assessments that measure CBC competencies not just recall',         'pedagogy',    '#8b5cf6'),
  ('DIF-01', 'Differentiated Instruction', 'Adapting content, process, and product for diverse Kenyan learners',          'pedagogy',    '#d946ef'),
  ('VLP-01', 'Values & PCIs Integration', 'Embedding CBC values, PCIs, and life skills authentically in lessons',         'values',      '#f59e0b'),
  ('REF-01', 'Reflective Practice',       'Systematic reflection on teaching impact and continuous professional growth',   'values',      '#7c3aed'),
  ('IMP-01', 'Learner Impact',            'Demonstrating measurable improvement in learner outcomes',                     'values',      '#059669'),
  ('COL-01', 'Professional Collaboration','Sharing, mentoring, and learning alongside colleagues',                        'leadership',  '#0ea5e9'),
  ('INN-01', 'Innovation & Leadership',   'Pioneering new AI-powered approaches and leading others',                      'leadership',  '#e11d48');


-- 20260621092413 academy_module_competencies

CREATE TABLE academy_module_competencies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     uuid NOT NULL REFERENCES academy_modules(id) ON DELETE CASCADE,
  competency_id text NOT NULL REFERENCES academy_competencies(id) ON DELETE CASCADE,
  weight        numeric DEFAULT 1.0 NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE(module_id, competency_id)
);

ALTER TABLE academy_module_competencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read academy_module_competencies" ON academy_module_competencies FOR SELECT USING (true);
CREATE INDEX idx_amc_module_id     ON academy_module_competencies(module_id);
CREATE INDEX idx_amc_competency_id ON academy_module_competencies(competency_id);


-- 20260621093230 academy_cohorts

CREATE TABLE academy_cohorts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  school          text,
  join_code       text UNIQUE NOT NULL,
  lead_teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE academy_cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cohort read by lead or member" ON academy_cohorts
  FOR SELECT USING (
    lead_teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

CREATE INDEX idx_academy_cohorts_lead ON academy_cohorts(lead_teacher_id);
CREATE INDEX idx_academy_cohorts_code ON academy_cohorts(join_code);


-- 20260621093253 academy_cohort_members

CREATE TABLE academy_cohort_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id   uuid NOT NULL REFERENCES academy_cohorts(id) ON DELETE CASCADE,
  teacher_id  uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  joined_at   timestamptz DEFAULT now() NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE(cohort_id, teacher_id)
);

ALTER TABLE academy_cohort_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member read own membership" ON academy_cohort_members
  FOR SELECT USING (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    OR cohort_id IN (
      SELECT id FROM academy_cohorts
      WHERE lead_teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Member insert own" ON academy_cohort_members
  FOR INSERT WITH CHECK (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "Lead delete members" ON academy_cohort_members
  FOR DELETE USING (
    cohort_id IN (
      SELECT id FROM academy_cohorts
      WHERE lead_teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );

CREATE INDEX idx_acm_cohort_id   ON academy_cohort_members(cohort_id);
CREATE INDEX idx_acm_teacher_id  ON academy_cohort_members(teacher_id);


-- 20260621093311 academy_cohorts_member_read_policy

CREATE POLICY "Cohort read by member" ON academy_cohorts
  FOR SELECT USING (
    id IN (
      SELECT cohort_id FROM academy_cohort_members
      WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );


-- 20260628131055 academy_rls_policies

-- Enable RLS on all 5 academy tables and add appropriate policies.
--
-- Ownership model:
--   academy_missions          → content table seeded by admin, authenticated users read-only
--   academy_reflections       → teacher owns their own rows (CRUD)
--   academy_mission_completions → teacher owns their own rows (CRUD)
--   academy_xp_events         → teacher owns their own rows (read + insert only — XP is permanent)
--   academy_evidence          → teacher owns their own rows (CRUD)

-- ── academy_missions ─────────────────────────────────────────────────────────
ALTER TABLE public.academy_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY academy_missions_read_authenticated
  ON public.academy_missions
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update/delete missions (admin seeded content)

-- ── academy_reflections ───────────────────────────────────────────────────────
ALTER TABLE public.academy_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY academy_reflections_teacher_select
  ON public.academy_reflections
  FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY academy_reflections_teacher_insert
  ON public.academy_reflections
  FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY academy_reflections_teacher_update
  ON public.academy_reflections
  FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY academy_reflections_teacher_delete
  ON public.academy_reflections
  FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- ── academy_mission_completions ───────────────────────────────────────────────
ALTER TABLE public.academy_mission_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY academy_mission_completions_teacher_select
  ON public.academy_mission_completions
  FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY academy_mission_completions_teacher_insert
  ON public.academy_mission_completions
  FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY academy_mission_completions_teacher_update
  ON public.academy_mission_completions
  FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY academy_mission_completions_teacher_delete
  ON public.academy_mission_completions
  FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

-- ── academy_xp_events ─────────────────────────────────────────────────────────
-- XP events are permanent — no update or delete allowed even by the owner.
ALTER TABLE public.academy_xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY academy_xp_events_teacher_select
  ON public.academy_xp_events
  FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY academy_xp_events_teacher_insert
  ON public.academy_xp_events
  FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

-- ── academy_evidence ──────────────────────────────────────────────────────────
ALTER TABLE public.academy_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY academy_evidence_teacher_select
  ON public.academy_evidence
  FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY academy_evidence_teacher_insert
  ON public.academy_evidence
  FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY academy_evidence_teacher_update
  ON public.academy_evidence
  FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY academy_evidence_teacher_delete
  ON public.academy_evidence
  FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());


