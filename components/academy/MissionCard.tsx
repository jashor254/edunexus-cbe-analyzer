import Link from 'next/link'
import { Zap, CheckCircle2, ChevronRight, Target } from 'lucide-react'
import type { MissionWithCompletion } from '@/lib/academy/types'

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  compare:     { label: 'Compare',     color: '#7c3aed', bg: '#f5f3ff' },
  investigate: { label: 'Investigate', color: '#0891b2', bg: '#ecfeff' },
  apply:       { label: 'Apply',       color: '#059669', bg: '#ecfdf5' },
  create:      { label: 'Create',      color: '#d97706', bg: '#fffbeb' },
  teach:       { label: 'Teach',       color: '#dc2626', bg: '#fef2f2' },
  build:       { label: 'Build',       color: '#1d4ed8', bg: '#eff6ff' },
}

interface Props {
  mission: MissionWithCompletion
  moduleColor: string
}

export default function MissionCard({ mission, moduleColor }: Props) {
  const typeMeta  = TYPE_META[mission.mission_type] ?? TYPE_META.apply
  const completed = mission.completion !== null
  const aiScore   = mission.completion?.ai_score ?? null

  return (
    <Link
      href={`/teacher/academy/mission/${mission.id}`}
      className="group flex items-start gap-4 bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      {/* Icon */}
      <div
        className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: completed ? `${moduleColor}18` : '#f1f5f9' }}
      >
        {completed ? (
          <CheckCircle2 className="w-5 h-5" style={{ color: moduleColor }} />
        ) : (
          <Target className="w-5 h-5 text-slate-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-lg"
            style={{ background: typeMeta.bg, color: typeMeta.color }}
          >
            {typeMeta.label}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
            <Zap className="w-2.5 h-2.5" /> {mission.xp_reward} XP
          </span>
          {aiScore && (
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-lg"
              style={{ background: `${moduleColor}18`, color: moduleColor }}
            >
              Score {aiScore}/5
            </span>
          )}
        </div>
        <p className="text-sm font-black text-gray-900 leading-tight">{mission.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{mission.description}</p>
      </div>

      {/* Arrow */}
      <ChevronRight
        className="shrink-0 w-4 h-4 text-gray-300 group-hover:text-gray-500 transition mt-1"
        style={{ color: completed ? moduleColor : undefined }}
      />
    </Link>
  )
}
