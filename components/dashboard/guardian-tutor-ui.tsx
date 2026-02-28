'use client'

import { MessageCircle, BookOpen, Target, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface GuardianTutorUIProps {
  userName: string
  hasActiveSubscription: boolean
}

export function GuardianTutorUI({ userName, hasActiveSubscription }: GuardianTutorUIProps) {
  return (
    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl p-8 border-2 border-yellow-200">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-8 h-8 text-yellow-900" />
        </div>
        <div className="flex-1">
          <h2 className="text-3xl font-black text-slate-900 mb-2">
            Guardian Tutor
          </h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            Get instant help with homework, exam prep, and understanding difficult topics. Available 24/7.
          </p>
        </div>
      </div>

      {hasActiveSubscription ? (
        <>
          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Link
              href="/chat"
              className="bg-white rounded-xl p-6 border-2 border-yellow-200 hover:border-yellow-400 transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center group-hover:bg-yellow-200 transition-all">
                  <MessageCircle className="w-5 h-5 text-yellow-600" />
                </div>
                <h3 className="font-black text-lg text-slate-900">Ask a Question</h3>
              </div>
              <p className="text-sm text-slate-600 font-medium">
                Get instant help with any subject or topic
              </p>
            </Link>

            <Link
              href="/chat"
              className="bg-white rounded-xl p-6 border-2 border-yellow-200 hover:border-yellow-400 transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center group-hover:bg-yellow-200 transition-all">
                  <BookOpen className="w-5 h-5 text-yellow-600" />
                </div>
                <h3 className="font-black text-lg text-slate-900">Homework Help</h3>
              </div>
              <p className="text-sm text-slate-600 font-medium">
                Step-by-step guidance for assignments
              </p>
            </Link>
          </div>

          {/* Main CTA */}
          <Link
            href="/chat"
            className="block w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 py-4 rounded-xl font-black text-center uppercase tracking-wide transition-all shadow-lg hover:shadow-xl"
          >
            Start Tutoring Session →
          </Link>

          {/* Features */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl mb-1">⚡</div>
              <p className="text-xs font-bold text-slate-600">Instant Answers</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">🎯</div>
              <p className="text-xs font-bold text-slate-600">Personalized</p>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">🌙</div>
              <p className="text-xs font-bold text-slate-600">24/7 Available</p>
            </div>
          </div>
        </>
      ) : (
        // Locked State (for trial users)
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔒</span>
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-2">
            Unlock Guardian Tutor
          </h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto font-medium">
            Get unlimited 24/7 tutoring support for just KES 1,500/term
          </p>
          <Link
            href="/upgrade"
            className="inline-block bg-yellow-400 hover:bg-yellow-500 text-yellow-900 px-8 py-3 rounded-xl font-black uppercase tracking-wide transition-all"
          >
            Upgrade Now
          </Link>
        </div>
      )}
    </div>
  )
}