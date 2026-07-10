'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileText, Download, CheckSquare, Square, Loader2,
  BookOpen, NotebookPen, ClipboardList, X, ChevronRight,
  Zap, Package, AlertCircle, CheckCircle, RefreshCw, Trash2,
} from 'lucide-react'
import type { SchemeWithProgress } from '@/app/api/sow/list/route'
import type { DlMarkerRow } from '@/app/api/documents/markers/route'
import { timeAgo } from '@/lib/utils/timeAgo'
import { friendlyMessage } from '@/lib/errors/friendlyMessage'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ROWRecord {
  id: string
  scheme_id: string | null
  school: string
  grade: string
  learning_area: string
  term: string
  year: number
  total_entries: number
  completed_entries: number
}

interface DocScheme extends SchemeWithProgress {
  row?: ROWRecord
}

// keyed by document_type
interface DlMarker {
  lastWeek:    number | null
  totalWeeks:  number | null
  downloadedAt: string
}
type SchemeDlMap = Record<string, DlMarker>  // document_type → marker
type DlMap       = Record<string, SchemeDlMap> // scheme_id    → SchemeDlMap

type FilterKey = 'all' | string

interface DownloadOptions {
  sow: boolean
  lessonPlans: boolean
  recordOfWork: boolean
}

interface ModalState {
  open: boolean
  bulk: boolean
  scheme: DocScheme | null
}

interface ConfirmDeleteState {
  schemeId: string
  label: string
  lpCount: number
}

