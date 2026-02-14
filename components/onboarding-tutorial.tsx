// components/onboarding-tutorial.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles, Trophy, Rocket } from 'lucide-react'
import confetti from 'canvas-confetti'
import { markOnboardingComplete } from '@/lib/user-actions'

type TutorialStep = {
  title: string
  description: string
  icon: string
  color: string
  tip?: string
  action?: string
}

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
    description: 'Add your child\'s profile to start tracking their competency levels across all learning areas. We analyze their strengths and identify gaps early.',
    icon: '👨‍👩‍👧‍👦',
    color: 'from-green-500 to-teal-600',
    action: 'Click "Add Student" on your dashboard after this tutorial',
    tip: 'Works for boarding school students too - get updates while they\'re away!',
  },
  {
    title: 'Guardian Tutor AI',
    description: 'Chat with our AI tutor trained on CBC curriculum. Get specific advice on how to support your child\'s learning at home - in Kenyan context!',
    icon: '🤖',
    color: 'from-purple-500 to-pink-600',
    tip: 'Ask things like: "How can I help with Grade 7 Math during April holiday?"',
  },
  {
    title: 'Academic Clinic Reports',
    description: 'Get AI-powered career recommendations based on your child\'s competency profile. Know which pathway (STEM, Arts, Social Sciences) fits best.',
    icon: '📊',
    color: 'from-orange-500 to-red-600',
    action: 'Generate your first report after adding assessments',
    tip: 'Includes Kenyan career data, job market outlook, and AI disruption insights!',
  },
  {
    title: 'Ready to Transform Learning!',
    description: 'You\'re all set! Start by adding your child, then input their latest assessment. We\'ll handle the rest - from analysis to actionable recommendations.',
    icon: '🚀',
    color: 'from-indigo-500 to-blue-600',
    action: 'Let\'s go! Your dashboard is waiting.',
  },
]

interface OnboardingTutorialProps {
  userId: string
  userName?: string
}

export function OnboardingTutorial({ userId, userName }: OnboardingTutorialProps) {
  const [show, setShow] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [isCompleting, setIsCompleting] = useState(false)

  useEffect(() => {
    // Check localStorage first (instant feedback)
    const hasSeen = localStorage.getItem('hasSeenTutorial')
    if (!hasSeen) {
      setTimeout(() => setShow(true), 500)
    }
  }, [])

  const handleComplete = async () => {
    setIsCompleting(true)
    
    // Confetti celebration! 🎉
    confetti({
      particleCount: 200,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b']
    })

    // Mark as seen locally (instant)
    localStorage.setItem('hasSeenTutorial', 'true')
    
    // Save to database (background)
    if (userId) {
      try {
        const result = await markOnboardingComplete(userId)
        if (!result.success) {
          console.error('Failed to mark onboarding complete:', result.error)
        }
      } catch (error) {
        console.error('Error marking onboarding complete:', error)
      }
    }

    // Close modal
    setTimeout(() => {
      setShow(false)
      setIsCompleting(false)
    }, 1500)
  }

  const handleSkip = () => {
    localStorage.setItem('hasSeenTutorial', 'true')
    setShow(false)
  }

  if (!show) return null

  const step = tutorialSteps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === tutorialSteps.length - 1
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
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

        {/* Close button */}
        <button 
          onClick={handleSkip} 
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 transition-colors z-10 bg-white/50 hover:bg-white rounded-full p-2"
          aria-label="Skip tutorial"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Content */}
        <div className="p-8 md:p-12">
          {/* Icon with gradient background */}
          <div className={`mx-auto w-28 h-28 rounded-3xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-8 animate-bounce shadow-lg`}>
            <span className="text-6xl filter drop-shadow-lg">{step.icon}</span>
          </div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-black text-center mb-4 tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-lg md:text-xl text-slate-600 text-center mb-6 leading-relaxed max-w-2xl mx-auto">
            {step.description}
          </p>

          {/* Tip box */}
          {step.tip && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg mb-6 max-w-2xl mx-auto">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-900 mb-1">💡 Pro Tip</p>
                  <p className="text-sm text-amber-800">{step.tip}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action prompt */}
          {step.action && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg mb-6 max-w-2xl mx-auto">
              <div className="flex items-start gap-3">
                <Rocket className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-blue-900 mb-1">🎯 Next Step</p>
                  <p className="text-sm text-blue-800">{step.action}</p>
                </div>
              </div>
            </div>
          )}

          {/* Personalization */}
          {isFirstStep && userName && (
            <p className="text-center text-slate-500 text-sm mb-6">
              Welcome aboard, <span className="font-bold text-slate-700">{userName}</span>! Let's get you started. 👋
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="px-8 md:px-12 pb-8 md:pb-12">
          <div className="flex items-center justify-between gap-4">
            
            {/* Previous button */}
            <button
              disabled={isFirstStep}
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="text-slate-400 hover:text-slate-700 font-bold disabled:opacity-0 disabled:pointer-events-none transition-all flex items-center gap-2 px-4 py-2 rounded-full hover:bg-slate-100"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            {/* Step indicators */}
            <div className="flex gap-2">
              {tutorialSteps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === currentStep 
                      ? `bg-gradient-to-r ${step.color} w-8` 
                      : 'bg-slate-200 w-2 hover:bg-slate-300'
                  }`}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Next/Complete button */}
            <button
              onClick={() => isLastStep ? handleComplete() : setCurrentStep(prev => prev + 1)}
              disabled={isCompleting}
              className={`bg-gradient-to-r ${step.color} text-white px-6 md:px-8 py-3 md:py-4 rounded-full font-black uppercase flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isCompleting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="hidden sm:inline">Loading...</span>
                </>
              ) : isLastStep ? (
                <>
                  <Trophy className="w-5 h-5" />
                  <span>Let's Go!</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {/* Skip button */}
          {!isLastStep && (
            <div className="text-center mt-6">
              <button
                onClick={handleSkip}
                className="text-sm text-slate-400 hover:text-slate-600 underline transition-colors"
              >
                Skip tutorial (you can replay it later)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}