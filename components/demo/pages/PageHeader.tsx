import { STUDENT } from '../mockData'

type Props = { page: number; tall?: boolean }

export default function PageHeader({ page, tall = false }: Props) {
  return (
    <div
      className={`bg-[#1a2744] px-6 flex items-center justify-between shrink-0 ${
        tall ? 'py-4 md:py-5' : 'py-3'
      }`}
    >
      <div>
        <div className="text-amber-500 text-[10px] font-black tracking-[0.2em] uppercase">
          EduNexus Learner Intelligence Report
        </div>
        <div className="text-slate-300 text-xs mt-0.5">
          {STUDENT.name} · Grade {STUDENT.grade}
        </div>
      </div>
      <div className="text-slate-400 text-xs">Page {page} of 7</div>
    </div>
  )
}
