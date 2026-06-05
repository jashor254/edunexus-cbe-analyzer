'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, ArrowRight, HelpCircle, Loader2, RotateCcw } from 'lucide-react'
import type { LessonOutcome } from '@/lib/compass/lessonOutcomes'

// ── Types ─────────────────────────────────────────────────────────────────────

type SubstrandOption = {
  id: string
  title: string       // full raw title e.g. "Fractions - Adding fractions"
  displayName: string // formatted for display
  slug: string
}

type SubGroup = {
  groupName: string         // e.g. "Fractions" (prefix before " - ")
  substrands: SubstrandOption[]
}

type StrandGroup = {
  strandId:    string
  strandTitle: string
  displayTitle: string
  substrands:  SubstrandOption[]
  subGroups:   SubGroup[]   // parsed from substrands
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

// ── Subject catalogue — keyed by exact DB learning_area name ─────────────────

type SubjectDef = { dbName: string; label: string }

const SUBJECTS_JUNIOR: SubjectDef[] = [
  { dbName: 'Mathematics',              label: 'Mathematics'       },
  { dbName: 'English',                  label: 'English'           },
  { dbName: 'Kiswahili',               label: 'Kiswahili'         },
  { dbName: 'Integrated Science',       label: 'Integrated Science'},
  { dbName: 'Social Studies',           label: 'Social Studies'    },
  { dbName: 'Agriculture and Nutrition',label: 'Agriculture'       },
  { dbName: 'Pre-Technical Studies',    label: 'Pre-Technical'     },
  { dbName: 'Creative Arts and Sports', label: 'Creative Arts'     },
]

const SUBJECTS_SENIOR: SubjectDef[] = [
  { dbName: 'Core Mathematics',      label: 'Core Mathematics' },
  { dbName: 'Essential Mathematics', label: 'Essential Maths'  },
  { dbName: 'Biology',               label: 'Biology'          },
  { dbName: 'Chemistry',             label: 'Chemistry'        },
  { dbName: 'Physics',               label: 'Physics'          },
  { dbName: 'Geography',             label: 'Geography'        },
  { dbName: 'English',               label: 'English'          },
  { dbName: 'Business Studies',      label: 'Business Studies' },
  { dbName: 'Agriculture',           label: 'Agriculture'      },
  { dbName: 'Computer Studies',      label: 'Computer Studies' },
  { dbName: 'History and Citizenship', label: 'History'        },
  { dbName: 'Kiswahili Lugha',       label: 'Kiswahili'        },
]

function getSubjectsForGrade(grade: number): SubjectDef[] {
  return grade >= 10 ? SUBJECTS_SENIOR : SUBJECTS_JUNIOR
}

// ── Parse "Group - Topic" or "Group — Topic" substrand titles ────────────────
// DB uses " - " (hyphen) for gr7-9, " — " (em dash) for gr10+

function splitGroupName(rawTitle: string): string {
  let idx = rawTitle.indexOf(' — ')
  if (idx !== -1) return rawTitle.slice(0, idx).trim()
  idx = rawTitle.indexOf(' - ')
  if (idx !== -1) return rawTitle.slice(0, idx).trim()
  return ''
}

function buildSubGroups(substrands: SubstrandOption[]): SubGroup[] {
  const map = new Map<string, SubstrandOption[]>()

  for (const ss of substrands) {
    const groupName = splitGroupName(ss.title)
    const existing = map.get(groupName) ?? []
    map.set(groupName, [...existing, ss])
  }

  // Groups with no prefix ('') go first as direct items; named groups after
  const result: SubGroup[] = []
  const noGroup = map.get('')
  if (noGroup?.length) result.push({ groupName: '', substrands: noGroup })
  for (const [name, items] of map) {
    if (name !== '') result.push({ groupName: name, substrands: items })
  }
  return result
}

function topicLabel(ss: SubstrandOption, groupName: string): string {
  // Strip "GroupName — " prefix (toChipLabel normalises all separators to em dash)
  if (!groupName) return ss.displayName
  const prefix = groupName + ' — '
  return ss.displayName.startsWith(prefix)
    ? ss.displayName.slice(prefix.length)
    : ss.displayName
}

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
  const [selectedSubject,  setSelectedSubject]  = useState<SubjectDef | null>(null)
  const [selectedGrade,    setSelectedGrade]    = useState<number>(studentGrade)
  const [showGradePicker,  setShowGradePicker]  = useState(false)
  const [strandTree,       setStrandTree]       = useState<StrandGroup[]>([])
  const [loadingTopics,    setLoadingTopics]    = useState(false)
  // expandedStrands: strandId → bool
  // expandedGroups:  `${strandId}::${groupName}` → bool
  const [expandedStrands,  setExpandedStrands]  = useState<Record<string, boolean>>({})
  const [expandedGroups,   setExpandedGroups]   = useState<Record<string, boolean>>({})
  const [showWeakAreas,    setShowWeakAreas]    = useState(false)

  const subjects       = getSubjectsForGrade(selectedGrade)
  const earlierGrades  = Array.from(
    { length: Math.max(0, studentGrade - 7) },
    (_, i) => 7 + i
  )

  // Reset subject selection when grade changes (different subject set)
  useEffect(() => {
    setSelectedSubject(null)
    setStrandTree([])
    setExpandedStrands({})
    setExpandedGroups({})
  }, [selectedGrade])

  // Fetch strand tree when subject or grade changes
  useEffect(() => {
    if (!selectedSubject) return
    setLoadingTopics(true)
    setStrandTree([])
    setExpandedStrands({})
    setExpandedGroups({})

    fetch(
      `/api/compass/topics?subject=${encodeURIComponent(selectedSubject.dbName)}&grade=${selectedGrade}&curriculumType=${curriculumType}`
    )
      .then(r => r.json())
      .then((json: { data?: { topics?: Omit<StrandGroup, 'subGroups'>[] } }) => {
        const raw = json.data?.topics ?? []
        const enriched: StrandGroup[] = raw.map(s => ({
          ...s,
          subGroups: buildSubGroups(s.substrands),
        }))
        setStrandTree(enriched)
      })
      .catch(() => {})
      .finally(() => setLoadingTopics(false))
  }, [selectedSubject, selectedGrade, curriculumType])

  const toggleStrand = (strandId: string) =>
    setExpandedStrands(prev => ({ ...prev, [strandId]: !prev[strandId] }))

  const toggleGroup = (strandId: string, groupName: string) => {
    const key = `${strandId}::${groupName}`
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const isGroupExpanded = (strandId: string, groupName: string) =>
    !!expandedGroups[`${strandId}::${groupName}`]

  const handleSubjectClick = (subj: SubjectDef) => {
    setSelectedSubject(subj)
    setShowGradePicker(false)
  }

  const handleGradeSelect = (grade: number) => {
    setSelectedGrade(grade)
    setShowGradePicker(false)
  }

  const handleSubstrandSelect = (strand: StrandGroup, ss: SubstrandOption) => {
    if (!selectedSubject) return
    onSelect({
      subject:     selectedSubject.dbName,
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

      {/* ── Continue card ──────────────────────────────────────────────────── */}
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

      {/* ── Grade selector ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleGradeSelect(studentGrade)}
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
                {selectedGrade !== studentGrade
                  ? `Revising Grade ${selectedGrade}`
                  : 'Earlier Grade'}
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

      {/* ── Subject grid — grade-aware ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        {subjects.map(s => (
          <button
            key={s.dbName}
            onClick={() => handleSubjectClick(s)}
            className={`px-3 py-2.5 rounded-xl text-sm font-bold text-left transition-all ${
              selectedSubject?.dbName === s.dbName
                ? 'bg-violet-500/20 border border-violet-500/50 text-violet-300'
                : 'bg-white/3 border border-white/8 text-white/60 hover:bg-white/6 hover:text-white/80'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Strand → Sub-group → Substrand tree ───────────────────────────── */}
      {selectedSubject && (
        <div>
          {/* Header showing selected subject + grade */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-wider">
              {selectedSubject.label} · Grade {selectedGrade}
            </p>
            {selectedGrade !== studentGrade && (
              <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                Revision
              </span>
            )}
          </div>

          {loadingTopics ? (
            <div className="flex items-center justify-center gap-2 py-8 text-white/30 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading topics…
            </div>
          ) : strandTree.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {strandTree.map(strand => (
                <div key={strand.strandId} className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">

                  {/* Strand header */}
                  <button
                    onClick={() => toggleStrand(strand.strandId)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/3 transition-colors"
                  >
                    <span className="font-bold text-white/80 text-sm">{strand.displayTitle}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-white/20 font-medium">
                        {strand.substrands.length}
                      </span>
                      {expandedStrands[strand.strandId]
                        ? <ChevronUp   className="w-3.5 h-3.5 text-white/30" />
                        : <ChevronDown className="w-3.5 h-3.5 text-white/30" />
                      }
                    </div>
                  </button>

                  {expandedStrands[strand.strandId] && (
                    <div className="border-t border-white/5">

                      {strand.subGroups.map(group => {
                        // No-group substrands render directly (no sub-group wrapper)
                        if (group.groupName === '') {
                          return (
                            <div key="__direct__" className="px-4 py-2 space-y-1">
                              {group.substrands.map(ss => (
                                <SubstrandButton
                                  key={ss.id}
                                  label={topicLabel(ss, group.groupName)}
                                  onClick={() => handleSubstrandSelect(strand, ss)}
                                />
                              ))}
                            </div>
                          )
                        }

                        // Named sub-group — collapsible
                        return (
                          <div key={group.groupName} className="border-t border-white/5 first:border-t-0">
                            <button
                              onClick={() => toggleGroup(strand.strandId, group.groupName)}
                              className="w-full flex items-center justify-between px-5 py-2.5 text-left hover:bg-white/3 transition-colors"
                            >
                              <span className="text-xs font-bold text-violet-300/80">
                                {group.groupName}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-white/20">
                                  {group.substrands.length}
                                </span>
                                {isGroupExpanded(strand.strandId, group.groupName)
                                  ? <ChevronUp   className="w-3 h-3 text-white/30" />
                                  : <ChevronDown className="w-3 h-3 text-white/30" />
                                }
                              </div>
                            </button>

                            {isGroupExpanded(strand.strandId, group.groupName) && (
                              <div className="px-5 pb-2 space-y-1 border-t border-white/5">
                                {group.substrands.map(ss => (
                                  <SubstrandButton
                                    key={ss.id}
                                    label={topicLabel(ss, group.groupName)}
                                    onClick={() => handleSubstrandSelect(strand, ss)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}

                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/30 text-center py-6">
              No topics found for {selectedSubject.label}, Grade {selectedGrade}.
            </p>
          )}
        </div>
      )}

      {/* ── Weak areas (compass_bridge priorities) ─────────────────────────── */}
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

// ── Reusable substrand row button ─────────────────────────────────────────────

function SubstrandButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center justify-between px-3 py-2 bg-white/3 hover:bg-violet-500/10 border border-transparent hover:border-violet-500/20 rounded-xl transition-all group"
    >
      <span className="text-xs text-white/60 font-medium leading-snug">{label}</span>
      <ArrowRight className="w-3 h-3 shrink-0 text-white/20 group-hover:text-violet-400 transition-colors ml-2" />
    </button>
  )
}
