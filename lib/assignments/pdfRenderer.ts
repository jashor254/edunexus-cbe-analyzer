export interface PrintAssignmentOptions {
  assignment: {
    title: string
    subject: string
    topic: string
    instructions: string
    due_date: string
    max_score: number
  }
  meta?: {
    school?: string
    grade?: string
    teacher_name?: string
    class_name?: string
  }
  level: 1 | 2 | 3 | 4
  studentName?: string
}

const LEVELS = {
  1: { name: 'Emerging',    colour: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
  2: { name: 'Approaching', colour: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  3: { name: 'Meeting',     colour: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
  4: { name: 'Exceeding',   colour: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
}

const SCAFFOLDS = {
  1: 'Recall what you learnt in class. Use your notes and diagrams to help you. Focus on the key words.',
  2: 'Use what you learnt in class. Show all your working and give examples where you can.',
  3: 'Apply what you know to new situations. Explain your reasoning clearly.',
  4: 'Go beyond the lesson — connect ideas, evaluate different approaches, and justify your thinking.',
}

function buildTasks(topic: string, instructions: string, level: 1 | 2 | 3 | 4) {
  const t = topic
  const instr = instructions.slice(0, 100)

  const tasks: Record<1 | 2 | 3 | 4, { question: string; lines: number; marks: number }[]> = {
    1: [
      { question: `What is <strong>${t}</strong>? Write the meaning in your own words.`, lines: 3, marks: 2 },
      { question: `List <strong>two examples</strong> of ${t} that you have seen in real life.`, lines: 3, marks: 2 },
      { question: `Complete the sentence: "<em>${t} is important because…</em>"`, lines: 2, marks: 2 },
      { question: `Draw a simple diagram or picture to show what you understand about ${t}.`, lines: 6, marks: 4 },
    ],
    2: [
      { question: `Explain what <strong>${t}</strong> means and give <strong>one</strong> real-world example.`, lines: 4, marks: 3 },
      { question: `Describe two key steps or ideas involved in ${t}. Use what you learnt in class.`, lines: 4, marks: 4 },
      { question: `What is one question you still have about ${t}?`, lines: 2, marks: 1 },
      { question: `Give one <strong>advantage</strong> and one <strong>disadvantage</strong> related to ${t}.`, lines: 4, marks: 4 },
    ],
    3: [
      { question: `Using your knowledge of <strong>${t}</strong>, answer the following: <em>${instr}…</em> Show all working.`, lines: 5, marks: 5 },
      { question: `Compare and contrast two aspects of ${t}. Use specific evidence from your studies.`, lines: 4, marks: 4 },
      { question: `How does understanding ${t} help solve real-life problems? Give a detailed explanation.`, lines: 4, marks: 4 },
      { question: `Design a short activity or experiment that would demonstrate the key concept in ${t}.`, lines: 5, marks: 7 },
    ],
    4: [
      { question: `Critically evaluate the importance of <strong>${t}</strong>. Use evidence to support your argument.`, lines: 6, marks: 6 },
      { question: `Create an original problem involving ${t} and explain your solution step by step.`, lines: 5, marks: 5 },
      { question: `Connect ${t} to a concept you have learnt in another subject. What links can you identify?`, lines: 4, marks: 4 },
      { question: `Explain ${t} as if you were teaching it to a younger student. Include a helpful analogy.`, lines: 5, marks: 5 },
    ],
  }
  return tasks[level]
}

export function generateAssignmentPDF(opts: PrintAssignmentOptions): string {
  const { assignment, meta, level, studentName } = opts
  const lbl = LEVELS[level]
  const scaffold = SCAFFOLDS[level]
  const tasks = buildTasks(assignment.topic, assignment.instructions, level)

  const dueFormatted = (() => {
    try {
      return new Date(assignment.due_date).toLocaleDateString('en-KE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    } catch {
      return assignment.due_date
    }
  })()

  const totalMarks = tasks.reduce((s, t) => s + t.marks, 0)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${assignment.title} — Level ${level} (${lbl.name})</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11pt;color:#111;padding:18mm 20mm}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #111;padding-bottom:10px;margin-bottom:14px}
.title{font-size:15pt;font-weight:bold;margin-bottom:3px}
.subtitle{font-size:9.5pt;color:#555}
.school{font-size:8.5pt;color:#777;margin-top:2px}
.badge{padding:5px 14px;border-radius:5px;font-weight:bold;font-size:11pt;background:${lbl.bg};color:${lbl.colour};border:1.5px solid ${lbl.border};white-space:nowrap}
.info-row{display:flex;gap:18px;padding:8px 0;border-bottom:1px solid #e0e0e0;margin-bottom:16px;flex-wrap:wrap}
.info-cell{display:flex;flex-direction:column;min-width:120px}
.info-label{font-size:7.5pt;color:#999;text-transform:uppercase;letter-spacing:.5px}
.info-val{font-weight:bold;font-size:10.5pt;border-bottom:1px solid #aaa;min-width:140px;padding-bottom:1px}
.instr-box{background:#f7f7f7;border-left:3px solid #0d9488;padding:9px 13px;margin-bottom:14px;font-size:10pt;line-height:1.5}
.scaffold{background:${lbl.bg};border:1px dashed ${lbl.colour}40;padding:7px 12px;margin-bottom:18px;font-size:9.5pt;color:${lbl.colour};border-radius:4px}
.question{margin-bottom:20px;page-break-inside:avoid}
.q-num{font-weight:bold;font-size:11pt;margin-bottom:5px}
.q-marks{font-size:8.5pt;color:#777;font-weight:normal;margin-left:6px}
.q-text{font-size:10.5pt;margin-bottom:8px;line-height:1.5}
.ans-line{border-bottom:1px solid #ccc;height:22px;margin-bottom:2px}
.parent-section{margin-top:28px;border-top:2px dashed #bbb;padding-top:14px;page-break-inside:avoid}
.parent-title{font-size:10.5pt;font-weight:bold;margin-bottom:6px}
.parent-note{font-size:9pt;color:#666;margin-bottom:14px}
.sig-row{display:flex;gap:32px}
.sig{flex:1;border-bottom:1px solid #555;padding-top:22px;font-size:8.5pt;color:#777}
.footer{margin-top:20px;font-size:7.5pt;color:#bbb;text-align:center}
@media print{body{padding:14mm 16mm}}
</style>
</head>
<body>

<div class="top">
  <div>
    <div class="title">${assignment.title}</div>
    <div class="subtitle">${assignment.subject}&nbsp;·&nbsp;${assignment.topic}</div>
    ${meta?.school ? `<div class="school">${meta.school}${meta.grade ? `&nbsp;·&nbsp;Grade ${meta.grade}` : ''}${meta.class_name ? `&nbsp;·&nbsp;${meta.class_name}` : ''}</div>` : ''}
  </div>
  <div class="badge">Level ${level}&nbsp;—&nbsp;${lbl.name}</div>
</div>

<div class="info-row">
  <div class="info-cell">
    <span class="info-label">Student Name</span>
    <span class="info-val">${studentName || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</span>
  </div>
  <div class="info-cell">
    <span class="info-label">Reg / Adm No.</span>
    <span class="info-val">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
  </div>
  <div class="info-cell">
    <span class="info-label">Due Date</span>
    <span class="info-val" style="font-weight:normal">${dueFormatted}</span>
  </div>
  <div class="info-cell">
    <span class="info-label">Score</span>
    <span class="info-val">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; / ${totalMarks}</span>
  </div>
</div>

<div class="instr-box"><strong>Instructions:</strong> ${assignment.instructions}</div>
<div class="scaffold"><strong>Tip for Level ${level}:</strong> ${scaffold}</div>

${tasks.map((task, i) => `
<div class="question">
  <div class="q-num">Question ${i + 1}<span class="q-marks">(${task.marks} mark${task.marks !== 1 ? 's' : ''})</span></div>
  <div class="q-text">${task.question}</div>
  ${Array.from({ length: task.lines }, () => '<div class="ans-line"></div>').join('')}
</div>`).join('')}

<div class="parent-section">
  <div class="parent-title">Parent / Guardian Acknowledgement</div>
  <div class="parent-note">I have seen my child's completed work and supported them where needed.</div>
  <div class="sig-row">
    <div class="sig">Parent Signature</div>
    <div class="sig">Date Seen</div>
    <div class="sig">Comment (optional)</div>
  </div>
</div>

<div class="footer">EduNexus &nbsp;·&nbsp; edunexus.co.ke</div>
</body>
</html>`
}

export function generateClassSetHTML(opts: Omit<PrintAssignmentOptions, 'level' | 'studentName'>): string {
  return [1, 2, 3, 4].map((level) =>
    `<div style="page-break-after:always">${generateAssignmentPDF({ ...opts, level: level as 1 | 2 | 3 | 4 })
      .replace(/<!DOCTYPE html>[\s\S]*?<body>/, '')
      .replace(/<\/body>[\s\S]*?<\/html>/, '')
    }</div>`
  ).join('')
}
