'use client'

import { useState } from 'react'

const GRADES = [
  'Grade 7', 'Grade 8', 'Grade 9',
  'Grade 10', 'Grade 11', 'Grade 12',
  'Form 1', 'Form 2', 'Form 3', 'Form 4',
]

const SUBJECTS = [
  'Mathematics', 'English', 'Kiswahili',
  'Biology', 'Chemistry', 'Physics',
  'History & Government', 'Geography', 'Christian Religious Education',
  'Islamic Religious Education', 'Home Science', 'Agriculture',
  'Business Studies', 'Computer Science', 'Art & Craft',
  'Music', 'Physical Education',
]

const SLIDE_COUNTS = [
  { value: 8,  label: '8 slides  (~30 min lesson)' },
  { value: 10, label: '10 slides (~40 min lesson)' },
  { value: 12, label: '12 slides (~50 min lesson)' },
  { value: 15, label: '15 slides (~60 min lesson)' },
]

type Status = 'idle' | 'generating' | 'done' | 'error'

export default function SlideGeneratorForm() {
  const [subject,    setSubject]    = useState('')
  const [grade,      setGrade]      = useState('')
  const [topic,      setTopic]      = useState('')
  const [slideCount, setSlideCount] = useState(10)
  const [status,     setStatus]     = useState<Status>('idle')
  const [errorMsg,   setErrorMsg]   = useState('')
  const [progress,   setProgress]   = useState('')

  const canSubmit = subject && grade && topic.trim().length >= 3 && status !== 'generating'

  async function handleGenerate() {
    if (!canSubmit) return
    setStatus('generating')
    setErrorMsg('')
    setProgress('Asking AI to write your slides…')

    try {
      const res = await fetch('/api/slides/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, grade, topic: topic.trim(), slideCount }),
      })

      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? `Server error ${res.status}`)
      }

      setProgress('Building your PowerPoint file…')

      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const anchor   = document.createElement('a')
      const filename = `EduNexus_${subject}_${grade}_${topic.trim().replace(/\s+/g, '_').slice(0, 40)}.pptx`
      anchor.href     = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)

      setStatus('done')
      setProgress('')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setProgress('')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#0c1929] to-[#1e3a5f] px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">AI Slide Generator</h2>
              <p className="text-slate-400 text-sm">Beautiful CBC-aligned PowerPoint slides in seconds</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="px-8 py-7 space-y-5">

          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Subject <span className="text-red-500">*</span>
            </label>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={status === 'generating'}
            >
              <option value="">Select subject…</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Grade */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Grade / Form <span className="text-red-500">*</span>
            </label>
            <select
              value={grade}
              onChange={e => setGrade(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={status === 'generating'}
            >
              <option value="">Select grade…</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Lesson Topic <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Photosynthesis, Linear equations, Maji Maji Rebellion…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={status === 'generating'}
              maxLength={200}
            />
            <p className="text-xs text-slate-400 mt-1">{topic.length}/200</p>
          </div>

          {/* Slide count */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Number of Slides
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SLIDE_COUNTS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSlideCount(opt.value)}
                  disabled={status === 'generating'}
                  className={`
                    px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all
                    ${slideCount === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cost note */}
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-amber-800">
              Generating a deck costs <strong>KES 100</strong> — or is <strong>free</strong> when your school is on EduNexus.
            </p>
          </div>

          {/* Error */}
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Success */}
          {status === 'done' && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Your slides are downloading! Check your Downloads folder.
            </div>
          )}

          {/* Submit button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canSubmit}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {status === 'generating' ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {progress || 'Generating…'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Generate & Download Slides
              </>
            )}
          </button>

        </div>
      </div>

      {/* What you get */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {[
          { icon: '🎨', title: 'Branded design',    desc: 'Professional navy & blue theme' },
          { icon: '📋', title: 'Full lesson flow',  desc: 'Title → Content → Activity → Summary' },
          { icon: '🇰🇪', title: 'Kenyan context',   desc: 'CBC-aligned with local examples' },
          { icon: '📝', title: 'Speaker notes',     desc: 'Guidance on every slide' },
        ].map(item => (
          <div key={item.title} className="bg-white rounded-xl border border-slate-100 px-4 py-3 flex items-start gap-3">
            <span className="text-xl">{item.icon}</span>
            <div>
              <p className="text-sm font-semibold text-slate-800">{item.title}</p>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
