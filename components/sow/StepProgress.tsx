'use client'

import { CheckCircle2, ChevronRight } from 'lucide-react'

const STEPS = [
  { label: 'Cover Info' },
  { label: 'Topics' },
  { label: 'Schedule' },
  { label: 'Breaks' },
  { label: 'Preview' },
]

export default function StepProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8 flex-wrap">
      {STEPS.map((step, i) => {
        const num = i + 1
        const done = currentStep > num
        const active = currentStep === num
        return (
          <div key={i} className="flex items-center gap-1">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  done
                    ? 'bg-teal-600 text-white'
                    : active
                    ? 'bg-teal-600 text-white ring-4 ring-teal-100'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {done ? <CheckCircle2 className="w-4 h-4" /> : num}
              </div>
              <span
                className={`text-xs font-semibold hidden sm:inline ${
                  active ? 'text-teal-700' : done ? 'text-gray-500' : 'text-gray-300'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-3 h-3 text-gray-300 ml-1" />
            )}
          </div>
        )
      })}
    </div>
  )
}
