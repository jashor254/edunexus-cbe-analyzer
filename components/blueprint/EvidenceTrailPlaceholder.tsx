// components/blueprint/EvidenceTrailPlaceholder.tsx
//
// Layer 5 — Evidence Trail (ADR-0009 §1). Not a BlueprintSection (Evidence
// is "indirect only" for Blueprint per ADR-0005 §3) — a static, inert
// placeholder only, per this sprint's explicit instruction: "Render
// placeholder component only. No QR generation. No links." Reserved for
// Sprint 12K+ once a real Evidence deep-link destination exists.

export default function EvidenceTrailPlaceholder() {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-gray-900 text-sm">Evidence Trail</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-violet-50 text-violet-600 border-violet-100">
            Coming Soon
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          Full traceability for any claim on this Blueprint — reserved (ADR-0009 §1, Layer 5). No implementation this sprint.
        </p>
      </div>
    </div>
  )
}
