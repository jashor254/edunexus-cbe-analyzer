import { redirect } from 'next/navigation'

// The standalone Platform Admin panel merged into the Growth OS founder
// dashboard (app/(growth)/growth/page.tsx) — one dashboard, one access
// check (growth_users via requireGrowthUser), instead of a second page
// gated by a separate email allowlist.
export default function AdminPage() {
  redirect('/growth')
}
