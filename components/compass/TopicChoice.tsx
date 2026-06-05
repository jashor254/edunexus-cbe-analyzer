'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, ArrowRight, HelpCircle, Loader2, RotateCcw } from 'lucide-react'
import type { LessonOutcome } from '@/lib/compass/lessonOutcomes'

// ── Types ─────────────────────────────────────────────────────────────────────

type StrandGroup = {
  strandId:    string
  strandTitle: string
  displayTitle: string
  substrands: { id: string; title: string; displayName: string; slug: string }[]
}

type SubjectPriority = {
  subject?:      string
  displayName?:  string
  currentTier?:  string
  requiredTier?: string
  careerReason?: string
  actionSteps?:  string[]
}

export type TopicSelectParams = {
  subject:     string
  strand:      string
  substrand:   string
  substrandId: string
  grade:       number
  displayName: string
}

type Props = {
  studentName:    string
  studentGrade:   number
  curriculumType: string
  currentOutcome: LessonOutcome | null
  weakAreas:      SubjectPriority[]
  onSelect:       (params: TopicSelectParams) => void
  onContinue:     () => void
}

// ── Subject list ──────────────────────────────────────────────────────────────

const SUBJECTS = [
  { key: 'mathematics',        label: 'Mathematics'  },
  { key: 'english',            label: 'English'      },
  { key: 'kiswahili',          label: 'Kiswahili'    },
  { key: 'biology',            label: 'Biology'      },
  { key: 'chemistry',          label: 'Chemistry'    },
  { key: 'physics',            label: 'Physics'      },
  { key: 'geography',          label: 'Geography'    },
  { key: 'history',            label: 'History'      },
  { key: 'agriculture',        label: 'Agriculture'  },
  { key: 'integrated_science', label: 'Science'      },
]

// ── TopicChoice ───────────────────────────────────────────────────────────────

