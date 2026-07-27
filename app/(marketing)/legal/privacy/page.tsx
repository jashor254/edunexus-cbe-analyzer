import Link from 'next/link'
import {
  ArrowLeft, Shield, Users, Baby, Brain, Share2,
  Lock, Scale, Cookie, Bell, Mail, Clock, FileText,
  Globe, AlertTriangle, CheckCircle, Gavel,
} from 'lucide-react'
import { FOCUS_RING, FOCUS_RING_ON_LIGHT } from '../../constants'

export const metadata = {
  title: 'Privacy Policy | EduNexus',
  description:
    'How EduNexus by Jashor Technologies collects, uses, and protects your data — fully compliant with the Kenya Data Protection Act 2019.',
}

const SECTIONS = [
  { id: 'who-we-are',             label: 'Who We Are' },
  { id: 'data-collected',         label: 'Data We Collect' },
  { id: 'legal-basis',            label: 'Legal Basis' },
  { id: 'how-we-use',             label: 'How We Use It' },
  { id: 'childrens-data',         label: "Children's Data" },
  { id: 'school-data-controller', label: 'Schools & EduNexus Core' },
  { id: 'ai-data',                label: 'AI & Your Data' },
  { id: 'data-sharing',           label: 'Data Sharing' },
  { id: 'cross-border',           label: 'International Transfers' },
  { id: 'retention',              label: 'How Long We Keep It' },
  { id: 'security',               label: 'Security' },
  { id: 'your-rights',            label: 'Your Rights' },
  { id: 'automated',              label: 'Automated Decisions' },
  { id: 'cookies',                label: 'Cookies' },
  { id: 'changes',                label: 'Policy Changes' },
  { id: 'contact',                label: 'Contact & Complaints' },
]

