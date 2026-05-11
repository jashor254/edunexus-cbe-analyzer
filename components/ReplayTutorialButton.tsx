'use client'

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { OnboardingTutorial } from '@/components/onboarding-tutorial'

export function ReplayTutorialButton({ userId }: { userId: string }) {
  const [show, setShow] = useState(false)

  const handleReplay = () => {
    localStorage.removeItem('hasSeenParentTutorial')
    setShow(true)
  }

  if (show) {
    return <OnboardingTutorial userId={userId} />
  }

  return (
    <button
      onClick={handleReplay}
      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
    >
      <HelpCircle className="w-4 h-4" />
      <span>Replay Tutorial</span>
    </button>
  )
}
