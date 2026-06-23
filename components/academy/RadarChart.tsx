'use client'

import type { TeacherCompetency } from '@/lib/academy/competencies'

// Fixed display order — groups competencies into visual quadrants
const RADAR_ORDER = [
  'AIL-01', 'AIJ-01', 'DIG-01',   // AI Skills   — top
  'CLC-01', 'PED-01', 'ASS-01',   // Pedagogy    — right
  'DIF-01', 'VLP-01', 'REF-01',   // Values      — bottom
  'IMP-01', 'COL-01', 'INN-01',   // Leadership  — left
]

const SHORT_LABEL: Record<string, string> = {
  'AIL-01': 'AI Literacy',
  'AIJ-01': 'AI Judgement',
  'DIG-01': 'Digital',
  'CLC-01': 'Curriculum',
  'PED-01': 'Pedagogy',
  'ASS-01': 'Assessment',
  'DIF-01': 'Differentiation',
  'VLP-01': 'Values & PCIs',
  'REF-01': 'Reflection',
  'IMP-01': 'Impact',
  'COL-01': 'Collaboration',
  'INN-01': 'Innovation',
}

const CATEGORY_LABELS: Record<string, string> = {
  ai_skills:  'AI Skills',
  pedagogy:   'Teaching Craft',
  values:     'Professional Values',
  leadership: 'Leadership',
}

const CX = 200
const CY = 200
const MAX_R = 140
const LABEL_R = MAX_R + 30

function angle(i: number, n: number) {
  return -Math.PI / 2 + (2 * Math.PI * i) / n
}

function polar(i: number, n: number, v: number) {
  const a = angle(i, n)
  const r = (v / 5) * MAX_R
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
}

function outerPt(i: number, n: number) {
  const a = angle(i, n)
  return { x: CX + MAX_R * Math.cos(a), y: CY + MAX_R * Math.sin(a) }
}

export default function RadarChart({ competencies }: { competencies: TeacherCompetency[] }) {
  const compMap = new Map(competencies.map(c => [c.id, c]))

  // Order by RADAR_ORDER, fill gaps with score=0 placeholder
  const ordered = RADAR_ORDER.map(id => compMap.get(id)).filter(Boolean) as TeacherCompetency[]
  const N = ordered.length

  if (N < 3) return null

  // Rings at 1, 2, 3, 4, 5
  const rings = [1, 2, 3, 4, 5]

  function ringPolygon(v: number) {
    return ordered.map((_, i) => {
      const pt = polar(i, N, v)
      return `${pt.x},${pt.y}`
    }).join(' ')
  }

  const filledPolygon = ordered.map((c, i) => {
    const pt = polar(i, N, c.score)
    return `${pt.x},${pt.y}`
  }).join(' ')

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* SVG chart */}
      <div className="w-full lg:w-[420px] shrink-0">
        <svg viewBox="0 0 400 400" className="w-full">
          {/* Grid rings */}
          {rings.map(r => (
            <polygon
              key={r}
              points={ringPolygon(r)}
              fill="none"
              stroke={r === 5 ? '#cbd5e1' : '#f1f5f9'}
              strokeWidth={r === 5 ? 1.5 : 1}
            />
          ))}

          {/* Ring labels (1–5) */}
          {rings.map(r => (
            <text
              key={`rl-${r}`}
              x={CX + 4}
              y={CY - (r / 5) * MAX_R - 3}
              fontSize="9"
              fill="#94a3b8"
              textAnchor="start"
            >
              {r}
            </text>
          ))}

          {/* Axis spokes */}
          {ordered.map((c, i) => {
            const end = outerPt(i, N)
            return (
              <line
                key={c.id}
                x1={CX} y1={CY}
                x2={end.x} y2={end.y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            )
          })}

          {/* Filled polygon */}
          <polygon
            points={filledPolygon}
            fill="#14b8a618"
            stroke="#14b8a6"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {ordered.map((c, i) => {
            if (c.score === 0) return null
            const pt = polar(i, N, c.score)
            return (
              <circle
                key={c.id}
                cx={pt.x}
                cy={pt.y}
                r={4}
                fill={c.color}
                stroke="white"
                strokeWidth="1.5"
              />
            )
          })}

          {/* Axis labels */}
          {ordered.map((c, i) => {
            const a = angle(i, N)
            const lx = CX + LABEL_R * Math.cos(a)
            const ly = CY + LABEL_R * Math.sin(a)

            const anchor =
              Math.abs(Math.cos(a)) < 0.25 ? 'middle' as const :
              Math.cos(a) > 0              ? 'start'  as const : 'end' as const

            const baseline =
              Math.abs(Math.sin(a)) < 0.25 ? 'middle'  as const :
              Math.sin(a) > 0              ? 'hanging' as const : 'auto' as const

            return (
              <text
                key={c.id}
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline={baseline}
                fontSize="10"
                fontWeight="700"
                fill={c.score > 0 ? c.color : '#cbd5e1'}
              >
                {SHORT_LABEL[c.id] ?? c.id}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Legend — competency score bars */}
      <div className="flex-1 space-y-3 w-full">
        {(['ai_skills', 'pedagogy', 'values', 'leadership'] as const).map(cat => {
          const catItems = ordered.filter(c => c.category === cat)
          if (!catItems.length) return null
          return (
            <div key={cat}>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">
                {CATEGORY_LABELS[cat]}
              </p>
              <div className="space-y-2">
                {catItems.map(c => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-bold text-gray-700">{c.label}</span>
                      <span className="text-[11px] font-black" style={{ color: c.score > 0 ? c.color : '#94a3b8' }}>
                        {c.score > 0 ? `${c.score}/5` : '—'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${(c.score / 5) * 100}%`,
                          background: c.color,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {c.completedModules}/{c.totalModules} modules completed
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { CATEGORY_LABELS }
