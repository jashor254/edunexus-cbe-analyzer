'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import confetti from 'canvas-confetti'
import { markOnboardingComplete } from '@/lib/user-actions'

type TutorialStep = {
  title: string
  description: string
  icon: string
}

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Welcome to EduNexus!',
    description: 'Track CBC assessments, get AI-powered insights, and help your child excel.',
    icon: '🎓',
  },
  {
    title: 'Add Your Child',
    description: 'Create a student profile with their name and grade to begin tracking.',
    icon: '👨‍👩‍👧‍👦',
  },
  {
    title: 'Get AI Insights',
    description: 'Our AI analyzes performance to identify strengths and learning gaps.',
    icon: '🤖',
  }
]

export function OnboardingTutorial({ userId }: { userId: string }) {
  const [show, setShow] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    // Local check kwanza kwa speed
    const hasSeen = localStorage.getItem('hasSeenTutorial')
    if (!hasSeen) setShow(true)
  }, [])

  const handleComplete = async () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    })

    localStorage.setItem('hasSeenTutorial', 'true')
    
    // Save to DB (UUID compatible sasa)
    if (userId) {
      await markOnboardingComplete(userId)
    }

    setTimeout(() => setShow(false), 1000)
  }

  if (!show) return null

  const step = tutorialSteps[currentStep]

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[50px] max-w-2xl w-full p-12 relative animate-in zoom-in-95 duration-300">
        <button 
          onClick={() => setShow(false)} 
          className="absolute top-8 right-8 text-slate-400 hover:text-black"
        >
          <X className="w-8 h-8" />
        </button>

        <div className="text-center">
          <div className="text-9xl mb-8 animate-bounce">{step.icon}</div>
          <h2 className="text-4xl font-black uppercase mb-4 tracking-tight">{step.title}</h2>
          <p className="text-xl text-slate-600 mb-12">{step.description}</p>
        </div>

        <div className="flex items-center justify-between">
          <button
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(prev => prev - 1)}
            className="text-slate-400 font-bold disabled:opacity-0"
          >
            Previous
          </button>

          <div className="flex gap-2">
            {tutorialSteps.map((_, i) => (
              <div key={i} className={`h-2 w-2 rounded-full ${i === currentStep ? 'bg-purple-600 w-8' : 'bg-slate-200'} transition-all`} />
            ))}
          </div>

          <button
            onClick={() => currentStep === tutorialSteps.length - 1 ? handleComplete() : setCurrentStep(prev => prev + 1)}
            className="bg-black text-white px-8 py-4 rounded-full font-black uppercase flex items-center gap-2 hover:scale-105 transition-all"
          >
            {currentStep === tutorialSteps.length - 1 ? "Start" : "Next"}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}