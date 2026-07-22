import Link from 'next/link'

// Growth OS nav shell — deliberately separate from the learner-facing app
// shell (docs/growth-os/edunexus-growth-engine-implementation-blueprint.md §1).
// No sidebar chrome beyond four links yet: Sprint C0 is Schools/Pipeline/
// Follow-ups/Dashboard, nothing else earns a nav slot until it exists.
export default function GrowthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <nav className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-6">
          <span className="font-semibold text-neutral-900">EduNexus Growth OS</span>
          <Link href="/growth" className="text-sm text-neutral-600 hover:text-neutral-900">Today</Link>
          <Link href="/growth/schools" className="text-sm text-neutral-600 hover:text-neutral-900">Schools</Link>
          <Link href="/growth/pipeline" className="text-sm text-neutral-600 hover:text-neutral-900">Pipeline</Link>
          <Link href="/growth/import" className="text-sm text-neutral-600 hover:text-neutral-900">Import</Link>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
