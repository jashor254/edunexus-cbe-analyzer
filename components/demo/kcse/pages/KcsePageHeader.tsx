import { KCSE_STUDENT } from '../kcseMockData'

type Props = { page: number; tall?: boolean }

export default function KcsePageHeader({ page, tall = false }: Props) {
  return (
    <div
      className={`bg-[#1a2744] px-6 flex items-center justify-between shrink-0 ${
        tall ? 'py-4 md:py-5' : 'py-3'
      }`}
    >
      <div>
        <div className="text-amber-500 text-[10px] font-black tracking-[0.2em] uppercase">
          EduNexus Academic Clinic
        </div>
        <div className="text-slate-300 text-xs mt-0.5">
          {KCSE_STUDENT.name} · Form {KCSE_STUDENT.form} · {KCSE_STUDENT.school}
        </div>
      </div>
      <div className="text-right">
        <div className="text-slate-400 text-xs">Page {page} of 7</div>
        <div className="text-amber-600 text-[9px] font-black tracking-wider mt-0.5">KCSE MODE</div>
      </div>
    </div>
  )
}