export default function TopicChoice({
  studentName,
  studentGrade,
  curriculumType,
  currentOutcome,
  weakAreas,
  onSelect,
  onContinue,
}: Props) {
  const firstName = studentName.split(' ')[0]

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedSubject,  setSelectedSubject]  = useState<string | null>(null)
  const [selectedGrade,    setSelectedGrade]    = useState<number>(studentGrade)
  const [showGradePicker,  setShowGradePicker]  = useState(false)
  const [strandTree,       setStrandTree]       = useState<StrandGroup[]>([])
  const [loadingTopics,    setLoadingTopics]    = useState(false)
  const [expanded,         setExpanded]         = useState<Record<string, boolean>>({})
  const [showWeakAreas,    setShowWeakAreas]    = useState(false)

  const earlierGrades = Array.from({ length: studentGrade - 7 }, (_, i) => 7 + i)
    .filter(g => g < studentGrade)

  // ── Fetch topics when subject or grade changes ───────────────────────────
  useEffect(() => {
    if (!selectedSubject) return
    setLoadingTopics(true)
    setExpanded({})
    setStrandTree([])

    fetch(
      `/api/compass/topics?subject=${encodeURIComponent(selectedSubject)}&grade=${selectedGrade}&curriculumType=${curriculumType}`
    )
      .then(r => r.json())
      .then((json: { data?: { topics?: StrandGroup[] } }) => {
        setStrandTree(json.data?.topics ?? [])
      })
      .catch(() => {})
      .finally(() => setLoadingTopics(false))
  }, [selectedSubject, selectedGrade, curriculumType])

  const toggleStrand = (strandId: string) =>
    setExpanded(prev => ({ ...prev, [strandId]: !prev[strandId] }))

  const handleSubjectClick = (key: string) => {
    setSelectedSubject(key)
    setSelectedGrade(studentGrade)
    setShowGradePicker(false)
  }

  const handleGradeSelect = (grade: number) => {
    setSelectedGrade(grade)
    setShowGradePicker(false)
  }

  const handleSubstrandSelect = (
    strand: StrandGroup,
    ss: StrandGroup['substrands'][number]
  ) => {
    if (!selectedSubject) return
    onSelect({
      subject:     selectedSubject,
      strand:      strand.strandTitle,
      substrand:   ss.title,
      substrandId: ss.id,
      grade:       selectedGrade,
      displayName: ss.displayName,
    })
  }

  // ── Continue card ─────────────────────────────────────────────────────────
  const achievedCount    = currentOutcome?.milestones.filter(m => m.achieved).length ?? 0
  const currentStep      = achievedCount + 1
  const currentMilestone = currentOutcome?.milestones[Math.min(currentStep - 1, 3)]

  return (
    <div className="w-full max-w-lg mx-auto space-y-5 text-left">

      {/* Greeting */}
      <div className="text-center">
        <h2 className="text-xl font-black text-white">Hey {firstName}.</h2>
        <p className="text-white/50 text-sm mt-1">What would you like to work on?</p>
      </div>

      {/* Continue card */}
      {currentOutcome && (
        <div>
          <p className="text-[10px] font-black text-white/30 uppercase tracking-wider mb-2">
            Continue where you left off
          </p>
          <button
            onClick={onContinue}
            className="w-full text-left p-4 bg-violet-500/10 border border-violet-500/30 rounded-2xl hover:bg-violet-500/15 hover:border-violet-500/50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-white capitalize">{currentOutcome.concept.replace(/_/g, ' ')}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  Step {currentStep} of 4 — {currentMilestone?.description}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-violet-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="flex gap-1.5 mt-3">
              {currentOutcome.milestones.map((m, i) => (
                <div
                  key={m.step}
                  className={`flex-1 h-1 rounded-full ${
                    m.achieved
                      ? 'bg-violet-500'
                      : i === currentStep - 1
                        ? 'bg-violet-500/40'
                        : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </button>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/8" />
        <span className="text-[10px] font-black text-white/20 uppercase tracking-wider">
          {currentOutcome ? 'Or pick something new' : 'Choose a subject'}
        </span>
        <div className="flex-1 h-px bg-white/8" />
      </div>

      {/* Subject grid */}
      <div className="grid grid-cols-2 gap-2">
        {SUBJECTS.map(s => (
          <button
            key={s.key}
            onClick={() => handleSubjectClick(s.key)}
            className={`px-3 py-2.5 rounded-xl text-sm font-bold text-left transition-all ${
              selectedSubject === s.key
                ? 'bg-violet-500/20 border border-violet-500/50 text-violet-300'
                : 'bg-white/3 border border-white/8 text-white/60 hover:bg-white/6 hover:text-white/80'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Topic browser — shown after subject is selected */}
      {selectedSubject && (
        <div className="space-y-3">

          {/* Grade selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedGrade(studentGrade); setShowGradePicker(false) }}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedGrade === studentGrade
                  ? 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
                  : 'bg-white/3 border border-white/8 text-white/50 hover:bg-white/6'
              }`}
            >
              My Grade ({studentGrade})
            </button>

            {earlierGrades.length > 0 && (
              <div className="flex-1 relative">
                <button
                  onClick={() => setShowGradePicker(p => !p)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedGrade !== studentGrade
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                      : 'bg-white/3 border border-white/8 text-white/50 hover:bg-white/6'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <RotateCcw className="w-3 h-3" />
                    {selectedGrade !== studentGrade ? `Grade ${selectedGrade} (revision)` : 'Earlier Grade'}
                  </span>
                  {showGradePicker
                    ? <ChevronUp className="w-3 h-3" />
                    : <ChevronDown className="w-3 h-3" />
                  }
                </button>
                {showGradePicker && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl overflow-hidden z-10 shadow-xl">
                    {earlierGrades.map(g => (
                      <button
                        key={g}
                        onClick={() => handleGradeSelect(g)}
                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-white/60 hover:bg-white/8 hover:text-white/90 transition-colors"
                      >
                        Grade {g}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Strand tree */}
          {loadingTopics ? (
            <div className="flex items-center justify-center gap-2 py-8 text-white/30 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading topics…
            </div>
          ) : strandTree.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {strandTree.map(strand => (
                <div key={strand.strandId} className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => toggleStrand(strand.strandId)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/3 transition-colors"
                  >
                    <span className="font-bold text-white/80 text-sm">{strand.displayTitle}</span>
                    {expanded[strand.strandId]
                      ? <ChevronUp   className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0" />
                    }
                  </button>
                  {expanded[strand.strandId] && (
                    <div className="px-4 pb-3 space-y-1 border-t border-white/5 pt-3">
                      {strand.substrands.slice(0, 12).map(ss => (
                        <button
                          key={ss.id}
                          onClick={() => handleSubstrandSelect(strand, ss)}
                          className="w-full text-left flex items-center justify-between px-3 py-2 bg-white/3 hover:bg-violet-500/10 border border-transparent hover:border-violet-500/20 rounded-xl transition-all group"
                        >
                          <span className="text-xs text-white/60 font-medium leading-snug">{ss.displayName}</span>
                          <ArrowRight className="w-3 h-3 shrink-0 text-white/20 group-hover:text-violet-400 transition-colors ml-2" />
                        </button>
                      ))}
                      {strand.substrands.length > 12 && (
                        <p className="text-[10px] text-white/20 text-center pt-1">
                          +{strand.substrands.length - 12} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/30 text-center py-4">
              No topics found for this grade and subject.
            </p>
          )}
        </div>
      )}

      {/* Weak areas — show when compass_bridge has priorities */}
      {weakAreas.length > 0 && (
        <div>
          <button
            onClick={() => setShowWeakAreas(p => !p)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white/3 border border-white/8 rounded-2xl text-sm text-white/50 hover:bg-white/5 hover:text-white/70 font-medium transition-all"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Show me where I need work
            </span>
            {showWeakAreas
              ? <ChevronUp   className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />
            }
          </button>

          {showWeakAreas && (
            <div className="mt-2 space-y-2">
              {weakAreas.slice(0, 3).flatMap(sp =>
                (sp.actionSteps ?? []).slice(0, 2).map((step, i) => (
                  <button
                    key={`${sp.subject}-${i}`}
                    onClick={() => onSelect({
                      subject:     sp.subject ?? '',
                      strand:      '',
                      substrand:   step,
                      substrandId: '',
                      grade:       studentGrade,
                      displayName: step.replace(/_/g, ' '),
                    })}
                    className="w-full text-left p-3 bg-white/3 border border-white/8 hover:bg-amber-500/10 hover:border-amber-500/20 rounded-xl transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white/70 capitalize">
                          {(sp.displayName ?? sp.subject ?? '').replace(/_/g, ' ')}
                        </p>
                        <p className="text-[11px] text-white/40 mt-0.5 capitalize">
                          {step.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-amber-400 transition-colors" />
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
