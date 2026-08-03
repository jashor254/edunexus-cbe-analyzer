import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getOrganization } from '@/lib/organizations/get'
import { getUserRole } from '@/lib/iam/permissions'
import OrgSidebar from '@/components/organizations/OrgSidebar'

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnTo=/organizations/${orgId}`)

  let org
  try {
    org = await getOrganization(orgId, user.id)
  } catch {
    notFound()
  }

  const role = await getUserRole(user.id, orgId)

  return (
    <div className="min-h-screen bg-nexus-ink text-white">
      <OrgSidebar
        orgId={org.id}
        orgName={org.name}
        orgType={org.type}
        userRole={role ?? 'member'}
      />
      <main className="lg:pl-64">
        <div className="min-h-screen pb-20 lg:pb-0">
          {children}
        </div>
      </main>
    </div>
  )
}
