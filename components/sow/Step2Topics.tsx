'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Loader2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { SOWContext, SelectedSubstrand } from '@/lib/sow/types'

interface SowStrand {
  id: string
  learning_area_id: string
  title: string
  order_index: number
}

interface SowSubstrand {
  id: string
  strand_id: string
  title: string
  suggested_lessons: number
  order_index: number
}

function isLanguageSubject(name: string): boolean {
  const langs = ['english', 'kiswahili', 'french', 'german', 'arabic', 'mandarin', 'indigenous', 'sign language', 'literature']
  return langs.some(l => name.toLowerCase().includes(l))
}

export default function Step2Topics({
  context,
  onComplete,
  onBack,
}: {
  context: SOWContext
  onComplete: (subs: SelectedSubstrand[]) => void
  onBack: () => void
}) {
  const supabase = createClient()

  const is844 = context.curriculumMode === '844_form3' || context.curriculumMode === '844_form4'
  const strandLabel    = is844 ? 'Topic'     : 'Strand'
  const substrandLabel = is844 ? 'Sub-topic' : 'Sub-strand'
  const isLang = isLanguageSubject(context.learningAreaName)

  const [strands, setStrands] = useState<SowStrand[]>([])
  const [substrands, setSubstrands] = useState<SowSubstrand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasNoData, setHasNoData] = useState(false)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Checked substrand IDs
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [placeholderLessons, setPlaceholderLessons] = useState(40)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      setHasNoData(false)

      try {
        const { data: strandsData, error: stErr } = await supabase
          .from('sow_strands')
          .select('id, learning_area_id, title, order_index')
          .eq('learning_area_id', context.learningArea)
          .order('order_index')
          .limit(500)

        if (stErr) {
          setError(`Failed to load ${strandLabel.toLowerCase()}s: ${stErr.message}`)
          return
        }

        if (!strandsData || strandsData.length === 0) {
          setHasNoData(true)
          return
        }

        const strandIds = strandsData.map(s => s.id)

        // Fetch substrands in pages to avoid the PostgREST 1000-row default cap
        const allSubstrands: SowSubstrand[] = []
        const PAGE = 1000
        let from = 0
        while (true) {
          const { data: page, error: subErr } = await supabase
            .from('sow_substrands')
            .select('id, strand_id, title, suggested_lessons, order_index')
            .in('strand_id', strandIds)
            .order('order_index')
            .range(from, from + PAGE - 1)

          if (subErr) {
            setError(`Failed to load ${substrandLabel.toLowerCase()}s: ${subErr.message}`)
            return
          }

          if (page) allSubstrands.push(...page)
          if (!page || page.length < PAGE) break
          from += PAGE
        }

        setStrands(strandsData)
        setSubstrands(allSubstrands)
        setExpanded(new Set(strandsData.map(s => s.id)))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(`Unexpected error loading curriculum data: ${msg}`)
      } finally {
        setLoading(false)
      }
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.learningArea])

  const byStrand = useMemo(() => {
    const map: Record<string, SowSubstrand[]> = {}
    for (const sub of substrands) {
      if (!map[sub.strand_id]) map[sub.strand_id] = []
      map[sub.strand_id].push(sub)
    }
    return map
  }, [substrands])

  function toggleExpand(strandId: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(strandId) ? next.delete(strandId) : next.add(strandId)
      return next
    })
  }

  function toggleSubstrand(substrandId: string, _strandId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(substrandId) ? next.delete(substrandId) : next.add(substrandId)
      return next
    })
  }

  function toggleAllInStrand(strandId: string, subs: SowSubstrand[]) {
    const allSelected = subs.every(s => selected.has(s.id))
    setSelected(prev => {
      const next = new Set(prev)
      subs.forEach(s => (allSelected ? next.delete(s.id) : next.add(s.id)))
      return next
    })
    // Auto-expand so the user can see and uncheck individual substrands
    if (!allSelected) {
      setExpanded(prev => {
        const next = new Set(prev)
        next.add(strandId)
        return next
      })
    }
  }

  function selectAll() {
    const next = new Set<string>()
    substrands.forEach(s => next.add(s.id))
    setSelected(next)
  }

  function clearAll() {
    setSelected(new Set())
  }

  // Each selected substrand = 1 lesson minimum; pipeline distributes to fill all teaching slots
  const totalLessons = selected.size

  const selectedStrandCount = strands.filter(s =>
    (byStrand[s.id] || []).some(sub => selected.has(sub.id))
  ).length

  function handleNext() {
    if (!selected.size) return
    const result: SelectedSubstrand[] = []

    // Universal: one entry per selected subtopic for ALL subjects
    // strandTitle → STRAND column, substrandTitle → SUB-STRAND column
    // lessonsRequired=1 is a placeholder; pipeline redistributes to fill all teaching slots
    for (const strand of strands) {
      for (const sub of (byStrand[strand.id] || [])) {
        if (!selected.has(sub.id)) continue
        result.push({
          strandId: strand.id,
          strandTitle: strand.title,
          substrandId: sub.id,
          substrandTitle: sub.title,
          lessonsRequired: 1,
          orderIndex: sub.order_index,
          subtopics: [sub.title],
        })
      }
    }

    onComplete(result)
  }

  function handleProceedWithPlaceholder() {
    onComplete([{
      strandId: 'ai-generated',
      strandTitle: context.learningAreaName,
      substrandId: 'ai-generated',
      substrandTitle: `${context.learningAreaName} — Full Syllabus`,
      lessonsRequired: placeholderLessons,
      orderIndex: 1,
    }])
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-gray-900">
              Select {strandLabel}s &amp; {substrandLabel}s
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {context.learningAreaName} · {context.gradeName}
            </p>
          </div>
          {!loading && !hasNoData && !error && (
            <div className="flex gap-3">
              <button onClick={selectAll} className="text-sm text-teal-600 font-bold hover:underline">
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={clearAll} className="text-sm text-gray-400 font-bold hover:underline">
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Subject type badge */}
        {!loading && !hasNoData && !error && (
          <div className={`mb-5 text-xs font-bold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 ${
            isLang
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-purple-50 text-purple-700 border border-purple-200'
          }`}>
            {isLang
              ? '📚 Language subject — each sub-strand gets at least 1 lesson'
              : '🔬 Science/Math subject — slots distributed evenly across subtopics'}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading curriculum data…
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {!loading && hasNoData && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-800 text-sm">
                  No curriculum topics found for this subject yet.
                </p>
                <p className="text-amber-700 text-sm mt-1">
                  You can still generate a scheme — AI will create content based on the subject name
                  and {context.gradeName} context.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-amber-800 whitespace-nowrap">
                Estimated lessons this term:
              </label>
              <input
                type="number"
                min={5}
                max={80}
                value={placeholderLessons}
                onChange={e => setPlaceholderLessons(Math.max(5, Math.min(80, Number(e.target.value) || 40)))}
                className="w-20 text-center px-3 py-2 border border-amber-300 rounded-lg text-sm font-bold text-amber-800 focus:outline-none focus:border-amber-500 bg-white"
              />
            </div>
            <button
              onClick={handleProceedWithPlaceholder}
              className="flex items-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-amber-700 transition text-sm"
            >
              Proceed with AI-generated content <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {!loading && !error && !hasNoData && (
          <div className="space-y-3">
            {strands.map(strand => {
              const subs = byStrand[strand.id] || []
              const isOpen = expanded.has(strand.id)
              const selectedCount = subs.filter(s => selected.has(s.id)).length
              const allSelected = subs.length > 0 && subs.every(s => selected.has(s.id))

              return (
                <div key={strand.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Strand / Topic header */}
                  <div className="bg-gray-50 px-4 py-3 flex items-center gap-2">
                    {/* Clicking the checkbox OR the title both check/uncheck all substrands */}
                    <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        ref={el => { if (el) el.indeterminate = selectedCount > 0 && !allSelected }}
                        checked={allSelected}
                        onChange={() => toggleAllInStrand(strand.id, subs)}
                        className="w-4 h-4 rounded border-gray-300 accent-teal-600 shrink-0"
                      />
                      <span className="font-bold text-gray-800 text-sm truncate">{strand.title}</span>
                    </label>

                    {/* Count badge + expand toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">{selectedCount}/{subs.length}</span>
                      <button
                        onClick={() => toggleExpand(strand.id)}
                        className="p-1 rounded hover:bg-gray-200 transition"
                      >
                        {isOpen
                          ? <ChevronUp className="w-4 h-4 text-gray-400" />
                          : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Substrands / Subtopics */}
                  {isOpen && (
                    <div className="divide-y divide-gray-100">
                      {subs.map(sub => {
                        const isSel = selected.has(sub.id)
                        return (
                          <div
                            key={sub.id}
                            className={`flex items-center gap-3 px-4 py-3 transition ${
                              isSel ? 'bg-teal-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => toggleSubstrand(sub.id, strand.id)}
                              className="w-4 h-4 rounded border-gray-300 accent-teal-600"
                            />
                            <span className="flex-1 text-sm text-gray-800">{sub.title}</span>
                          </div>
                        )
                      })}
                      {subs.length === 0 && (
                        <div className="px-4 py-3 text-xs text-gray-400 italic">
                          No {substrandLabel.toLowerCase()}s seeded for this {strandLabel.toLowerCase()}.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {selectedStrandCount > 0 && (
          <div className="mt-5 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
            <span className="text-sm text-teal-700 font-bold">
              {selectedStrandCount} {strandLabel.toLowerCase()}{selectedStrandCount !== 1 ? 's' : ''}
              &nbsp;·&nbsp;{selected.size} {substrandLabel.toLowerCase()}{selected.size !== 1 ? 's' : ''} selected
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 px-5 py-3 rounded-xl border border-gray-200 font-bold hover:bg-gray-50 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {!hasNoData && (
          <button
            onClick={handleNext}
            disabled={selected.size === 0}
            className="flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next — Schedule <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
