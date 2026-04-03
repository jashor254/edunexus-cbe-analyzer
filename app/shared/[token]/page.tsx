import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { PrintButton } from './PrintButton'

interface SharedReportData {
  strengths: string[]
  priorityAreas: string[]
  actionPlan: string[]
  subjectScores: Record<string, number>
  overallLevel: number
  overallLabel: string
}

function getLevelColor(level: number): string {
  return ['', 'bg-red-500', 'bg-amber-500', 'bg-green-500', 'bg-purple-500'][level] || 'bg-gray-400'
}

function getLevelLabel(level: number): string {
  return ['', 'Emerging', 'Developing', 'Proficient', 'Exemplary'][level] || 'Unknown'
}

function getLevelBadgeColor(level: number): string {
  return ['', 'bg-red-100 text-red-700 border-red-200', 'bg-amber-100 text-amber-700 border-amber-200',
    'bg-green-100 text-green-700 border-green-200', 'bg-purple-100 text-purple-700 border-purple-200'][level] || 'bg-gray-100 text-gray-700'
}

export default async function SharedReportPage({ params }: { params: { token: string } }) {
  const db = await createClient()

  const { data: shared, error } = await db
    .from('shared_reports')
    .select('*')
    .eq('token', params.token)
    .single()

  if (error || !shared) {
    notFound()
  }

  const isExpired = new Date(shared.expires_at) < new Date()

  if (isExpired) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⏰</span>
          </div>
          <h1 className="text-xl font-black text-white mb-3">Report Link Expired</h1>
          <p className="text-white/60 text-sm leading-relaxed mb-6">
            This report has expired. Ask the parent to generate a new link from EduNexus.
          </p>
          <a
            href="https://www.edunexus.co.ke"
            className="text-violet-400 font-bold text-sm hover:text-violet-300 transition-colors"
          >
            edunexus.co.ke
          </a>
        </div>
      </div>
    )
  }

  const reportData = shared.report_data as SharedReportData
  const generatedDate = new Date(shared.created_at).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const expiryDate = new Date(shared.expires_at).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const subjectEntries = Object.entries(reportData.subjectScores || {})

  function formatSubjectName(key: string): string {
    const specialCases: Record<string, string> = {
      core_mathematics: 'Core Mathematics', essential_mathematics: 'Essential Mathematics',
      integrated_science: 'Integrated Science', social_studies: 'Social Studies',
      creative_arts_sports: 'Creative Arts & Sports', pre_technical: 'Pre-Technical Studies',
      agriculture_nutrition: 'Agriculture & Nutrition', kiswahili_ksl: 'Kiswahili/KSL',
      community_service: 'Community Service Learning', computer_studies: 'Computer Studies',
      home_science: 'Home Science', business_studies: 'Business Studies',
      history_citizenship: 'History & Citizenship', physical_education: 'Physical Education',
      sports_recreation: 'Sports & Recreation', music_dance: 'Music & Dance',
      theatre_film: 'Theatre & Film', fine_arts: 'Fine Arts',
    }
    if (specialCases[key]) return specialCases[key]
    return key.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] print:bg-white">
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
        }
      ` }} />

      <div className="max-w-2xl mx-auto p-6 print:p-8">

        {/* Header */}
        <div className="text-center mb-8 pb-6 border-b border-white/10 print:border-gray-300">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-sm">E</span>
            </div>
            <div className="text-left">
              <div className="font-black text-white print:text-black text-lg">EduNexus</div>
              <div className="text-xs text-white/50 print:text-gray-500 font-medium">Academic Clinic</div>
            </div>
          </div>
          <div className="inline-block px-4 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-full text-amber-400 print:text-amber-700 text-xs font-bold uppercase tracking-widest mb-4">
            Shared Report — Confidential
          </div>
          <h1 className="text-2xl font-black text-white print:text-black mb-1">{shared.student_name}</h1>
          <p className="text-white/60 print:text-gray-500 text-sm">Grade {shared.grade} · Generated {generatedDate}</p>
          <p className="text-white/40 print:text-gray-400 text-xs mt-1">Valid until {expiryDate}</p>
        </div>

        {/* Section 1 — Performance Summary */}
        <div className="mb-8">
          <h2 className="text-xs font-black text-white/40 print:text-gray-400 uppercase tracking-widest mb-4">
            01 — Performance Summary
          </h2>

          {/* Overall Level */}
          {reportData.overallLevel && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold mb-6 ${getLevelBadgeColor(reportData.overallLevel)}`}>
              <span>Overall Competency:</span>
              <span>{getLevelLabel(reportData.overallLevel)}</span>
            </div>
          )}

          {/* Subject progress bars */}
          <div className="space-y-3">
            {subjectEntries.map(([subject, score]) => (
              <div key={subject}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold text-white/80 print:text-gray-700">
                    {formatSubjectName(subject)}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getLevelBadgeColor(score)}`}>
                    {getLevelLabel(score)}
                  </span>
                </div>
                <div className="h-2 bg-white/10 print:bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getLevelColor(score)}`}
                    style={{ width: `${(score / 4) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2 — Strengths */}
        {reportData.strengths?.length > 0 && (
          <div className="mb-8 p-5 bg-green-500/10 print:bg-green-50 border border-green-500/20 print:border-green-200 rounded-2xl">
            <h2 className="text-xs font-black text-green-400 print:text-green-700 uppercase tracking-widest mb-4">
              02 — Top Strengths
            </h2>
            <ul className="space-y-2">
              {reportData.strengths.slice(0, 3).map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/80 print:text-gray-700">
                  <span className="w-6 h-6 bg-green-500/20 print:bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 text-green-400 print:text-green-700 text-xs font-black">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Section 3 — Priority Areas */}
        {reportData.priorityAreas?.length > 0 && (
          <div className="mb-8 p-5 bg-red-500/10 print:bg-red-50 border border-red-500/20 print:border-red-200 rounded-2xl">
            <h2 className="text-xs font-black text-red-400 print:text-red-700 uppercase tracking-widest mb-4">
              03 — Priority Areas
            </h2>
            <ul className="space-y-2">
              {reportData.priorityAreas.slice(0, 3).map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/80 print:text-gray-700">
                  <span className="w-6 h-6 bg-red-500/20 print:bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 text-red-400 print:text-red-700 text-xs font-black">{i + 1}</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Section 4 — Action Plan */}
        {reportData.actionPlan?.length > 0 && (
          <div className="mb-8 p-5 bg-violet-500/10 print:bg-violet-50 border border-violet-500/20 print:border-violet-200 rounded-2xl">
            <h2 className="text-xs font-black text-violet-400 print:text-violet-700 uppercase tracking-widest mb-4">
              04 — Action Plan
            </h2>
            <ul className="space-y-2">
              {reportData.actionPlan.slice(0, 3).map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/80 print:text-gray-700">
                  <span className="text-violet-400 print:text-violet-600 font-black flex-shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Section 5 — For the Teacher */}
        <div className="mb-8 p-5 border-2 border-dashed border-white/20 print:border-gray-400 rounded-2xl">
          <h2 className="text-xs font-black text-white/40 print:text-gray-500 uppercase tracking-widest mb-4">
            05 — For the Teacher
          </h2>
          <div className="space-y-5 text-sm text-white/70 print:text-gray-600">
            <div>
              <p className="font-semibold mb-2">Areas teacher agrees with:</p>
              <div className="border-b border-dashed border-white/20 print:border-gray-300 pb-1 mb-1" />
              <div className="border-b border-dashed border-white/20 print:border-gray-300 pb-1" />
            </div>
            <div>
              <p className="font-semibold mb-2">Additional observations:</p>
              <div className="border-b border-dashed border-white/20 print:border-gray-300 pb-1 mb-1" />
              <div className="border-b border-dashed border-white/20 print:border-gray-300 pb-1" />
            </div>
            <div>
              <p className="font-semibold mb-2">Action agreed with parent:</p>
              <div className="border-b border-dashed border-white/20 print:border-gray-300 pb-1 mb-1" />
              <div className="border-b border-dashed border-white/20 print:border-gray-300 pb-1" />
            </div>
            <div className="flex gap-8 pt-2">
              <div>
                <p className="text-xs text-white/40 print:text-gray-400 mb-4">Teacher Signature</p>
                <div className="border-b border-white/30 print:border-gray-400 w-32" />
              </div>
              <div>
                <p className="text-xs text-white/40 print:text-gray-400 mb-4">Parent Signature</p>
                <div className="border-b border-white/30 print:border-gray-400 w-32" />
              </div>
              <div>
                <p className="text-xs text-white/40 print:text-gray-400 mb-4">Date</p>
                <div className="border-b border-white/30 print:border-gray-400 w-24" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-6 border-t border-white/10 print:border-gray-200">
          <p className="text-xs text-white/30 print:text-gray-400">
            Report generated by EduNexus Academic Clinic · edunexus.co.ke
          </p>
          <p className="text-xs text-white/20 print:text-gray-300 mt-1">Not for redistribution</p>
        </div>

        {/* Print button */}
        <div className="text-center mt-6 no-print">
          <PrintButton />
        </div>

      </div>
    </div>
  )
}
