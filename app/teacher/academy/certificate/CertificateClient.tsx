'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { Download, Share2, ChevronLeft, Award, CheckCircle2, Star } from 'lucide-react'

interface Props {
  teacherName: string
  school: string
  issuedDate: string
  totalLessons: number
}

export default function CertificateClient({ teacherName, school, issuedDate, totalLessons }: Props) {
  const certRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    window.print()
  }

  function handleShare() {
    const text =
      `🎓 I just earned the EduNexus AI Pioneer Teacher Certificate!\n\n` +
      `I completed all ${totalLessons} lessons across 6 modules of the EduNexus AI Academy — ` +
      `learning how to use AI to transform teaching in Kenya's CBC curriculum.\n\n` +
      `📅 Issued: ${issuedDate}\n` +
      `🏫 ${school}\n\n` +
      `#EduNexus #AITeacher #CBCKenya #PioneerTeacher`

    if (navigator.share) {
      navigator.share({ text }).catch(() => {
        navigator.clipboard.writeText(text)
        alert('Copied to clipboard! Paste it in WhatsApp.')
      })
    } else {
      navigator.clipboard.writeText(text)
      alert('Copied to clipboard! Paste it in WhatsApp.')
    }
  }

  return (
    <>
      {/* Print styles — only the cert div prints */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #certificate, #certificate * { visibility: visible; }
          #certificate { position: fixed; inset: 0; margin: 0; padding: 40px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-50">
        {/* Header — hidden on print */}
        <div className="no-print bg-[#0c1929] px-4 sm:px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Link
              href="/teacher/academy"
              className="flex items-center gap-1.5 text-slate-400 hover:text-teal-400 text-xs font-semibold transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> AI Academy
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-400 text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

          {/* Congratulations banner */}
          <div className="no-print mb-8 text-center">
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-5 py-2.5 rounded-full text-sm font-bold mb-3">
              <Award className="w-4 h-4" /> Congratulations!
            </div>
            <p className="text-gray-600 text-sm max-w-md mx-auto">
              You've completed all Phase 1 modules of the EduNexus AI Academy. Your certificate is ready to download or share.
            </p>
          </div>

          {/* Certificate */}
          <div
            id="certificate"
            ref={certRef}
            className="bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-amber-100"
          >
            {/* Top gold accent */}
            <div className="h-2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />

            <div className="p-10 sm:p-14">
              {/* Header */}
              <div className="text-center mb-10">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-200">
                    <span className="text-white font-black text-2xl">EN</span>
                  </div>
                </div>
                <div className="text-xs font-black uppercase tracking-[0.3em] text-gray-400 mb-2">
                  EduNexus AI Academy
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight">
                  Certificate of Completion
                </h1>
                <div className="mt-3 flex justify-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 mb-10">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-amber-200" />
                <Award className="w-5 h-5 text-amber-400" />
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-amber-200" />
              </div>

              {/* Body */}
              <div className="text-center space-y-4">
                <p className="text-gray-500 text-sm uppercase tracking-widest font-semibold">
                  This is to certify that
                </p>
                <h2 className="text-3xl sm:text-4xl font-black text-gray-900">{teacherName}</h2>
                {school && (
                  <p className="text-gray-500 text-sm font-medium">{school}</p>
                )}

                <p className="text-gray-600 text-sm leading-relaxed max-w-md mx-auto pt-2">
                  has successfully completed all{' '}
                  <strong className="text-gray-900">{totalLessons} lessons</strong> across{' '}
                  <strong className="text-gray-900">6 modules</strong> of the
                </p>

                <div className="py-4">
                  <div className="inline-block bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl px-8 py-4">
                    <p className="text-teal-700 font-black text-lg leading-tight">
                      EduNexus AI Pioneer Teacher
                    </p>
                    <p className="text-teal-500 text-sm font-semibold mt-1">Phase 1 Programme</p>
                  </div>
                </div>

                <p className="text-gray-500 text-sm">
                  demonstrating AI literacy and the skills to integrate artificial intelligence into Kenya's CBC curriculum.
                </p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 my-10">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-amber-200" />
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-amber-200" />
              </div>

              {/* Footer meta */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Date Issued</p>
                  <p className="font-black text-gray-900 text-sm">{issuedDate}</p>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-full flex items-center justify-center shadow-md">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Issued by</p>
                  <p className="font-black text-gray-900 text-sm">EduNexus Platform</p>
                </div>
              </div>
            </div>

            {/* Bottom teal accent */}
            <div className="h-1.5 bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-500" />
          </div>

          {/* Action buttons — below cert, hidden on print */}
          <div className="no-print mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-500 text-white px-6 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition shadow-md shadow-teal-200"
            >
              <Download className="w-4 h-4" /> Download as PDF
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold text-sm hover:border-gray-300 hover:shadow-sm transition"
            >
              <Share2 className="w-4 h-4" /> Share on WhatsApp
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
