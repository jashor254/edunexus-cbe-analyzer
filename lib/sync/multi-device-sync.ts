'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ==============================
// SIMPLE DEVICE ID
// ==============================
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'

  const KEY = 'edunexus_device_id'
  let id = localStorage.getItem(KEY)

  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(KEY, id)
  }

  return id
}

// ==============================
// SIMPLE SYNC MANAGER
// ==============================
class SyncState {
  static lastSync: number = 0
}

export async function syncUserData(userId: string) {
  try {
    const { data: students } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)

    const ids = students?.map(s => s.id) || []

    const { data: assessments } = await supabase
      .from('assessments')
      .select('*')
      .in('student_id', ids)

    SyncState.lastSync = Date.now()

    return {
      students: students || [],
      assessments: assessments || []
    }
  } catch (e) {
    console.error('SYNC ERROR:', e)
    return { students: [], assessments: [] }
  }
}

// ==============================
// BACKGROUND SYNC HOOK
// ==============================
export function useSimpleSync(intervalMinutes = 5) {
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Prevent spam syncing
      if (Date.now() - SyncState.lastSync < intervalMinutes * 60 * 1000)
        return

      setSyncing(true)

      await syncUserData(user.id)

      setSyncing(false)
    }

    run()

    const timer = setInterval(run, intervalMinutes * 60 * 1000)
    return () => clearInterval(timer)
  }, [intervalMinutes])

  return syncing
}