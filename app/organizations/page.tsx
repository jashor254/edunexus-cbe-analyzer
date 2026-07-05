export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserOrganizations } from '@/lib/organizations/get'
import { Building2, Plus, ArrowRight, Users, Crown, Shield, Eye } from 'lucide-react'

const ROLE_ICON: Record<string, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  viewer: Eye,
}

const TYPE_COLOR: Record<string, string> = {
  school:     'bg-blue-500/20 text-blue-300',
  district:   'bg-purple-500/20 text-purple-300',
  county:     'bg-orange-500/20 text-orange-300',
  ministry:   'bg-red-500/20 text-red-300',
  developer:  'bg-teal-500/20 text-teal-300',
  publisher:  'bg-yellow-500/20 text-yellow-300',
  university: 'bg-indigo-500/20 text-indigo-300',
  ngo:        'bg-green-500/20 text-green-300',
}

export default async function OrganizationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgs = await getUserOrganizations(user.id)

  return (
    <div className="min-h-screen bg-[#060d18] text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Organizations</h1>
            <p className="text-white/50 text-sm mt-1">Manage your schools, districts, and teams</p>
          </div>
          <Link
            href="/organizations/new"
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Organization
          </Link>
        </div>

        {/* Empty state */}
        {orgs.length === 0 && (
          <div className="text-center py-20 border border-white/10 rounded-2xl">
            <Building2 className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white/70 mb-2">No organizations yet</h2>
            <p className="text-white/40 text-sm mb-6">Create your first organization to get started</p>
            <Link
              href="/organizations/new"
              className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Organization
            </Link>
          </div>
        )}

        {/* Org list */}
        <div className="space-y-3">
          {orgs.map(org => {
            const RoleIcon = ROLE_ICON[org.membership.role] ?? Users
            const typeColor = TYPE_COLOR[org.type] ?? 'bg-white/10 text-white/60'

            return (
              <Link
                key={org.id}
                href={`/organizations/${org.id}`}
                className="flex items-center justify-between p-5 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-teal-500/30 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-teal-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{org.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor}`}>
                        {org.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-white/40 text-xs">{org.slug}</span>
                      <span className={`flex items-center gap-1 text-xs ${org.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {org.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-white/40 text-sm">
                    <RoleIcon className="w-3.5 h-3.5" />
                    <span>{org.membership.role}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-teal-400 transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
