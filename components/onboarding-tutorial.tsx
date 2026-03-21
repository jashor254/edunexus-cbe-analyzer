'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles, Trophy, Rocket } from 'lucide-react'
import confetti from 'canvas-confetti'
import { markOnboardingComplete } from '@/lib/user-actions'

// 1. WEKA AINA (TYPES) HAPA JUU
type TutorialStep = {
  title: string
  description: string
  icon: string
  color: string
  tip?: string
  action?: string
}

interface OnboardingTutorialProps {
  userId: string
  userName?: string
}

// 2. DATA YA TUTORIAL (Hapa ndipo 'tutorialSteps' ilikuwa inakosekana)
const tutorialSteps: TutorialStep[] = [
  {
    title: 'Karibu EduNexus! 🇰🇪',
    description: 'The only platform built specifically for Kenyan CBC parents. Track competencies, get AI insights, and guide your child to the right career pathway.',
    icon: '🎓',
    color: 'from-blue-500 to-purple-600',
    tip: 'Unlike traditional report cards, we focus on CBC competencies, not just exam scores.',
  },
  {
    title: 'Your Child\'s CBC Journey',
    description: 'Add your child\'s profile to start tracking their competency levels across all learning areas.',
    icon: '👨‍👩‍👧‍👦',
    color: 'from-green-500 to-teal-600',
    action: 'Click "Add Student" on your dashboard after this tutorial',
  },
  {
    title: 'Guardian Tutor AI',
    description: 'Chat with our AI tutor trained on CBC curriculum. Get specific advice on how to support your child\'s learning at home.',
    icon: '🤖',
    color: 'from-purple-500 to-pink-600',
    tip: 'Ask: "How can I help with Grade 7 Math during holidays?"',
  },
  {
    title: 'Academic Clinic Reports',
    description: 'Get AI-powered career recommendations based on your child\'s competency profile.',
    icon: '📊',
    color: 'from-orange-500 to-red-600',
  },
  {
    title: 'Ready to Transform Learning!',
    description: 'You\'re all set! Start by adding your child, then input their latest assessment.',
    icon: '🚀',
    color: 'from-indigo-500 to-blue-600',
  },
]

export function OnboardingTutorial({ userId, userName }: OnboardingTutorialProps) {
  const [mounted, setMounted] = useState(false)
  const [show, setShow] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [isCompleting, setIsCompleting] = useState(false)

  useEffect(() => {
    setMounted(true)
    const hasSeen = localStorage.getItem('hasSeenTutorial')
    if (!hasSeen) {
      const timer = setTimeout(() => setShow(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleComplete = async () => {
    setIsCompleting(true)
    confetti({
      particleCount: 200,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b']
    })

    localStorage.setItem('hasSeenTutorial', 'true')
    
    if (userId) {
      try {
        await markOnboardingComplete(userId)
      } catch (error) {
        console.error('Error marking onboarding complete:', error)
      }
    }

    setTimeout(() => {
      setShow(false)
      setIsCompleting(false)
    }, 1500)
  }

  const handleSkip = () => {
    localStorage.setItem('hasSeenTutorial', 'true')
    setShow(false)
  }

  if (!mounted || !show) return null

  const step = tutorialSteps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === tutorialSteps.length - 1
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
      {/* Animated background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-10 transition-all duration-700`} />
      
      {/* Main tutorial card */}
      <div className="bg-white rounded-3xl max-w-3xl w-full relative animate-in zoom-in-95 duration-300 shadow-2xl overflow-hidden">
        
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100">
          <div 
            className={`h-full bg-gradient-to-r ${step.color} transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8 md:p-12 flex flex-col items-center">
          <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-8 animate-bounce shadow-lg text-5xl`}>
            {step.icon}
          </div>

          <h2 className="text-3xl font-black text-center mb-4 tracking-tight text-slate-900">
            {step.title}
          </h2>

          <p className="text-lg text-slate-600 text-center mb-8 leading-relaxed max-w-md">
            {step.description}
          </p>

          <div className="flex items-center justify-between w-full mt-4">
            <button
              disabled={isFirstStep}
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="text-slate-400 font-bold disabled:opacity-0 flex items-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" /> Previous
            </button>

            <button
              onClick={() => isLastStep ? handleComplete() : setCurrentStep(prev => prev + 1)}
              disabled={isCompleting}
              className={`bg-gradient-to-r ${step.color} text-white px-8 py-3 rounded-full font-black flex items-center gap-2`}
            >
              {isLastStep ? 'Let\'s Go!' : 'Next'} <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}