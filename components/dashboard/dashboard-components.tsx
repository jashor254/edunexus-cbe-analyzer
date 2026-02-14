'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSimpleSync } from '@/lib/sync/multi-device-sync'

// =====================================
// TYPES
// =====================================

type Stats = {
  students: number
  assessments: number
}

// =====================================
// COMPONENT
// =====================================

export default function DashboardComponents() {
  const [stats, setStats] = useState<Stats>({
    students: 0,
    assessments: 0
  })

  const [loading, setLoading] = useState(true)

  // Simple background sync
  const syncing = useSimpleSync(5)

  // =====================================
  // LOAD BASIC DASHBOARD DATA
  // =====================================

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)

      const ids = students?.map(s => s.id) || []

      const { data: assessments } = await supabase
        .from('assessments')
        .select('id')
        .in('student_id', ids)

      setStats({
        students: students?.length || 0,
        assessments: assessments?.length || 0
      })

      setLoading(false)
    }

    load()
  }, [])

  // =====================================
  // UI
  // =====================================

  if (loading) {
    return (
      <div className="p-6 text-slate-500">
        Loading dashboard...
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          EduNexus Dashboard
        </h1>

        {/* SYNC STATUS */}
        <div className="text-xs text-slate-500">
          {syncing ? 'Syncing...' : 'Synced'}
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="bg-white shadow rounded-xl p-4">
          <div className="text-sm text-slate-500">
            Students
          </div>

          <div className="text-3xl font-bold">
            {stats.students}
          </div>
        </div>

        <div className="bg-white shadow rounded-xl p-4">
          <div className="text-sm text-slate-500">
            Assessments
          </div>

          <div className="text-3xl font-bold">
            {stats.assessments}
          </div>
        </div>

      </div>

    </div>
  )
}