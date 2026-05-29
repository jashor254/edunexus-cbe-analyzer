'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface RolesResponse {
  isDualRole?: boolean
}

export function RoleSwitcher() {
  const pathname = usePathname()
  const router   = useRouter()
  const [isDualRole, setIsDualRole] = useState(false)
  const [loaded,     setLoaded]     = useState(false)

  useEffect(() => {
    fetch('/api/auth/roles')
      .then(r => r.json())
      .then((d: RolesResponse) => {
        setIsDualRole(d.isDualRole ?? false)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded || !isDualRole) return null

  const isTeacherSide = pathname.startsWith('/teacher')

  return (
    <button
      onClick={() => router.push(isTeacherSide ? '/dashboard' : '/teacher/dashboard')}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-full hover:bg-amber-100 transition-colors whitespace-nowrap"
    >
      {isTeacherSide ? '👨‍👩‍👧 Parent View' : '🏫 Teacher View'}
    </button>
  )
}
