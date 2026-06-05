import Link from 'next/link'
import { ArrowLeft, Shield, Users, Baby, Brain, Share2, Lock, Scale, Cookie, Bell, Mail } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy | EduNexus',
  description: 'How EduNexus by Jashor Technologies collects, uses, and protects your data — Kenya Data Protection Act 2019 compliant.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Dark navy header */}
      <div className="bg-slate-900 text-white py-10">
        <div className="max-w-4xl mx-auto px-6">
          <nav className="flex items-center gap-2 text-xs text-slate-400 mb-4">
            <Link href="/" className="hover:text-white transition">Home</Link>
            <span>/</span>
            <Link href="/legal" className="hover:text-white transition">Legal</Link>
            <span>/</span>
            <span className="text-white">Privacy Policy</span>
          </nav>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-7 h-7 text-teal-400" />
            <h1 className="text-3xl sm:text-4xl font-black">Privacy Policy</h1>
          </div>
          <p className="text-slate-400 text-sm font-medium mt-2">
            Last updated: June 4, 2026 · Developed by{' '}
            <span className="text-teal-400 font-semibold">Jashor Technologies</span>
          </p>
          <p className="text-slate-300 text-sm mt-1">edunexus.co.ke</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">

        {/* Intro callout */}
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
          <p className="text-teal-800 text-base leading-relaxed">
            We wrote this policy in plain language so every Kenyan parent, teacher, and student can understand
            exactly what data we collect and why. If you have questions, email us at{' '}
            <a href="mailto:support@edunexus.co.ke" className="font-bold underline">support@edunexus.co.ke</a>.
          </p>
        </div>

        {/* 1. WHO WE ARE */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-sm font-black text-slate-600">1</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">Who We Are</h2>
          </div>
          <div className="space-y-3 text-slate-700 text-base leading-relaxed ml-11">
            <p>
              <strong>EduNexus</strong> is an education platform developed by{' '}
              <strong>Jashor Technologies</strong>, based in Kenya. We serve Kenyan students, parents, and teachers
              navigating the CBC, 8-4-4, and IGCSE curricula — from Grade 7 through Grade 12.
            </p>
            <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
              <p><strong>Company:</strong> Jashor Technologies</p>
              <p><strong>Product:</strong> EduNexus Platform</p>
              <p><strong>Email:</strong>{' '}
                <a href="mailto:support@edunexus.co.ke" className="text-teal-600 font-semibold">support@edunexus.co.ke</a>
              </p>
              <p><strong>Website:</strong> edunexus.co.ke</p>
              <p><strong>Country:</strong> Kenya</p>
            </div>
          </div>
        </section>

        {/* 2. WHAT DATA WE COLLECT */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-slate-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">What Data We Collect</h2>
          </div>
          <div className="space-y-5 ml-11">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <h3 className="font-black text-blue-800 mb-2 text-sm uppercase tracking-wide">Student Data</h3>
                <ul className="space-y-1 text-sm text-blue-700">
                  <li>• Name, grade, school</li>
                  <li>• Assessment scores (uploaded by teacher)</li>
                  <li>• Learning session data (Compass)</li>
                  <li>• Career interests</li>
                </ul>
              </div>
              <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
                <h3 className="font-black text-violet-800 mb-2 text-sm uppercase tracking-wide">Parent Data</h3>
                <ul className="space-y-1 text-sm text-violet-700">
                  <li>• Name, phone number (WhatsApp)</li>
                  <li>• Email (optional)</li>
                  <li>• Child&apos;s academic reports</li>
                </ul>
              </div>
              <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4">
                <h3 className="font-black text-teal-800 mb-2 text-sm uppercase tracking-wide">Teacher Data</h3>
                <ul className="space-y-1 text-sm text-teal-700">
                  <li>• Name, school, subjects taught</li>
                  <li>• Class lists</li>
                  <li>• Assessment records</li>
                </ul>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <h3 className="font-black text-slate-700 mb-2 text-sm uppercase tracking-wide">Usage Data (Automatic)</h3>
              <p className="text-sm text-slate-600">
                Pages visited, features used, learning session duration, and device type (mobile/desktop).
                We collect this to improve the platform.
              </p>
            </div>
          </div>
        </section>

        {/* 3. HOW WE USE YOUR DATA */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-sm font-black text-slate-600">3</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">How We Use Your Data</h2>
          </div>
          <div className="ml-11 grid sm:grid-cols-2 gap-3">
            {[
              'Generate personalised Academic Clinic Reports',
              'Power the Learning Compass for each student',
              'Send academic reports to parents via WhatsApp & email',
              'Help teachers track class performance',
              'Improve our platform and fix bugs',
            ].map(item => (
              <div key={item} className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-800">
                <span className="text-green-500 font-black shrink-0 mt-0.5">✓</span>
                {item}
              </div>
            ))}
          </div>
          <div className="ml-11 mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="font-black text-red-800 mb-2">We do NOT:</p>
            <ul className="space-y-1 text-sm text-red-700">
              <li>• Sell your data to third parties</li>
              <li>• Use student data for advertising</li>
              <li>• Share data with unauthorized parties</li>
            </ul>
          </div>
        </section>

        {/* 4. CHILDREN'S DATA */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <Baby className="w-4 h-4 text-amber-700" />
            </div>
            <h2 className="text-xl font-black text-slate-900">
              Children&apos;s Data{' '}
              <span className="text-sm font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg ml-1">Important</span>
            </h2>
          </div>
          <div className="ml-11 space-y-4">
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5">
              <p className="text-amber-900 text-base leading-relaxed mb-4">
                EduNexus serves students including minors under 18. We take children&apos;s privacy very seriously.
              </p>
              <ul className="space-y-2 text-sm text-amber-800">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-black shrink-0">•</span>
                  Student accounts are created by <strong>parents or teachers</strong> — not children directly
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-black shrink-0">•</span>
                  We collect only data <strong>necessary for educational purposes</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-black shrink-0">•</span>
                  Parents can request <strong>deletion of their child&apos;s data</strong> at any time
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-black shrink-0">•</span>
                  We comply with <strong>Kenya&apos;s Data Protection Act 2019</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 font-black shrink-0">•</span>
                  Student data is <strong>never used for advertising</strong> or profiling outside education
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 5. AI AND YOUR DATA */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4 text-slate-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">AI and Your Data</h2>
          </div>
          <div className="ml-11 space-y-4">
            <p className="text-slate-700 text-base leading-relaxed">
              EduNexus uses AI (DeepSeek via Together AI) to power three features:
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { label: 'Personalised learning tasks', icon: '📚' },
                { label: 'Academic Clinic Reports', icon: '🔬' },
                { label: 'Career pathway recommendations', icon: '🎯' },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 rounded-xl p-3 text-center text-sm font-semibold text-slate-700">
                  <div className="text-2xl mb-1">{item.icon}</div>
                  {item.label}
                </div>
              ))}
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 space-y-1">
              <p className="font-black text-green-900">Personalised content is always:</p>
              <p>• Reviewed against real KICD curriculum data</p>
              <p>• Labeled as AI-assisted</p>
              <p>• Subject to human oversight</p>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 text-sm text-white font-semibold">
              Your data is <span className="text-teal-400">NOT used to train external AI models.</span>
            </div>
          </div>
        </section>

        {/* 6. DATA SHARING */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4 text-slate-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Data Sharing</h2>
          </div>
          <div className="ml-11">
            <p className="text-slate-700 mb-4">We share data <strong>only with these providers</strong>, all bound by data processing agreements:</p>
            <div className="space-y-2">
              {[
                { name: 'Supabase', role: 'Database hosting', note: 'EU servers', color: 'bg-green-50 border-green-100 text-green-800' },
                { name: 'Together AI', role: 'AI processing', note: 'Anonymised data only', color: 'bg-blue-50 border-blue-100 text-blue-800' },
                { name: 'Vercel', role: 'Platform hosting', note: 'Global CDN', color: 'bg-slate-50 border-slate-100 text-slate-800' },
                { name: 'Paystack', role: 'Payment processing', note: 'No academic data shared', color: 'bg-violet-50 border-violet-100 text-violet-800' },
              ].map(p => (
                <div key={p.name} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${p.color}`}>
                  <div>
                    <span className="font-black">{p.name}</span>
                    <span className="ml-2 opacity-80">— {p.role}</span>
                  </div>
                  <span className="text-xs opacity-70">{p.note}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. DATA SECURITY */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-slate-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Data Security</h2>
          </div>
          <div className="ml-11 grid sm:grid-cols-2 gap-3">
            {[
              { title: 'Encrypted in transit', desc: 'HTTPS everywhere — no plain HTTP', icon: '🔐' },
              { title: 'Row Level Security', desc: 'Database access restricted per user', icon: '🛡️' },
              { title: 'No plain-text passwords', desc: 'All passwords securely hashed', icon: '🔑' },
              { title: 'Regular security audits', desc: 'We review security practices regularly', icon: '🔍' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
                <span className="text-xl shrink-0">{item.icon}</span>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 8. YOUR RIGHTS */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 text-slate-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Your Rights Under Kenya Data Protection Act 2019</h2>
          </div>
          <div className="ml-11 space-y-4">
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { right: 'Access your personal data', desc: 'Request a copy of everything we hold about you' },
                { right: 'Correct inaccurate data', desc: 'Update wrong or outdated information' },
                { right: 'Delete your data', desc: 'Right to be forgotten — we will erase your records' },
                { right: 'Object to processing', desc: 'Opt out of certain uses of your data' },
                { right: 'Data portability', desc: 'Get your data in a machine-readable format' },
                { right: 'Withdraw consent', desc: 'Change your mind about what we can process' },
              ].map(item => (
                <div key={item.right} className="bg-white border border-slate-200 rounded-xl p-3">
                  <p className="font-bold text-slate-900 text-sm">{item.right}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-800">
              <p className="font-black mb-1">To exercise any of these rights:</p>
              <p>
                Email us at{' '}
                <a href="mailto:support@edunexus.co.ke" className="font-bold underline">support@edunexus.co.ke</a>
                {' '}— we will respond within 7 business days.
              </p>
            </div>
          </div>
        </section>

        {/* 9. COOKIES */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Cookie className="w-4 h-4 text-slate-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Cookies</h2>
          </div>
          <div className="ml-11 space-y-2">
            <p className="text-slate-700 text-base">We use <strong>essential cookies only</strong> — no advertising cookies.</p>
            <div className="flex gap-3">
              <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-800">
                <p className="font-bold">Authentication cookie</p>
                <p className="opacity-80">Keeps you logged in safely</p>
              </div>
              <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-800">
                <p className="font-bold">Session cookie</p>
                <p className="opacity-80">Manages your active session</p>
              </div>
            </div>
          </div>
        </section>

        {/* 10. POLICY CHANGES */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-slate-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Changes to This Policy</h2>
          </div>
          <div className="ml-11">
            <p className="text-slate-700 leading-relaxed">
              We will notify users of significant changes via <strong>email</strong> or an <strong>in-app notification</strong>.
              Minor updates (like fixing typos) will not be separately announced.
              This policy was last updated on <strong>June 4, 2026</strong>.
            </p>
          </div>
        </section>

        {/* 11. CONTACT */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-slate-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Contact Us</h2>
          </div>
          <div className="ml-11">
            <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-2">
              <p className="font-black text-lg text-white">Jashor Technologies</p>
              <p className="text-slate-300 text-sm">EduNexus Platform</p>
              <div className="pt-2 space-y-1 text-sm text-slate-300">
                <p>
                  <span className="text-slate-500">Email: </span>
                  <a href="mailto:support@edunexus.co.ke" className="text-teal-400 font-semibold hover:text-teal-300">
                    support@edunexus.co.ke
                  </a>
                </p>
                <p><span className="text-slate-500">Website: </span> edunexus.co.ke</p>
                <p><span className="text-slate-500">Country: </span> Kenya 🇰🇪</p>
              </div>
            </div>
          </div>
        </section>

        {/* Back link */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-teal-600 font-bold hover:text-teal-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="flex gap-4 text-xs text-slate-400">
            <Link href="/legal/terms" className="hover:text-slate-700">Terms of Use</Link>
            <Link href="/legal/refund" className="hover:text-slate-700">Refund Policy</Link>
          </div>
        </div>

      </div>
    </div>
  )
}
