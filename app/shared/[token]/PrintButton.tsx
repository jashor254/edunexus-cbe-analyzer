'use client'
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl font-bold text-sm transition-all"
    >
      🖨️ Print Report
    </button>
  )
}