const EXPORT_STEPS = [
  { label: 'Compiling schemes of work…',   progress: 15  },
  { label: 'Generating lesson plan PDFs…', progress: 40  },
  { label: 'Building records of work…',    progress: 65  },
  { label: 'Merging documents…',           progress: 85  },
  { label: 'Complete!',                    progress: 100 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number, total: number) {
  if (!total) return 0
  return Math.min(100, Math.round((n / total) * 100))
}

function statusDot(percent: number) {
  if (percent >= 100) return 'bg-emerald-400'
  if (percent > 0)    return 'bg-amber-400'
  return 'bg-slate-600'
}

function curriculumLabel(mode: string) {
  if (mode?.startsWith('cbc')) return 'CBC'
  if (mode?.startsWith('844')) return '8-4-4'
  return mode?.toUpperCase() ?? '—'
}

function gradeShort(g: string) {
  const map: Record<string, string> = {
    grade_7: 'Grade 7', grade_8: 'Grade 8', grade_9: 'Grade 9',
    grade_10: 'Grade 10', grade_11: 'Grade 11', grade_12: 'Grade 12',
    form_3: 'Form 3', form_4: 'Form 4',
  }
  return map[g] ?? g
}

function termKey(term: number, year: number) { return `T${term}-${year}` }

// ─── PipelineCard ─────────────────────────────────────────────────────────────

function PipelineCard({
  label, count, total, color, icon: Icon,
  marker, currentMaxWeek, onCatchUp, catchUpLoading,
}: {
  label:           string
  count:           number
  total:           number
  color:           string
  icon:            React.ElementType
  marker?:         DlMarker | null
  currentMaxWeek?: number | null
  onCatchUp?:      (fromWeek: number) => void
  catchUpLoading?: boolean
}) {
  const percent = pct(count, total)
  const barColor: Record<string, string> = {
    green: 'bg-[#1D9E75]',
    blue:  'bg-[#378ADD]',
    amber: 'bg-[#BA7517]',
  }
  const textColor: Record<string, string> = {
    green: 'text-[#1D9E75]',
    blue:  'text-[#378ADD]',
    amber: 'text-[#BA7517]',
  }

  // Show catch-up button when: marker exists, has a lastWeek, and currentMaxWeek is ahead
  const hasMarker    = !!marker
  const markerWeek   = marker?.lastWeek ?? null
  const showCatchUp  = hasMarker && markerWeek !== null && currentMaxWeek !== null &&
                       currentMaxWeek !== undefined && currentMaxWeek > markerWeek && !!onCatchUp
  const catchUpFrom  = (markerWeek ?? 0) + 1

  return (
    <div className="flex-1 min-w-0 bg-slate-800/60 rounded-lg p-3 border border-slate-700/40">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`w-1.5 h-1.5 rounded-full ${statusDot(percent)}`} />
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700/60 rounded-full h-1.5 mb-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${barColor[color]}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-bold ${textColor[color]}`}>{percent}%</span>
        <span className="text-[10px] text-slate-500">
          {count}/{total} {label === 'Lesson plans' ? 'gen.' : label === 'Record of work' ? 'entries' : 'lessons'}
        </span>
      </div>

      {/* Last downloaded marker */}
      {hasMarker && marker && (
        <div className="flex items-center gap-1 mt-1.5">
          <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-[10px] text-slate-400">
            {markerWeek !== null && markerWeek !== marker.totalWeeks
              ? `Last printed: Wk ${markerWeek}`
              : 'Last printed'}
            {' · '}{timeAgo(marker.downloadedAt)}
          </span>
        </div>
      )}

      {/* Catch-up button */}
      {showCatchUp && onCatchUp && (
        <button
          onClick={() => onCatchUp(catchUpFrom)}
          disabled={catchUpLoading}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold text-amber-400 border border-amber-500/30 rounded-md px-2 py-1 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
        >
          {catchUpLoading
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Download className="w-3 h-3" />
          }
          Wks {catchUpFrom}–{currentMaxWeek} ↓
        </button>
      )}
    </div>
  )
}

// ─── SchemeCard ───────────────────────────────────────────────────────────────

function SchemeCard({
  scheme, selected, onToggle, onDownload, onBulk,
  downloadingKey, generatingKey, onGenerateLP, onGenerateROW,
  schemeDl, onCatchUp, catchUpKey, onDelete,
}: {
  scheme:        DocScheme
  selected:      boolean
  onToggle:      () => void
  onDownload:    (schemeId: string, type: 'sow' | 'lp' | 'row') => void
  onBulk:        (scheme: DocScheme) => void
  downloadingKey: string | null
  generatingKey:  string | null
  onGenerateLP:  (scheme: DocScheme) => void
  onGenerateROW: (scheme: DocScheme) => void
  schemeDl:      SchemeDlMap
  onCatchUp:     (schemeId: string, type: 'lp' | 'row', fromWeek: number) => void
  catchUpKey:    string | null
  onDelete:      (state: ConfirmDeleteState) => void
}) {
  const lpPct   = pct(scheme.lesson_plans_count, scheme.total_lessons)
  const rowDone = scheme.row?.completed_entries ?? 0
  const rowPct  = pct(rowDone, scheme.total_lessons)

  const allComplete = lpPct >= 100 && (scheme.row ? rowPct >= 100 : false)
  const nextLPWeek  = (scheme.latest_lp_week ?? 0) + 1
  const hasROW      = !!scheme.row

  const isDownloading = (t: string) => downloadingKey === `${scheme.id}-${t}`

  // Bundle stale check
  const bundleMark = schemeDl['bundle']
  const bundleStale = bundleMark && bundleMark.lastWeek !== null &&
    scheme.latest_lp_week !== null &&
    scheme.latest_lp_week > bundleMark.lastWeek

  return (
    <div className={`bg-slate-900 rounded-xl border transition-all ${
      selected
        ? 'border-emerald-600 ring-2 ring-emerald-500/30'
        : 'border-slate-700/50 hover:border-slate-600'
    }`}>

      {/* ── Card header ───────────────────────────────────────────────────── */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <button
            onClick={onToggle}
            className="mt-0.5 shrink-0 text-slate-500 hover:text-emerald-400 transition-colors"
          >
            {selected
              ? <CheckSquare className="w-4.5 h-4.5 text-emerald-400" />
              : <Square      className="w-4.5 h-4.5" />
            }
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-bold text-sm">{scheme.learning_area}</span>
              <span className="text-slate-400 text-sm">·</span>
              <span className="text-slate-300 text-sm">{gradeShort(scheme.grade)}</span>
            </div>
            <div className="text-slate-500 text-xs mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
              <span>{scheme.school}</span>
              <span>·</span>
              <span>Term {scheme.term} {scheme.year}</span>
              <span>·</span>
              <span>{scheme.total_weeks} wks</span>
              <span>·</span>
              <span>{scheme.total_lessons} lessons</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              scheme.curriculum_mode?.startsWith('cbc')
                ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20'
                : 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
            }`}>
              {curriculumLabel(scheme.curriculum_mode)}
            </span>
            <span className="text-[10px] font-bold bg-slate-700/60 text-slate-400 border border-slate-600/40 px-2 py-0.5 rounded-md">
              T{scheme.term} {scheme.year}
            </span>
            <button
              onClick={() => onDelete({
                schemeId: scheme.id,
                label: `${scheme.learning_area} · ${gradeShort(scheme.grade)} · Term ${scheme.term} ${scheme.year}`,
                lpCount: scheme.lesson_plans_count,
              })}
              className="ml-1 p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              title="Delete scheme"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Pipeline row ──────────────────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 flex-col sm:flex-row">
          {/* SOW — always 100%, show last-printed if downloaded */}
          <PipelineCard
            label="Scheme of work"
            count={scheme.total_lessons}
            total={scheme.total_lessons}
            color="green"
            icon={BookOpen}
            marker={schemeDl['sow'] ?? null}
          />

          {/* Lesson Plans — with catch-up */}
          <PipelineCard
            label="Lesson plans"
            count={scheme.lesson_plans_count}
            total={scheme.total_lessons}
            color="blue"
            icon={NotebookPen}
            marker={schemeDl['lesson_plans'] ?? null}
            currentMaxWeek={scheme.latest_lp_week}
            onCatchUp={fromWeek => onCatchUp(scheme.id, 'lp', fromWeek)}
            catchUpLoading={catchUpKey === `${scheme.id}-lp`}
          />

          {/* Record of Work — with catch-up */}
          <PipelineCard
            label="Record of work"
            count={rowDone}
            total={scheme.total_lessons}
            color="amber"
            icon={ClipboardList}
            marker={schemeDl['row'] ?? null}
            currentMaxWeek={scheme.latest_lp_week}
            onCatchUp={fromWeek => onCatchUp(scheme.id, 'row', fromWeek)}
            catchUpLoading={catchUpKey === `${scheme.id}-row`}
          />
        </div>
      </div>

      {/* ── Action row ────────────────────────────────────────────────────── */}
      <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-slate-800 pt-3">

        {/* Generate LP if incomplete */}
        {lpPct < 100 && (
          <button
            onClick={() => onGenerateLP(scheme)}
            disabled={!!generatingKey}
            className="flex items-center gap-1.5 text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
          >
            {generatingKey === `${scheme.id}-lp`
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Zap className="w-3.5 h-3.5" />
            }
            Generate Wk {nextLPWeek} LP
          </button>
        )}

        {/* Generate ROW if none exists */}
        {!hasROW && (
          <button
            onClick={() => onGenerateROW(scheme)}
            disabled={!!generatingKey}
            className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
          >
            {generatingKey === `${scheme.id}-row`
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <ClipboardList className="w-3.5 h-3.5" />
            }
            Generate ROW entries
          </button>
        )}

        <div className="flex-1" />

        {/* Bundle stale notice */}
        {bundleStale && bundleMark && (
          <button
            onClick={() => onBulk(scheme)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg px-3 py-1.5 transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Bundle has {(scheme.latest_lp_week ?? 0) - (bundleMark.lastWeek ?? 0)} new wks — re-download?
          </button>
        )}

        {/* Full bundle if all docs complete and no stale notice */}
        {allComplete && !bundleStale && (
          <button
            onClick={() => onBulk(scheme)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500 rounded-lg px-3 py-1.5 transition-all"
          >
            <Package className="w-3.5 h-3.5" />
            Full Bundle PDF
          </button>
        )}

        {/* Individual downloads */}
        {([
          { type: 'sow' as const, label: 'Download SOW', icon: BookOpen },
          { type: 'lp'  as const, label: 'Download LPs', icon: NotebookPen },
          { type: 'row' as const, label: 'Download ROW', icon: ClipboardList },
        ] as const).map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => onDownload(scheme.id, type)}
            disabled={
              isDownloading(type) ||
              (type === 'lp' && scheme.lesson_plans_count === 0) ||
              (type === 'row' && !hasROW && scheme.lesson_plans_count === 0)
            }
            className="flex items-center gap-1.5 text-xs font-semibold bg-slate-700/60 hover:bg-slate-700 text-slate-300 border border-slate-600/50 rounded-lg px-3 py-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDownloading(type)
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Icon className="w-3 h-3" />
            }
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Confirm delete modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  state, onCancel, onConfirm, deleting,
}: {
  state:     ConfirmDeleteState | null
  onCancel:  () => void
  onConfirm: (schemeId: string) => void
  deleting:  boolean
}) {
  if (!state) return null

  const hasPlans = state.lpCount > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!deleting ? onCancel : undefined} />
      <div className="relative w-full max-w-sm bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            <Trash2 className="w-4.5 h-4.5 text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Delete scheme?</h3>
            <p className="text-slate-400 text-xs mt-0.5">{state.label}</p>
          </div>
        </div>

        <p className="text-slate-300 text-sm mb-2">
          {hasPlans
            ? `This scheme has ${state.lpCount} lesson plan${state.lpCount !== 1 ? 's' : ''} linked to it. Deleting will also remove all lesson plans and records of work for this scheme.`
            : 'This cannot be undone.'}
        </p>

        {hasPlans && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <span className="text-xs text-red-300">All linked data will be permanently deleted.</span>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-5">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(state.schemeId)}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {deleting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
            {hasPlans ? 'Delete everything' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Download modal ───────────────────────────────────────────────────────────

function DownloadModal({
  modal, selectedCount, options, setOptions, onClose, onExport, exportStep,
}: {
  modal:         ModalState
  selectedCount: number
  options:       DownloadOptions
  setOptions:    React.Dispatch<React.SetStateAction<DownloadOptions>>
  onClose:       () => void
  onExport:      () => void
  exportStep:    number | null
}) {
  if (!modal.open) return null

  const title = modal.bulk
    ? `Bulk download — ${selectedCount} scheme${selectedCount !== 1 ? 's' : ''}`
    : `Download — ${modal.scheme?.learning_area} Term ${modal.scheme?.term}`

  const isExporting = exportStep !== null
  const isDone      = exportStep === EXPORT_STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={!isExporting ? onClose : undefined} />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-white font-bold text-base">{title}</h2>
              <p className="text-slate-400 text-xs mt-1">Choose what to include</p>
            </div>
            {!isExporting && (
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Options */}
        {!isExporting && (
          <div className="px-6 py-5 space-y-3">
            {([
              { key: 'sow'          as const, label: 'Scheme of work',  desc: 'Full SOW with lessons, strands, resources', color: 'text-[#1D9E75]', bg: 'bg-[#1D9E75]/10 border-[#1D9E75]/30' },
              { key: 'lessonPlans'  as const, label: 'Lesson plans',   desc: 'KICD format — all generated weeks',         color: 'text-[#378ADD]', bg: 'bg-[#378ADD]/10 border-[#378ADD]/30' },
              { key: 'recordOfWork' as const, label: 'Record of work', desc: 'TSC 12-column format',                     color: 'text-[#BA7517]', bg: 'bg-[#BA7517]/10 border-[#BA7517]/30' },
            ]).map(({ key, label, desc, color, bg }) => (
              <label key={key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                options[key] ? bg : 'bg-slate-800/40 border-slate-700/40'
              }`}>
                <div className="mt-0.5">
                  {options[key]
                    ? <CheckSquare className={`w-4.5 h-4.5 ${color}`} />
                    : <Square className="w-4.5 h-4.5 text-slate-500" />
                  }
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${options[key] ? color : 'text-slate-400'}`}>{label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                </div>
                <input type="checkbox" className="sr-only" checked={options[key]}
                  onChange={e => setOptions(o => ({ ...o, [key]: e.target.checked }))} />
              </label>
            ))}
          </div>
        )}

        {/* Progress */}
        {isExporting && (
          <div className="px-6 py-8">
            <div className="text-center mb-6">
              {isDone ? (
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3">
                  <Download className="w-6 h-6 text-emerald-400" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center mx-auto mb-3">
                  <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                </div>
              )}
              <p className="text-white text-sm font-semibold">{EXPORT_STEPS[exportStep]?.label}</p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${EXPORT_STEPS[exportStep]?.progress ?? 0}%` }}
              />
            </div>
            <div className="text-right text-xs text-slate-500">{EXPORT_STEPS[exportStep]?.progress}%</div>
            <div className="flex justify-between mt-4">
              {EXPORT_STEPS.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all ${
                  i <= exportStep ? 'bg-teal-400' : 'bg-slate-700'
                }`} />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        {!isExporting && (
          <div className="px-6 pb-6 flex gap-3 justify-end">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={onExport}
              disabled={!options.sow && !options.lessonPlans && !options.recordOfWork}
              className="flex items-center gap-2 px-5 py-2 bg-teal-500 hover:bg-teal-400 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Export PDF <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TeacherDocumentsPage() {
  const [schemes, setSchemes]               = useState<DocScheme[]>([])
  const [dlMap, setDlMap]                   = useState<DlMap>({})
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [filter, setFilter]                 = useState<FilterKey>('all')
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const [catchUpKey, setCatchUpKey]         = useState<string | null>(null)
  const [generatingKey, setGeneratingKey]   = useState<string | null>(null)
  const [modal, setModal]                   = useState<ModalState>({ open: false, bulk: false, scheme: null })
  const [options, setOptions]               = useState<DownloadOptions>({ sow: true, lessonPlans: true, recordOfWork: true })
  const [exportStep, setExportStep]         = useState<number | null>(null)
  const [toast, setToast]                   = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [confirmDelete, setConfirmDelete]   = useState<ConfirmDeleteState | null>(null)
  const [deleting, setDeleting]             = useState(false)

  // ── Data fetch ───────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [sowRes, rowRes, markerRes] = await Promise.all([
          fetch('/api/sow/list'),
          fetch('/api/teacher/records-of-work'),
          fetch('/api/documents/markers'),
        ])
        const [sowJson, rowJson, markerJson] = await Promise.all([
          sowRes.json(), rowRes.json(), markerRes.json(),
        ])

        const rowByScheme = new Map<string, ROWRecord>(
          (rowJson.data?.records ?? [])
            .filter((r: ROWRecord) => r.scheme_id)
            .map((r: ROWRecord) => [r.scheme_id!, r])
        )

        const enriched: DocScheme[] = (sowJson.data?.schemes ?? []).map(
          (s: SchemeWithProgress) => ({ ...s, row: rowByScheme.get(s.id) })
        )
        setSchemes(enriched)

        // Build dlMap from markers
        const map: DlMap = {}
        for (const m of (markerJson.data?.markers ?? []) as DlMarkerRow[]) {
          if (!map[m.scheme_id]) map[m.scheme_id] = {}
          map[m.scheme_id][m.document_type] = {
            lastWeek:    m.last_week_downloaded,
            totalWeeks:  m.total_weeks,
            downloadedAt: m.downloaded_at,
          }
        }
        setDlMap(map)
      } catch {
        setError('Failed to load documents. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Filter chips (derived) ───────────────────────────────────────────────────

  const filterChips = useMemo(() => {
    const termSet = new Set<string>()
    schemes.forEach(s => termSet.add(termKey(s.term, s.year)))
    const terms = Array.from(termSet).sort().reverse()
    return [
      { key: 'all', label: 'All terms' },
      ...terms.map(k => {
        const [, t, y] = k.match(/T(\d+)-(\d+)/) ?? []
        return { key: k, label: `Term ${t} ${y}` }
      }),
      { key: 'cbc', label: 'CBC' },
      { key: '844', label: '8-4-4' },
    ]
  }, [schemes])

  // ── Filtered schemes ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (filter === 'all') return schemes
    if (filter === 'cbc') return schemes.filter(s => s.curriculum_mode?.startsWith('cbc'))
    if (filter === '844') return schemes.filter(s => s.curriculum_mode?.startsWith('844'))
    const [, t, y] = filter.match(/T(\d+)-(\d+)/) ?? []
    if (t && y) return schemes.filter(s => s.term === Number(t) && s.year === Number(y))
    return schemes
  }, [schemes, filter])

  // ── Selection helpers ─────────────────────────────────────────────────────────

  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id))

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filtered.forEach(s => next.delete(s.id))
      } else {
        filtered.forEach(s => next.add(s.id))
      }
      return next
    })
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Marker update helper ──────────────────────────────────────────────────────

  function applyMarker(schemeId: string, docType: string, marker: DlMarker) {
    setDlMap(prev => ({
      ...prev,
      [schemeId]: { ...(prev[schemeId] ?? {}), [docType]: marker },
    }))
  }

  // ── Individual download ───────────────────────────────────────────────────────

  const handleDownload = useCallback(async (schemeId: string, type: 'sow' | 'lp' | 'row') => {
    setDownloadingKey(`${schemeId}-${type}`)
    try {
      const res  = await fetch('/api/documents/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, schemeId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Download failed')

      const { html, marker } = json.data
      const win = window.open('', '_blank')
      if (!win) throw new Error('Popup blocked — please allow popups for this site.')
      win.document.write(html)
      win.document.close()
      win.print()

      // Update dlMap with returned marker
      const docType = type === 'lp' ? 'lesson_plans' : type
      applyMarker(schemeId, docType, marker)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed', 'err')
    } finally {
      setDownloadingKey(null)
    }
  }, [])

  // ── Catch-up download ─────────────────────────────────────────────────────────

  const handleCatchUp = useCallback(async (
    schemeId: string, type: 'lp' | 'row', fromWeek: number
  ) => {
    setCatchUpKey(`${schemeId}-${type}`)
    try {
      const res  = await fetch('/api/documents/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, schemeId, fromWeek }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Download failed')

      const { html, marker } = json.data
      const win = window.open('', '_blank')
      if (!win) throw new Error('Popup blocked — please allow popups for this site.')
      win.document.write(html)
      win.document.close()
      win.print()

      const docType = type === 'lp' ? 'lesson_plans' : type
      applyMarker(schemeId, docType, marker)
      showToast(`Weeks ${fromWeek}+ downloaded!`, 'ok')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed', 'err')
    } finally {
      setCatchUpKey(null)
    }
  }, [])

  // ── Bulk export ───────────────────────────────────────────────────────────────

  async function handleExport() {
    const ids = modal.bulk
      ? Array.from(selectedIds)
      : modal.scheme ? [modal.scheme.id] : []
    if (!ids.length) return

    const exportPromise = fetch('/api/documents/bulk-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemeIds: ids, include: options }),
    })

    for (let i = 0; i < EXPORT_STEPS.length - 1; i++) {
      setExportStep(i)
      await new Promise(r => setTimeout(r, 900))
    }

    try {
      const res = await exportPromise
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Export failed')
      }

      const blob = await res.blob()
      setExportStep(EXPORT_STEPS.length - 1)
      await new Promise(r => setTimeout(r, 800))

      const single   = ids.length === 1
      const m        = schemes.find(s => s.id === ids[0])
      const filename = single && m
        ? `EduNexus_${m.learning_area.replace(/\s+/g, '_')}_T${m.term}_${m.year}.pdf`
        : `EduNexus_Documents_Bundle.pdf`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)

      setExportStep(null)
      setModal({ open: false, bulk: false, scheme: null })
      showToast('Documents exported!', 'ok')

      // Refresh markers after bulk export
      const markerRes  = await fetch('/api/documents/markers')
      const markerJson = await markerRes.json()
      const map: DlMap = {}
      for (const mk of (markerJson.data?.markers ?? []) as DlMarkerRow[]) {
        if (!map[mk.scheme_id]) map[mk.scheme_id] = {}
        map[mk.scheme_id][mk.document_type] = {
          lastWeek:    mk.last_week_downloaded,
          totalWeeks:  mk.total_weeks,
          downloadedAt: mk.downloaded_at,
        }
      }
      setDlMap(map)
    } catch (err) {
      setExportStep(null)
      showToast(err instanceof Error ? err.message : 'Export failed', 'err')
    }
  }

  // ── Generate LP ───────────────────────────────────────────────────────────────

  async function handleGenerateLP(scheme: DocScheme) {
    setGeneratingKey(`${scheme.id}-lp`)
    const nextWeek = (scheme.latest_lp_week ?? 0) + 1
    try {
      const res  = await fetch('/api/lesson-plans/generate-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sowId: scheme.id, weekNumber: nextWeek }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')
      showToast(`Week ${nextWeek} lesson plans generated!`, 'ok')
      setSchemes(prev => prev.map(s => s.id === scheme.id
        ? { ...s, lesson_plans_count: s.lesson_plans_count + (scheme.lessons_per_week ?? 4), latest_lp_week: nextWeek }
        : s
      ))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Generation failed', 'err')
    } finally {
      setGeneratingKey(null)
    }
  }

  // ── Generate ROW ──────────────────────────────────────────────────────────────

  async function handleGenerateROW(scheme: DocScheme) {
    setGeneratingKey(`${scheme.id}-row`)
    try {
      const res  = await fetch('/api/teacher/records-of-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId:       scheme.id, school: scheme.school, grade: scheme.grade,
          learningArea:   scheme.learning_area, term: scheme.term,
          year:           scheme.year, curriculumMode: scheme.curriculum_mode,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create record of work')
      showToast('Record of work created!', 'ok')

      const rowRes  = await fetch('/api/teacher/records-of-work')
      const rowJson = await rowRes.json()
      const rowByScheme = new Map<string, ROWRecord>(
        (rowJson.data?.records ?? [])
          .filter((r: ROWRecord) => r.scheme_id)
          .map((r: ROWRecord) => [r.scheme_id!, r])
      )
      setSchemes(prev => prev.map(s => ({ ...s, row: rowByScheme.get(s.id) })))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create record of work', 'err')
    } finally {
      setGeneratingKey(null)
    }
  }

  // ── Delete scheme ─────────────────────────────────────────────────────────────

  async function handleDeleteScheme(schemeId: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/schemes/${schemeId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not delete scheme')
      setSchemes(prev => prev.filter(s => s.id !== schemeId))
      setSelectedIds(prev => { const n = new Set(prev); n.delete(schemeId); return n })
      setConfirmDelete(null)
      showToast('Scheme deleted.', 'ok')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'err')
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const countSelected = selectedIds.size

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Hero header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-b border-slate-800/60 px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-5 h-5 text-teal-400" />
                <h1 className="text-xl font-black text-white">My documents</h1>
              </div>
              <p className="text-slate-400 text-sm">Schemes · Lesson plans · Records of work</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors px-3 py-2 rounded-lg hover:bg-slate-800"
              >
                {allFilteredSelected ? 'Deselect all' : 'Select all'}
              </button>
              <button
                disabled={countSelected === 0}
                onClick={() => setModal({ open: true, bulk: true, scheme: null })}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold rounded-xl transition-all"
              >
                <Download className="w-4 h-4" />
                Download selected
                {countSelected > 0 && (
                  <span className="bg-white/20 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
                    {countSelected}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 mt-5">
            {filterChips.map(chip => (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                  filter === chip.key
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selection bar */}
      <div className={`sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 transition-all duration-300 ${
        countSelected > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
      }`}>
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-300">
            {countSelected} scheme{countSelected !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Clear
            </button>
            <button
              onClick={() => setModal({ open: true, bulk: true, scheme: null })}
              className="flex items-center gap-1.5 text-xs font-bold bg-teal-500 hover:bg-teal-400 text-white px-3 py-1.5 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{friendlyMessage(error).message}</span>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-24">
            <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400 font-semibold">No schemes found</p>
            <p className="text-slate-600 text-sm mt-1">
              {filter === 'all' ? 'Create your first Scheme of Work to get started.' : 'Try a different filter above.'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(scheme => (
              <SchemeCard
                key={scheme.id}
                scheme={scheme}
                selected={selectedIds.has(scheme.id)}
                onToggle={() => toggleSelect(scheme.id)}
                onDownload={handleDownload}
                onBulk={s => setModal({ open: true, bulk: false, scheme: s })}
                downloadingKey={downloadingKey}
                generatingKey={generatingKey}
                onGenerateLP={handleGenerateLP}
                onGenerateROW={handleGenerateROW}
                schemeDl={dlMap[scheme.id] ?? {}}
                onCatchUp={handleCatchUp}
                catchUpKey={catchUpKey}
                onDelete={setConfirmDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      <ConfirmDeleteModal
        state={confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDeleteScheme}
        deleting={deleting}
      />

      {/* Download modal */}
      <DownloadModal
        modal={modal}
        selectedCount={countSelected}
        options={options}
        setOptions={setOptions}
        onClose={() => { setModal({ open: false, bulk: false, scheme: null }); setExportStep(null) }}
        onExport={handleExport}
        exportStep={exportStep}
      />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-24 lg:bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-semibold transition-all ${
          toast.type === 'ok'
            ? 'bg-emerald-900/90 border-emerald-600/40 text-emerald-300'
            : 'bg-red-900/90 border-red-600/40 text-red-300'
        }`}>
          {toast.type === 'err' && <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
