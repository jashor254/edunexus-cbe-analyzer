'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { GraduationCap, Users } from 'lucide-react'

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
  const switchTo:   'teacher' | 'parent' = isTeacherSide ? 'parent'           : 'teacher'
  const switchPath: string               = isTeacherSide ? '/dashboard'        : '/teacher/dashboard'

  function handleSwitch() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred_role', switchTo)
    }
    router.push(switchPath)
  }

  // Dark style: used inside teacher sidebar (dark bg)
  // Light style: used inside parent navbar (white bg)
  if (isTeacherSide) {
    return (
      <button
        onClick={handleSwitch}
        className="flex items-center gap-2 text-white/40 hover:text-white/70
                   text-xs font-medium transition-colors px-3 py-1.5
                   rounded-lg hover:bg-white/5 border border-white/10
                   hover:border-white/20 w-full"
      >
        <Users className="w-3.5 h-3.5 shrink-0" />
        Parent view
      </button>
    )
  }

  return (
    <button
      onClick={handleSwitch}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50
                 border border-amber-200 text-amber-800 text-xs font-bold
                 rounded-full hover:bg-amber-100 transition-colors whitespace-nowrap"
    >
      <GraduationCap className="w-3.5 h-3.5 shrink-0" />
      Teacher view
    </button>
  )
}
