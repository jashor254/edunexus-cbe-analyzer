'use client'

import { useState } from 'react'
import Step1Form from '@/components/sow/Step1Form'
import Step2Topics from '@/components/sow/Step2Topics'
import Step3Structure from '@/components/sow/Step3Structure'
import Step4Breaks from '@/components/sow/Step4Breaks'
import Step5Preview from '@/components/sow/Step5Preview'
import StepProgress from '@/components/sow/StepProgress'
import { applyBreaksToSchedule } from '@/lib/sow/breakEngine'
import type { TermScheduleResult } from '@/lib/sow/termSchedule'
import type {
  SOWContext,
  SelectedSubstrand,
  LessonStructure,
  BreakItem,
  TimelineSlot,
} from '@/lib/sow/types'

export default function SOWPage() {
  const [step, setStep] = useState(1)
  const [context, setContext] = useState<SOWContext | null>(null)
  const [selectedSubstrands, setSelectedSubstrands] = useState<SelectedSubstrand[]>([])
  const [lessonStructure, setLessonStructure] = useState<LessonStructure | null>(null)
  const [termSchedule, setTermSchedule] = useState<TermScheduleResult | null>(null)
  const [timeline, setTimeline] = useState<TimelineSlot[]>([])
  const [breaks, setBreaks] = useState<BreakItem[]>([])

  const next = () => setStep(s => Math.min(s + 1, 5))
  const back = () => setStep(s => Math.max(s - 1, 1))
  const reset = () => {
    setStep(1)
    setContext(null)
    setSelectedSubstrands([])
    setLessonStructure(null)
    setTermSchedule(null)
    setTimeline([])
    setBreaks([])
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-blue-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            EduNexus — Scheme of Work Generator
          </h1>
          <p className="text-gray-500 mt-1">
            CBC Senior · CBC Junior · 8-4-4 — Kenya Curriculum
          </p>
        </div>

        <StepProgress currentStep={step} />

        {step === 1 && (
          <Step1Form
            onComplete={ctx => {
              setContext(ctx)
              next()
            }}
          />
        )}

        {step === 2 && context && (
          <Step2Topics
            context={context}
            onComplete={subs => {
              setSelectedSubstrands(subs)
              next()
            }}
            onBack={back}
          />
        )}

        {step === 3 && (
          <Step3Structure
            onComplete={(ls, ts) => {
              setLessonStructure(ls)
              setTermSchedule(ts)
              setTimeline(applyBreaksToSchedule(ts, []))
              next()
            }}
            onBack={back}
          />
        )}

        {step === 4 && lessonStructure && termSchedule && (
          <Step4Breaks
            termSchedule={termSchedule}
            timeline={timeline}
            lessonStructure={lessonStructure}
            selectedSubstrands={selectedSubstrands}
            onComplete={(finalTimeline, finalBreaks) => {
              setTimeline(finalTimeline)
              setBreaks(finalBreaks)
              next()
            }}
            onBack={back}
          />
        )}

        {step === 5 && context && (
          <Step5Preview
            context={context}
            selectedSubstrands={selectedSubstrands}
            timeline={timeline}
            breaks={breaks}
            onBack={back}
            onReset={reset}
          />
        )}
      </div>
    </div>
  )
}