function SectionHead({
  id, icon, number, title, badge,
}: { id: string; icon: React.ReactNode; number?: string; title: string; badge?: string }) {
  return (
    <div id={id} className="flex items-center gap-3 mb-5 scroll-mt-24">
      <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
        {number
          ? <span className="text-sm font-black text-slate-500">{number}</span>
          : icon}
      </div>
      <h2 className="text-xl font-black text-slate-900">{title}</h2>
      {badge && (
        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg">
          {badge}
        </span>
      )}
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* ── HERO HEADER ───────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-12">
        <div className="max-w-5xl mx-auto px-6">
          <nav className="flex items-center gap-2 text-xs text-slate-400 mb-5">
            <Link href="/" className={`hover:text-white transition rounded ${FOCUS_RING}`}>Home</Link>
            <span>/</span>
            <Link href="/legal" className={`hover:text-white transition rounded ${FOCUS_RING}`}>Legal</Link>
            <span>/</span>
            <span className="text-white">Privacy Policy</span>
          </nav>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-teal-500/20 rounded-2xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-teal-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black">Privacy Policy</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Last updated: 29 June 2026
            </span>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 text-slate-300 border border-white/15">
              Kenya Data Protection Act 2019
            </span>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 text-slate-300 border border-white/15">
              EduNexus Kenya · edunexus.co.ke
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">

          {/* ── STICKY TABLE OF CONTENTS (desktop only) ─────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Contents</p>
              <nav className="space-y-1">
                {SECTIONS.map(s => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={`block text-sm text-slate-500 hover:text-teal-600 hover:translate-x-1 transition-all py-0.5 rounded ${FOCUS_RING_ON_LIGHT}`}
                  >
                    {s.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* ── MAIN CONTENT ────────────────────────────────────────── */}
          <div className="space-y-12">

            {/* Plain-language callout */}
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
              <p className="text-teal-800 text-base leading-relaxed">
                We wrote this in plain language so every Kenyan parent, teacher, and student understands exactly what
                data we collect and why. If anything is unclear, email us at{' '}
                <a href="mailto:support@edunexus.co.ke" className={`font-bold underline rounded ${FOCUS_RING_ON_LIGHT}`}>
                  support@edunexus.co.ke
                </a>{' '}
                — we will respond within 7 business days.
              </p>
            </div>

            {/* ── 1. WHO WE ARE ──────────────────────────────────────── */}
            <section>
              <SectionHead id="who-we-are" icon={<FileText className="w-4 h-4 text-slate-500" />} number="1" title="Who We Are" />
              <div className="space-y-4 text-slate-700 text-base leading-relaxed">
                <p>
                  <strong>EduNexus</strong> is an AI-powered education platform developed and operated by{' '}
                  <strong>Jashor Technologies</strong>, incorporated in Kenya. We serve students, parents, and teachers
                  navigating the CBC Junior (Grade 7–9), CBC Senior (Grade 10–12), and 8-4-4 (Form 3–4) curricula.
                </p>
                <p>
                  Through <strong>EduNexus Core</strong>, we also provide school management services to Kenyan
                  registered schools (PP1–Grade 9), enabling headteachers, deputy headteachers, school administrators,
                  and teachers to manage learner admissions, class enrolments, assessments, report cards, and
                  transfers. In this context the school is the Data Controller for learner records it creates; see
                  Section 6 for the full explanation of that relationship.
                </p>
                <p>
                  Under the Kenya Data Protection Act 2019, Jashor Technologies is the <strong>Data Controller</strong>{' '}
                  for all personal data processed through the EduNexus platform, which it operates in Kenya under
                  the business name <strong>EduNexus Kenya</strong>.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 grid sm:grid-cols-2 gap-3 text-sm">
                  {[
                    ['Data Controller', 'Jashor Technologies'],
                    ['Trading as', 'EduNexus Kenya'],
                    ['Product', 'EduNexus Platform'],
                    ['Registration', 'Kenya'],
                    ['Website', 'edunexus.co.ke'],
                    ['Email', 'support@edunexus.co.ke'],
                    ['Support line', '+254 710 798 030 (WhatsApp)'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-slate-400 shrink-0">{k}:</span>
                      <span className="font-semibold text-slate-800">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── 2. DATA COLLECTED ───────────────────────────────────── */}
            <section>
              <SectionHead id="data-collected" icon={<Users className="w-4 h-4 text-slate-500" />} number="2" title="What Data We Collect" />
              <div className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                    <h3 className="font-black text-blue-800 mb-3 text-sm uppercase tracking-wide">Student / Consumer Data</h3>
                    <ul className="space-y-1.5 text-sm text-blue-700">
                      <li>• Full name, grade level, school</li>
                      <li>• Term assessment scores (CBC levels 1–4)</li>
                      <li>• Learning Compass session history</li>
                      <li>• Career interests & pathway</li>
                      <li>• XP points, streaks, milestones</li>
                      <li>• Study group membership & answers</li>
                    </ul>
                  </div>
                  <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                    <h3 className="font-black text-violet-800 mb-3 text-sm uppercase tracking-wide">Parent / Guardian Data</h3>
                    <ul className="space-y-1.5 text-sm text-violet-700">
                      <li>• Full name</li>
                      <li>• Phone number (WhatsApp)</li>
                      <li>• Email address</li>
                      <li>• Child's academic reports received</li>
                      <li>• Payment records (Paystack)</li>
                      <li>• National ID number <em>(Core schools only — for guardian verification)</em></li>
                      <li>• Relationship to learner</li>
                    </ul>
                  </div>
                  <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4">
                    <h3 className="font-black text-teal-800 mb-3 text-sm uppercase tracking-wide">Teacher / School Staff Data</h3>
                    <ul className="space-y-1.5 text-sm text-teal-700">
                      <li>• Full name, school</li>
                      <li>• Subjects & grades taught</li>
                      <li>• Class lists & student records</li>
                      <li>• Scheme of work content</li>
                      <li>• Lesson plan content</li>
                      <li>• Token balance & usage</li>
                      <li>• School role (headteacher, deputy, admin, teacher)</li>
                    </ul>
                  </div>
                </div>

                {/* EduNexus Core learner data */}
                <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-black bg-rose-200 text-rose-800 px-2.5 py-1 rounded-lg uppercase tracking-wide">EduNexus Core — School Learner Registry</span>
                  </div>
                  <p className="text-sm text-rose-800 mb-4 leading-relaxed">
                    When a school onboards to EduNexus Core, its administrators create official learner records on behalf
                    of the school. This data is collected under the school's authority as Data Controller (see Section 6).
                    The following data categories are collected:
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="font-bold text-rose-900 text-xs uppercase tracking-wide mb-2">Learner Identity</p>
                      <ul className="space-y-1 text-sm text-rose-700">
                        <li>• Full name, date of birth, gender</li>
                        <li>• Admission number (school-assigned)</li>
                        <li>• UPI / NEMIS pupil number <em>(government identifier)</em></li>
                        <li>• Nationality, county of origin</li>
                        <li>• Passport photo URL <em>(optional)</em></li>
                        <li>• Special educational needs <em>(see below — sensitive data)</em></li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-bold text-rose-900 text-xs uppercase tracking-wide mb-2">Academic Records</p>
                      <ul className="space-y-1 text-sm text-rose-700">
                        <li>• Enrolment history (class, term, academic year)</li>
                        <li>• Assessment scores and CBC performance levels</li>
                        <li>• Term subject summaries & class position</li>
                        <li>• Teacher and headteacher comments</li>
                        <li>• Attendance (days present / absent)</li>
                        <li>• Promotion decisions (promoted/repeated/graduated)</li>
                        <li>• Transfer records and reason for transfer</li>
                        <li>• Official school report card PDFs</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 bg-red-100 border border-red-300 rounded-xl p-4">
                    <p className="font-black text-red-800 text-sm mb-1">⚠ Special Category Data — Special Educational Needs</p>
                    <p className="text-sm text-red-700 leading-relaxed">
                      The <code className="bg-red-200 px-1 rounded text-xs">special_needs</code> field may contain information about a learner's
                      disabilities, learning difficulties, or medical conditions. Under Section 46 of the Kenya Data Protection Act 2019,
                      this is <strong>sensitive personal data</strong> that may only be processed with <strong>explicit written consent</strong>{' '}
                      from a parent or guardian, or where processing is necessary for the provision of educational support services.
                      Schools must obtain this consent before entering special needs information into EduNexus Core.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <h3 className="font-black text-slate-600 mb-3 text-sm uppercase tracking-wide">School Institution Data</h3>
                  <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600">
                    <li>• School name, type, NEMIS school code</li>
                    <li>• County, sub-county, ward, physical address</li>
                    <li>• Contact phone & email</li>
                    <li>• School logo, motto</li>
                    <li>• Curriculum type (CBC, 8-4-4, IGCSE)</li>
                    <li>• Academic year and term configuration</li>
                  </ul>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                    <h3 className="font-black text-amber-800 mb-3 text-sm uppercase tracking-wide">Study Group Data</h3>
                    <ul className="space-y-1.5 text-sm text-amber-700">
                      <li>• Group name, subject, grade</li>
                      <li>• Member list (names, points, streaks)</li>
                      <li>• Daily challenge answers (with correctness)</li>
                      <li>• Leaderboard positions</li>
                    </ul>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <h3 className="font-black text-slate-600 mb-3 text-sm uppercase tracking-wide">Usage Data (Automatic)</h3>
                    <ul className="space-y-1.5 text-sm text-slate-600">
                      <li>• Pages visited, features used</li>
                      <li>• Session duration and frequency</li>
                      <li>• Device type (mobile/desktop)</li>
                      <li>• Browser type and OS</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* ── 3. LEGAL BASIS ─────────────────────────────────────── */}
            <section>
              <SectionHead id="legal-basis" icon={<Gavel className="w-4 h-4 text-slate-500" />} number="3" title="Legal Basis for Processing" />
              <p className="text-slate-700 text-base leading-relaxed mb-4">
                Under Section 30 of the Kenya Data Protection Act 2019, we must have a lawful basis for processing
                each category of personal data. The table below sets out the basis for each type.
              </p>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="text-left px-4 py-3 font-black rounded-tl-2xl">Data Category</th>
                      <th className="text-left px-4 py-3 font-black">Legal Basis</th>
                      <th className="text-left px-4 py-3 font-black rounded-tr-2xl">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ['Student academic data (consumer app)', 'Consent', 'Provided by parent/guardian at registration'],
                      ['Student learning sessions', 'Consent + Legitimate Interest', 'To deliver personalised education'],
                      ['Parent contact details (consumer app)', 'Consent', 'Provided at signup; used to send reports'],
                      ['Teacher account data', 'Contractual Necessity', 'Required to provide the subscribed service'],
                      ['Payment records', 'Legal Obligation', 'Financial record-keeping under Kenya tax law'],
                      ['Usage analytics', 'Legitimate Interest', 'To improve platform performance and fix bugs'],
                      ['Study group data', 'Consent', 'Student or parent chooses to join a group'],
                      ['School institution data', 'Contractual Necessity', 'Required to set up and operate EduNexus Core for the school'],
                      ['School staff roles & access', 'Contractual Necessity', 'Required to provide Core services; school is responsible for staff notice'],
                      ['Learner registry data (Core)', 'Legal Obligation + Contractual Necessity', 'Schools are required under the Kenya Education Act to maintain learner records; EduNexus processes these on the school\'s instruction'],
                      ['Guardian contact data (Core)', 'Contractual Necessity + Consent', 'Collected by school for communication; guardian consent is the school\'s responsibility'],
                      ['Formal academic records (Core)', 'Legal Obligation', 'Schools must maintain assessment and report records under MoE regulations'],
                      ['Special educational needs data', 'Explicit Consent', 'Sensitive data under DPA S.46; requires explicit written consent from parent/guardian before processing'],
                    ].map(([cat, basis, detail], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-3 font-semibold text-slate-800">{cat}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full bg-teal-100 text-teal-800">
                            {basis}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── 4. HOW WE USE IT ──────────────────────────────────── */}
            <section>
              <SectionHead id="how-we-use" icon={<Brain className="w-4 h-4 text-slate-500" />} number="4" title="How We Use Your Data" />
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                {[
                  ['📋', 'Generate Learner Blueprint reports for parents'],
                  ['🧭', 'Power the Learning Compass for each student'],
                  ['📱', 'Send academic reports via WhatsApp & email'],
                  ['📊', 'Help teachers track class performance trends'],
                  ['🏆', 'Manage study group leaderboards and challenges'],
                  ['🎯', 'Provide CBC pathway and career recommendations'],
                  ['🏫', 'Manage school learner admissions, enrolments, and transfers (Core)'],
                  ['📄', 'Generate and publish official school report cards (Core)'],
                  ['📈', 'Compute term summaries, positions, and CBC performance levels (Core)'],
                  ['🔑', 'Manage school staff roles and access permissions (Core)'],
                  ['🔧', 'Diagnose bugs and improve platform reliability'],
                  ['🛡️', 'Detect and prevent fraudulent activity'],
                ].map(([icon, text]) => (
                  <div key={text} className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl p-3.5 text-sm text-green-800">
                    <span className="shrink-0 text-base">{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                <p className="font-black text-red-800 text-sm uppercase tracking-wide mb-3">We will NEVER:</p>
                <ul className="space-y-2 text-sm text-red-700">
                  {[
                    'Sell your personal data to any third party',
                    'Use student data for commercial advertising or profiling',
                    'Share data with parties not listed in this policy',
                    'Process data beyond the purposes stated above without fresh consent',
                    'Use your data to train external AI models',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="font-black text-red-500 shrink-0">✕</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* ── 5. CHILDREN'S DATA ────────────────────────────────── */}
            <section>
              <SectionHead
                id="childrens-data"
                icon={<Baby className="w-4 h-4 text-amber-600" />}
                title="Children's Data"
                badge="Critical"
              />
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 space-y-4">
                <p className="text-amber-900 text-base leading-relaxed">
                  EduNexus serves students including minors under 18. We apply heightened protections to all student data
                  in accordance with Section 44 of the Kenya Data Protection Act 2019.
                </p>
                <div className="space-y-3">
                  {[
                    {
                      title: 'Consumer app — parental consent required',
                      desc: 'On the EduNexus consumer app, student profiles are created by a parent or guardian who agrees to this policy on the child\'s behalf. Students under 18 may not create their own accounts independently.',
                    },
                    {
                      title: 'EduNexus Core — school-created learner records',
                      desc: 'When a school uses EduNexus Core, the school (as Data Controller) creates learner records during the admission process. The school is responsible for obtaining the necessary parental consent or providing notice to guardians under the Kenya Education Act and DPA 2019. EduNexus processes these records on the school\'s instruction.',
                    },
                    {
                      title: 'Student self-login',
                      desc: 'Once a parent creates a consumer profile, students may be given their own login to access the Learning Compass, study groups, and their personal dashboard. This login is still governed by parental consent.',
                    },
                    {
                      title: 'Minimum data principle',
                      desc: 'We collect only the data strictly necessary for educational purposes. For Core learner records, admission number, UPI, and date of birth are collected to satisfy MoE/NEMIS requirements; special needs data is collected only with explicit parental consent.',
                    },
                    {
                      title: 'No advertising to minors',
                      desc: 'Student and learner data is never used for advertising, commercial profiling, or any purpose outside direct educational support.',
                    },
                    {
                      title: 'Parental access and deletion',
                      desc: 'Parents may request access to, correction of, or deletion of their child\'s data at any time by emailing support@edunexus.co.ke. For Core learner records, deletion requests that affect official school records will be processed in coordination with the school.',
                    },
                  ].map(item => (
                    <div key={item.title} className="flex items-start gap-3 bg-white/60 rounded-xl p-4">
                      <CheckCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-900 text-sm">{item.title}</p>
                        <p className="text-sm text-amber-700 mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── 6. SCHOOLS & EDUNEXUS CORE ──────────────────────────── */}
            <section>
              <SectionHead
                id="school-data-controller"
                icon={<FileText className="w-4 h-4 text-slate-500" />}
                number="6"
                title="Schools & EduNexus Core — Data Controller Relationship"
                badge="Important"
              />
              <div className="space-y-4">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 space-y-4">
                  <p className="text-blue-900 text-base leading-relaxed">
                    EduNexus Core is a school management platform. When a Kenyan school subscribes to Core, it acts as
                    an <strong>independent Data Controller</strong> for all learner records it creates within the system.
                    Jashor Technologies (EduNexus) acts as a <strong>Data Processor</strong> — processing that data only
                    on the school's documented instructions.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-white/70 rounded-xl p-4">
                      <p className="font-bold text-blue-900 text-sm mb-2">The School (Data Controller) is responsible for:</p>
                      <ul className="space-y-1.5 text-sm text-blue-700">
                        <li>• Obtaining parental/guardian consent or notice before admitting learners</li>
                        <li>• Obtaining explicit consent before entering special needs data</li>
                        <li>• Ensuring the accuracy of learner records</li>
                        <li>• Responding to data subject rights requests from parents</li>
                        <li>• Retaining records for the period required under MoE regulations</li>
                        <li>• Notifying guardians about how their child's data is managed</li>
                      </ul>
                    </div>
                    <div className="bg-white/70 rounded-xl p-4">
                      <p className="font-bold text-blue-900 text-sm mb-2">EduNexus (Data Processor) is responsible for:</p>
                      <ul className="space-y-1.5 text-sm text-blue-700">
                        <li>• Storing and securing learner data to DPA 2019 standards</li>
                        <li>• Enforcing Row Level Security so only authorised school staff can access records</li>
                        <li>• Processing data only as instructed by the school</li>
                        <li>• Notifying the school of any data breach within 72 hours</li>
                        <li>• Deleting learner data on written instruction from the school</li>
                        <li>• Never selling or sharing Core learner data with any third party</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    A Data Processing Agreement (DPA) governs this relationship. Schools that subscribe to EduNexus Core
                    are bound by that agreement. If you are a parent whose child's school uses EduNexus Core, please
                    contact your school administration regarding how your child's data is managed at school level. You
                    may also contact us at{' '}
                    <a href="mailto:support@edunexus.co.ke" className={`font-bold underline rounded ${FOCUS_RING_ON_LIGHT}`}>support@edunexus.co.ke</a>{' '}
                    and we will direct your request to the appropriate school.
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="font-bold text-amber-900 text-sm mb-1">Intelligence Bridge (Optional)</p>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    Schools may optionally enable the <strong>EduNexus Intelligence Bridge</strong> — a paid feature
                    that connects Core learner records to EduNexus OS AI modules (learning risk analysis, growth
                    milestones, remedial planning). When enabled, Core enrolment and academic performance data is
                    analysed by DeepSeek AI to produce school-level intelligence reports. This feature is off by
                    default and can only be activated by the school's headteacher or administrator. The same AI data
                    commitments listed in Section 7 apply to all Intelligence Bridge processing.
                  </p>
                </div>
              </div>
            </section>

            {/* ── 7. AI & YOUR DATA ─────────────────────────────────── */}
            <section>
              <SectionHead id="ai-data" icon={<Brain className="w-4 h-4 text-slate-500" />} number="7" title="AI and Your Data" />
              <div className="space-y-4">
                <p className="text-slate-700 text-base leading-relaxed">
                  EduNexus uses DeepSeek AI (accessed via Together AI) to power the following features:
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { icon: '🧭', label: 'Learning Compass', desc: 'Real-time personalised tutoring sessions' },
                    { icon: '📋', label: 'Learner Blueprints', desc: 'Personalised learning intelligence reports' },
                    { icon: '🎯', label: 'Career Recommendations', desc: 'Pathway suggestions based on student strengths' },
                    { icon: '🏆', label: 'Study Group Challenges', desc: 'Daily AI-generated subject questions' },
                    { icon: '📝', label: 'Scheme of Work', desc: 'AI-assisted lesson content for teachers' },
                  ].map(item => (
                    <div key={item.label} className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <span className="text-xl shrink-0">{item.icon}</span>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{item.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-900 rounded-2xl p-5 space-y-3">
                  <p className="text-white font-black text-sm uppercase tracking-wide">AI Data Commitments</p>
                  {[
                    'Student data sent to AI is minimised — only what is needed for that specific task',
                    'Together AI processes data under a Data Processing Agreement — they may not retain or reuse it',
                    'Your data is NOT used to train DeepSeek or any external AI model',
                    'AI outputs are reviewed against KICD curriculum data before being shown to students',
                    'AI-generated content is always clearly labelled as AI-assisted',
                  ].map(item => (
                    <div key={item} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-teal-400 font-black shrink-0">✓</span> {item}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── 7. DATA SHARING ──────────────────────────────────── */}
            <section>
              <SectionHead id="data-sharing" icon={<Share2 className="w-4 h-4 text-slate-500" />} number="8" title="Data Sharing — Our Processors" />
              <p className="text-slate-700 text-base mb-4">
                We share data <strong>only</strong> with the following service providers, each bound by a Data Processing
                Agreement and prohibited from using your data for their own commercial purposes:
              </p>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="text-left px-4 py-3 font-black rounded-tl-2xl">Provider</th>
                      <th className="text-left px-4 py-3 font-black">Purpose</th>
                      <th className="text-left px-4 py-3 font-black">Data Shared</th>
                      <th className="text-left px-4 py-3 font-black rounded-tr-2xl">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      {
                        name: 'Supabase',
                        purpose: 'Database & authentication',
                        data: 'All user data',
                        location: 'EU (Frankfurt)',
                        color: 'bg-green-50',
                      },
                      {
                        name: 'Together AI',
                        purpose: 'AI processing',
                        data: 'Minimised, anonymised data',
                        location: 'United States',
                        color: 'bg-blue-50',
                      },
                      {
                        name: 'Vercel',
                        purpose: 'Platform hosting & CDN',
                        data: 'Static assets only — no personal data',
                        location: 'Global CDN',
                        color: 'bg-slate-50',
                      },
                      {
                        name: 'Paystack',
                        purpose: 'Payment processing',
                        data: 'Name, email, payment details only',
                        location: 'Nigeria / Kenya',
                        color: 'bg-violet-50',
                      },
                      {
                        name: 'WhatsApp (Meta)',
                        purpose: 'Report delivery to parents',
                        data: "Parent's phone number + report content",
                        location: 'United States',
                        color: 'bg-green-50',
                      },
                    ].map(p => (
                      <tr key={p.name} className={p.color}>
                        <td className="px-4 py-3 font-black text-slate-800">{p.name}</td>
                        <td className="px-4 py-3 text-slate-600">{p.purpose}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{p.data}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">{p.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <strong>WhatsApp note:</strong> When we send a report to a parent via WhatsApp, Meta Platforms (WhatsApp's
                owner) receives the parent's phone number and the message content as part of delivering that message. Meta
                operates under its own Privacy Policy. You can opt out of WhatsApp report delivery by emailing us.
              </div>
            </section>

            {/* ── 8. CROSS-BORDER TRANSFERS ────────────────────────── */}
            <section>
              <SectionHead id="cross-border" icon={<Globe className="w-4 h-4 text-slate-500" />} number="9" title="International Data Transfers" />
              <div className="space-y-4 text-slate-700">
                <p className="text-base leading-relaxed">
                  Some of our service providers are located outside Kenya. Under Section 48 of the Kenya Data Protection
                  Act 2019, we are required to disclose these transfers and the safeguards in place.
                </p>
                <div className="space-y-3">
                  {[
                    {
                      dest: 'European Union (Supabase — Germany)',
                      color: 'border-green-200 bg-green-50',
                      badge: 'bg-green-100 text-green-700',
                      badgeText: 'GDPR Protected',
                      detail:
                        'The EU has the GDPR, which provides protections at least equivalent to the Kenya DPA 2019. Your data stored with Supabase benefits from these stronger protections.',
                    },
                    {
                      dest: 'United States (Together AI, Meta/WhatsApp, Vercel)',
                      color: 'border-amber-200 bg-amber-50',
                      badge: 'bg-amber-100 text-amber-700',
                      badgeText: 'Contractual Safeguards',
                      detail:
                        'No adequacy decision exists between Kenya and the US. We rely on Data Processing Agreements and Standard Contractual Clauses to safeguard your data with US-based processors.',
                    },
                    {
                      dest: 'Nigeria (Paystack)',
                      color: 'border-blue-200 bg-blue-50',
                      badge: 'bg-blue-100 text-blue-700',
                      badgeText: 'CBK Regulated',
                      detail:
                        'Paystack is licensed to operate in Kenya by the Central Bank of Kenya and is subject to Nigerian data protection law (NDPR 2019), which has similar requirements to the Kenya DPA.',
                    },
                  ].map(item => (
                    <div key={item.dest} className={`border rounded-2xl p-4 ${item.color}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="font-bold text-slate-800 text-sm">{item.dest}</p>
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 ${item.badge}`}>
                          {item.badgeText}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── 9. RETENTION ─────────────────────────────────────── */}
            <section>
              <SectionHead id="retention" icon={<Clock className="w-4 h-4 text-slate-500" />} number="10" title="How Long We Keep Your Data" />
              <p className="text-slate-700 text-base mb-4">
                We retain personal data only as long as necessary for the purpose it was collected, or as required by
                Kenyan law. The schedule below applies to all categories.
              </p>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="text-left px-4 py-3 font-black rounded-tl-2xl">Data Type</th>
                      <th className="text-left px-4 py-3 font-black">Retention Period</th>
                      <th className="text-left px-4 py-3 font-black rounded-tr-2xl">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ['Account & profile data', 'While account is active, then deleted within 30 days of a verified deletion request', 'Necessary to provide the service'],
                      ['Student assessment scores (consumer app)', 'While account is active + 30 days after deletion', 'Forms core of the educational record'],
                      ['Learning Compass sessions', 'While account is active + 30 days after deletion', 'Powers progress tracking'],
                      ['Study group data', 'While account is active + 30 days after deletion', 'Community feature'],
                      ['Payment records', '7 years from date of transaction', 'Kenya VAT Act & Income Tax Act obligation'],
                      ['Learner Blueprint PDFs', 'While account is active + 30 days after deletion', 'Parent record'],
                      ['AI conversation logs', 'Anonymised after 90 days, then retained for debugging', 'Platform improvement; personal data removed'],
                      ['Database backups', '30-day rolling backup window', 'Disaster recovery'],
                      ['Usage analytics', '24 months rolling', 'Platform performance monitoring'],
                      ['Core learner identity records', 'For the duration of the school\'s active subscription, then transferred to the school or deleted on instruction — minimum 3 years recommended by MoE', 'Schools have a legal duty to maintain learner records under the Kenya Education Act'],
                      ['Official school report cards', 'For the duration of the school\'s active subscription; school may request export before closing their account', 'Formal academic records — schools are responsible for long-term archiving per MoE requirements'],
                      ['Learner promotion & transfer records', 'For the duration of the school\'s active subscription + 1 year, or as instructed by the school', 'Required for school administration continuity and potential MoE audits'],
                      ['Special educational needs data', 'Deleted immediately upon written request from parent/guardian or the school; otherwise retained for duration of learner enrolment only', 'Sensitive data — minimum retention, explicit consent-based'],
                      ['Guardian national ID numbers', 'Retained while the learner is actively enrolled; deleted 30 days after learner status changes to transferred/graduated/archived', 'Collected for school verification purposes only'],
                    ].map(([type, period, reason], i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-3 font-semibold text-slate-800 align-top">{type}</td>
                        <td className="px-4 py-3 text-slate-700 align-top">{period}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs align-top">{reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
                After an account deletion request is verified, all personal data is purged from live systems within
                30 days. Payment records are the only exception due to statutory legal obligations and cannot be deleted
                within the 7-year window.
              </div>
            </section>

            {/* ── 10. SECURITY ─────────────────────────────────────── */}
            <section>
              <SectionHead id="security" icon={<Lock className="w-4 h-4 text-slate-500" />} number="11" title="Data Security" />
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: '🔐', title: 'Encrypted in transit', desc: 'All connections use TLS 1.2+. No unencrypted HTTP.' },
                  { icon: '🛡️', title: 'Row Level Security (RLS)', desc: 'Every database table enforces per-user access policies at the database layer.' },
                  { icon: '🔑', title: 'Hashed passwords', desc: 'Passwords are never stored in plain text. Supabase uses bcrypt hashing.' },
                  { icon: '🔒', title: 'Service role isolation', desc: 'The database service key is never exposed to client code. All elevated access goes through server-side routes only.' },
                  { icon: '🔍', title: 'Access logging', desc: 'All API access is logged. Suspicious patterns trigger alerts.' },
                  { icon: '♻️', title: 'Regular reviews', desc: 'We review security practices and audit data access controls on a quarterly basis.' },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <span className="text-xl shrink-0">{item.icon}</span>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                <strong>Data breach notification:</strong> If a breach occurs that is likely to result in a risk to your
                rights and freedoms, we will notify the Office of the Data Protection Commissioner (ODPC) within 72 hours
                and notify affected users without undue delay, as required by Section 43 of the Kenya DPA 2019.
              </div>
            </section>

            {/* ── 11. YOUR RIGHTS ──────────────────────────────────── */}
            <section>
              <SectionHead id="your-rights" icon={<Scale className="w-4 h-4 text-slate-500" />} number="12" title="Your Rights Under the Kenya Data Protection Act 2019" />
              <div className="grid sm:grid-cols-2 gap-3 mb-5">
                {[
                  { right: 'Right to Access (S.26)', desc: 'Request a copy of all personal data we hold about you.' },
                  { right: 'Right to Rectification (S.27)', desc: 'Require us to correct inaccurate or incomplete data.' },
                  { right: 'Right to Erasure (S.28)', desc: 'Request deletion of your data (the "right to be forgotten").' },
                  { right: 'Right to Restriction (S.29)', desc: 'Ask us to limit how we process your data in certain circumstances.' },
                  { right: 'Right to Portability (S.30)', desc: 'Receive your data in a structured, machine-readable format.' },
                  { right: 'Right to Object (S.31)', desc: 'Object to processing based on legitimate interest, including profiling.' },
                  { right: 'Withdraw Consent (S.30)', desc: 'Where processing is based on consent, you may withdraw it at any time without affecting past processing.' },
                  { right: 'Automated Decisions (S.32)', desc: 'Not be subject to decisions based solely on automated processing that significantly affects you.' },
                ].map(item => (
                  <div key={item.right} className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="font-bold text-slate-900 text-sm">{item.right}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
                <p className="font-black text-teal-900 mb-2">How to exercise your rights</p>
                <p className="text-sm text-teal-800 leading-relaxed">
                  Email{' '}
                  <a href="mailto:support@edunexus.co.ke" className={`font-bold underline rounded ${FOCUS_RING_ON_LIGHT}`}>
                    support@edunexus.co.ke
                  </a>{' '}
                  with the subject line <strong>"Data Rights Request"</strong> and your name. We will acknowledge within
                  48 hours and respond fully within <strong>21 days</strong> (the maximum allowed under the Kenya DPA 2019,
                  extendable by a further 21 days for complex requests with notice).
                </p>
              </div>
            </section>

            {/* ── 12. AUTOMATED DECISIONS ──────────────────────────── */}
            <section>
              <SectionHead id="automated" icon={<Brain className="w-4 h-4 text-slate-500" />} number="13" title="Automated Decision-Making & Profiling" />
              <div className="space-y-4 text-slate-700 text-base">
                <p className="leading-relaxed">
                  EduNexus uses automated processing (AI) to generate several outputs. Under Section 32 of the Kenya DPA 2019,
                  we must disclose where automated decisions have a significant effect on you.
                </p>
                <div className="space-y-3">
                  {[
                    {
                      feature: 'Learner Blueprint reports',
                      automated: 'AI analyses assessment scores and generates a personalised report',
                      human: 'Parents and teachers review the report; it does not make any formal academic decision',
                      significant: false,
                    },
                    {
                      feature: 'CBC pathway recommendations',
                      automated: 'AI suggests STEM, Social Sciences, or Arts & Sports based on scores',
                      human: 'Advisory only — the student and parent choose the actual pathway',
                      significant: false,
                    },
                    {
                      feature: 'Learning Compass sessions',
                      automated: 'AI adapts question difficulty based on student responses in real time',
                      human: 'Students can end a session at any time; no grades are produced',
                      significant: false,
                    },
                    {
                      feature: 'Career recommendations',
                      automated: 'AI matches student strengths to career paths from a curated KICD-aligned list',
                      human: 'Informational only — no institutional decision is made',
                      significant: false,
                    },
                  ].map(item => (
                    <div key={item.feature} className="border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 flex items-center justify-between">
                        <p className="font-bold text-slate-800 text-sm">{item.feature}</p>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                          No significant legal effect
                        </span>
                      </div>
                      <div className="px-4 py-3 grid sm:grid-cols-2 gap-3 text-xs text-slate-600">
                        <div>
                          <p className="font-bold text-slate-700 mb-1">What the AI does</p>
                          <p>{item.automated}</p>
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 mb-1">Human oversight</p>
                          <p>{item.human}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-500">
                  None of our automated systems produce legally binding or significant decisions (such as grade allocation,
                  school placement, or financial decisions). All AI outputs are advisory.
                </p>
              </div>
            </section>

            {/* ── 13. COOKIES ──────────────────────────────────────── */}
            <section>
              <SectionHead id="cookies" icon={<Cookie className="w-4 h-4 text-slate-500" />} number="14" title="Cookies & Local Storage" />
              <p className="text-slate-700 text-base mb-4">
                We use <strong>essential cookies only</strong> — no advertising, tracking, or third-party analytics cookies.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { name: 'sb-auth-token', type: 'Authentication', desc: 'Keeps you securely logged in. Expires on logout or 7 days.', required: true },
                  { name: 'sb-session', type: 'Session', desc: 'Manages your active session state. Cleared when you close the browser.', required: true },
                  { name: 'theme', type: 'Preference', desc: 'Remembers your display preference (dark/light mode).', required: false },
                ].map(c => (
                  <div key={c.name} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-mono font-bold text-slate-800 text-xs">{c.name}</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.required ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-500'}`}>
                        {c.required ? 'Required' : 'Optional'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-500 mb-1">{c.type}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{c.desc}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-500">
                You may disable cookies in your browser settings. Disabling the authentication cookie will log you out
                and prevent access to authenticated features.
              </p>
            </section>

            {/* ── 14. CHANGES ──────────────────────────────────────── */}
            <section>
              <SectionHead id="changes" icon={<Bell className="w-4 h-4 text-slate-500" />} number="15" title="Changes to This Policy" />
              <div className="space-y-3 text-slate-700 text-base leading-relaxed">
                <p>
                  We will notify users of <strong>material changes</strong> — such as new data categories, new processors,
                  or changes to your rights — via in-app notification and email at least 14 days before the change takes effect.
                </p>
                <p>
                  Minor updates (typo fixes, clarifications) will be made without advance notice but with an updated
                  "Last updated" date at the top of this page.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
                  <p className="font-bold text-slate-700">Version history</p>
                  <div className="mt-2 space-y-1 text-slate-500">
                    <p>29 Jun 2026 — Added: EduNexus Core section (school learner registry, guardian national ID, UPI/NEMIS pupil number, special needs as sensitive data, school as data controller, intelligence bridge disclosure, report card and transfer data, expanded retention table and legal basis table)</p>
                    <p>25 Jun 2026 — Added: student self-login, study groups, WhatsApp processor, retention schedule, legal basis table, automated decisions disclosure, cross-border transfer details</p>
                    <p>4 Jun 2026 — Initial publication</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── 15. CONTACT & COMPLAINTS ─────────────────────────── */}
            <section>
              <SectionHead id="contact" icon={<Mail className="w-4 h-4 text-slate-500" />} number="16" title="Contact Us & How to Complain" />
              <div className="space-y-4">
                <div className="bg-slate-900 text-white rounded-2xl p-6">
                  <p className="font-black text-lg mb-4">Jashor Technologies — trading as EduNexus Kenya</p>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-300">
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Email</p>
                      <a href="mailto:support@edunexus.co.ke" className={`text-teal-400 font-semibold hover:text-teal-300 rounded ${FOCUS_RING}`}>
                        support@edunexus.co.ke
                      </a>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">WhatsApp</p>
                      <a href="https://wa.me/254710798030" className={`text-green-400 font-semibold hover:text-green-300 rounded ${FOCUS_RING}`}>
                        +254 710 798 030
                      </a>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Website</p>
                      <span>edunexus.co.ke</span>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Country</p>
                      <span>Kenya 🇰🇪</span>
                    </div>
                  </div>
                </div>

                {/* ODPC */}
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Gavel className="w-5 h-5 text-red-600" />
                    <h3 className="font-black text-red-800">Right to Lodge a Complaint</h3>
                  </div>
                  <p className="text-red-800 text-sm leading-relaxed mb-4">
                    If you believe we have processed your personal data in a manner inconsistent with the Kenya Data
                    Protection Act 2019, you have the right to lodge a complaint with the{' '}
                    <strong>Office of the Data Protection Commissioner (ODPC)</strong> — Kenya's data protection regulator.
                  </p>
                  <div className="bg-white/70 rounded-xl p-4 text-sm text-red-700 space-y-1">
                    <p><strong>Office:</strong> Office of the Data Protection Commissioner</p>
                    <p><strong>Website:</strong>{' '}
                      <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer" className={`underline font-semibold rounded ${FOCUS_RING_ON_LIGHT}`}>
                        www.odpc.go.ke
                      </a>
                    </p>
                    <p><strong>Address:</strong> Teleposta Towers, Kenyatta Avenue, Nairobi</p>
                    <p><strong>Email:</strong> info@odpc.go.ke</p>
                    <p><strong>Phone:</strong> +254 20 428 5000</p>
                  </div>
                  <p className="text-xs text-red-600 mt-3">
                    We encourage you to contact us first at support@edunexus.co.ke so we can try to resolve your concern
                    before escalating to the ODPC.
                  </p>
                </div>
              </div>
            </section>

            {/* ── FOOTER NAV ─────────────────────────────────────────── */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/"
                className={`inline-flex items-center gap-2 text-sm text-teal-600 font-bold hover:text-teal-700 ${FOCUS_RING_ON_LIGHT}`}
              >
                <ArrowLeft className="w-4 h-4" /> Back to Home
              </Link>
              <div className="flex gap-4 text-xs text-slate-400">
                <Link href="/legal/terms"  className={`hover:text-slate-700 rounded ${FOCUS_RING_ON_LIGHT}`}>Terms of Use</Link>
                <Link href="/legal/refund" className={`hover:text-slate-700 rounded ${FOCUS_RING_ON_LIGHT}`}>Refund Policy</Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
