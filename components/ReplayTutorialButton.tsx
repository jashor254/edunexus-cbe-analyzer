// components/ReplayTutorialButton.tsx
'use client'

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { OnboardingTutorial } from '@/components/onboarding-tutorial'

interface ReplayTutorialButtonProps {
  userId: string
  userName?: string
}

export function ReplayTutorialButton({ userId, userName }: ReplayTutorialButtonProps) {
  const [showTutorial, setShowTutorial] = useState(false)

  const handleReplay = () => {
    localStorage.removeItem('hasSeenTutorial')
    setShowTutorial(true)
  }

  const handleClose = () => {
    setShowTutorial(false)
    localStorage.setItem('hasSeenTutorial', 'true')
  }

  return (
    <>
      <button
        onClick={handleReplay}
        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <HelpCircle className="w-4 h-4" />
        <span>Replay Tutorial</span>
      </button>

      {showTutorial && (
        <div onClick={handleClose}>
          <OnboardingTutorial 
            userId={userId}
            userName={userName}
          />
        </div>
      )}
    </>
  )
}
