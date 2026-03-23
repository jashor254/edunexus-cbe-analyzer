'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Compass,
  Users,
  Star,
  CheckCircle2,
  Brain,
  BarChart3,
  MessageCircle,
  Clock,
  TrendingUp,
  Award,
  Target
} from 'lucide-react'
import { ComingSoonModal } from './layout'

export default function LandingPage() {
  const [showComingSoon, setShowComingSoon] = useState(false)

  return (
    <>
      {/* Coming Soon Modal */}
      {showComingSoon && <ComingSoonModal onClose={() => setShowComingSoon(false)} />}

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-20 md:py-32">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 text-purple-300 px-4 py-2 rounded-full text-sm font-black mb-6 animate-in fade-in slide-in-from-top duration-700">
            <Brain className="w-4 h-4" />
            ADAPTIVE LEARNING • PERSONALIZED FOR YOUR CHILD
          </div>

          <h1
            className="text-5xl md:text-8xl font-black mb-6 leading-[0.95] animate-in fade-in slide-in-from-bottom duration-1000"
            style={{ animationDelay: '100ms' }}
          >
            <span className="block text-white/90">Learning That</span>
            <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent mt-2">
              Adapts to Your Child
            </span>
          </h1>

          <p
            className="text-xl md:text-2xl text-white/60 max-w-3xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom duration-1000"
            style={{ animationDelay: '200ms' }}
          >
            Your child isn't slow — they're just being taught like everyone else.{' '}
            <strong className="text-white/90">Individualized Learning Plans</strong>{' '}
            that evolve with their unique pace, strengths, and struggles. CBC Grades 7-12.
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-in fade-in slide-in-from-bottom duration-1000"
            style={{ animationDelay: '300ms' }}
          >
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-purple-500/30"
            >
              Start Free Analysis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 bg-white/5 backdrop-blur-sm border-2 border-white/10 text-white px-8 py-5 rounded-2xl font-black hover:bg-white/10 hover:border-white/20 transition-all"
            >
              View Pricing
            </Link>
          </div>

          {/* Trust badges */}
          <div
            className="flex flex-wrap justify-center gap-8 text-sm text-white/40 animate-in fade-in duration-1000"
            style={{ animationDelay: '400ms' }}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" /> 1 free analysis to start
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" /> 500+ Kenyan parents
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" /> CBC Certified
            </span>
          </div>
        </div>
      </section>

      {/* Why Adaptive Learning Works */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black mb-4 text-white">Why Adaptive Learning Works</h2>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Every child learns differently. We meet them exactly where they are.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Brain,
              title: 'Learns Their Pace',
              description: 'Too fast? Bored. Too slow? Lost. We adapt in real-time to their exact learning speed.',
              gradient: 'from-purple-500 to-pink-500'
            },
            {
              icon: Target,
              title: 'Spots Weak Points',
              description: 'Identifies gaps before they become permanent. Your child gets help exactly where needed.',
              gradient: 'from-blue-500 to-cyan-500'
            },
            {
              icon: TrendingUp,
              title: 'Builds Confidence',
              description: "Progress matched to ability. No more \"I'm just bad at math.\" They see themselves improving.",
              gradient: 'from-green-500 to-emerald-500'
            }
          ].map((benefit, idx) => (
            <div key={idx} className="group relative">
              <div className={`absolute -inset-0.5 bg-gradient-to-r ${benefit.gradient} rounded-3xl blur opacity-20 group-hover:opacity-40 transition`} />
              <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all h-full">
                <div className={`w-14 h-14 bg-gradient-to-br ${benefit.gradient} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-xl`}>
                  <benefit.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-black mb-3 text-white">{benefit.title}</h3>
                <p className="text-white/70 leading-relaxed">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4 text-white">Three Powerful Tools</h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">Working together for your child's success</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                title: 'Academic Clinic',
                description: 'Deep performance analysis. See exactly where your child struggles—with clear action steps.',
                gradient: 'from-purple-500 to-pink-500',
                delay: '0ms',
                link: '#clinic',
                clickable: false
              },
              {
                icon: Compass,
                title: 'Learning Compass',
                description: "24/7 personal tutor that adapts to your child's pace. Kenyan context, Swahili encouragement.",
                gradient: 'from-amber-500 to-orange-500',
                delay: '100ms',
                link: '#compass',
                clickable: false
              },
              {
                icon: Users,
                title: 'Study Groups',
                description: 'Collaborate with peers, share notes, compete in challenges. (Coming Soon!)',
                gradient: 'from-blue-500 to-cyan-500',
                delay: '200ms',
                link: '',
                clickable: true
              }
            ].map((feature, idx) =>
              feature.clickable ? (
                <button
                  key={idx}
                  onClick={() => setShowComingSoon(true)}
                  className="group relative text-left animate-in fade-in slide-in-from-bottom duration-700 w-full"
                  style={{ animationDelay: feature.delay }}
                >
                  <div className={`absolute -inset-0.5 bg-gradient-to-r ${feature.gradient} rounded-3xl blur opacity-20 group-hover:opacity-40 transition`} />
                  <div className="relative bg-white/5 backdrop-blur-xl border-2 border-dashed border-white/20 rounded-3xl p-8 hover:bg-white/10 hover:border-white/30 transition-all h-full">
                    <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-xl`}>
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-black mb-3 text-white">{feature.title}</h3>
                    <p className="text-white/70 leading-relaxed mb-4">{feature.description}</p>
                    <div className="inline-flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20 font-bold">
                      <Clock className="w-3 h-3" /> Coming soon - keep checking!
                    </div>
                  </div>
                </button>
              ) : (
                <a
                  key={idx}
                  href={feature.link}
                  className="group relative block animate-in fade-in slide-in-from-bottom duration-700"
                  style={{ animationDelay: feature.delay }}
                >
                  <div className={`absolute -inset-0.5 bg-gradient-to-r ${feature.gradient} rounded-3xl blur opacity-20 group-hover:opacity-40 transition`} />
                  <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all h-full">
                    <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-xl`}>
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-black mb-3 text-white">{feature.title}</h3>
                    <p className="text-white/70 leading-relaxed">{feature.description}</p>
                  </div>
                </a>
              )
            )}
          </div>
        </div>
      </section>

      {/* Academic Clinic */}
      <section id="clinic" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-purple-500/10 backdrop-blur-sm border border-purple-500/20 text-purple-300 px-4 py-2 rounded-full text-sm font-black mb-6">
                <BarChart3 className="w-4 h-4" /> DETAILED INSIGHTS
              </div>
              <h2 className="text-4xl md:text-5xl font-black mb-6">
                <span className="block text-white">Academic Clinic</span>
                <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Deep Performance Analysis
                </span>
              </h2>
              <p className="text-xl text-white/70 mb-8 leading-relaxed">
                Stop guessing. Get a complete diagnostic report showing exactly where your child excels and struggles—with a personalized action plan.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  'Subject-by-subject breakdown',
                  'Identifies hidden learning gaps',
                  'Personalized action steps',
                  'Progress tracking over time',
                  'Beautiful PDF reports'
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <span className="text-white/80">{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-lg shadow-purple-500/20"
              >
                Get Your Free Analysis <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl blur-xl opacity-30" />
              <div className="relative bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-8 min-h-[500px] flex items-center justify-center">
                <div className="text-center">
                  <Award className="w-24 h-24 text-purple-400 mx-auto mb-6 opacity-50" />
                  <p className="text-white/50 font-bold text-lg">Academic Clinic Report Preview</p>
                  <p className="text-white/30 text-sm mt-2">Beautiful PDF with full analysis</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Learning Compass */}
      <section id="compass" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Chat preview */}
            <div className="relative order-2 md:order-1">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl blur-xl opacity-30" />
              <div className="relative bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-xl border border-amber-500/20 rounded-3xl p-8">
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/10">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-white">Learning Compass</div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-xs text-green-300 font-bold">Adapting to your child</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-sm text-white">
                      Help me with fractions please
                    </div>
                    <div className="bg-gradient-to-r from-amber-500/30 to-orange-500/30 backdrop-blur-sm border border-amber-400/30 rounded-xl p-3 text-sm text-white ml-6">
                      Sawa! Let's start slow. Imagine a chapati cut into 4 equal pieces...
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-sm text-white">
                      Ooh! So 3/4 means 3 pieces? 🎉
                    </div>
                    <div className="bg-gradient-to-r from-amber-500/30 to-orange-500/30 backdrop-blur-sm border border-amber-400/30 rounded-xl p-3 text-sm text-white ml-6">
                      Exactly! You got it. Ready to try a problem?
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 text-amber-300 px-4 py-2 rounded-full text-sm font-black mb-6">
                <Compass className="w-4 h-4" /> 24/7 ADAPTIVE TUTOR
              </div>
              <h2 className="text-4xl md:text-5xl font-black mb-6">
                <span className="block text-white">Learning Compass</span>
                <span className="block bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Adapts to Their Pace
                </span>
              </h2>
              <p className="text-xl text-white/70 mb-8 leading-relaxed">
                Not generic AI tutoring. Learning Compass knows where your child is strong, where they struggle, and adjusts explanations in real-time.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition" />
                  <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-center">
                    <div className="text-3xl font-black text-amber-400 mb-1">24/7</div>
                    <div className="text-xs text-white/60 uppercase tracking-wider font-bold">Always Available</div>
                  </div>
                </div>
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition" />
                  <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-center">
                    <div className="text-3xl font-black text-green-400 mb-1">CBC</div>
                    <div className="text-xs text-white/60 uppercase tracking-wider font-bold">Kenyan Curriculum</div>
                  </div>
                </div>
              </div>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-8 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-lg shadow-amber-500/20"
              >
                Try Learning Compass <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser — links to central pricing page */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4 text-white">Simple, Honest Pricing</h2>
            <p className="text-xl text-white/60">Start free. Upgrade when you're ready.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
            {[
              { name: 'Try It', price: 'KES 500', billing: 'one-time', desc: '15 tokens — perfect for a first look', color: 'from-blue-500 to-cyan-500', border: 'border-white/10' },
              { name: 'Term Plan', price: 'KES 3,200', billing: 'per term', desc: 'Unlimited everything for 1 student', color: 'from-purple-500 to-pink-500', border: 'border-purple-500/40', badge: '⭐ Most Popular' },
              { name: 'Premium', price: 'KES 7,000', billing: 'per term', desc: 'Up to 3 students + priority support', color: 'from-amber-500 to-orange-500', border: 'border-white/10' },
            ].map((plan, idx) => (
              <div key={idx} className="group relative">
                <div className={`absolute -inset-0.5 bg-gradient-to-r ${plan.color} rounded-3xl blur opacity-20 group-hover:opacity-40 transition`} />
                <div className={`relative bg-white/5 backdrop-blur-xl border-2 ${plan.border} rounded-3xl p-8 hover:bg-white/10 transition-all text-center h-full flex flex-col`}>
                  {plan.badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r ${plan.color} text-white px-4 py-1 rounded-full text-xs font-black`}>
                      {plan.badge}
                    </div>
                  )}
                  <h3 className="text-xl font-black text-white mb-2">{plan.name}</h3>
                  <div className={`text-4xl font-black bg-gradient-to-r ${plan.color} bg-clip-text text-transparent mb-1`}>{plan.price}</div>
                  <p className="text-xs text-white/40 mb-4">{plan.billing}</p>
                  <p className="text-sm text-white/60 flex-1">{plan.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-10 py-4 rounded-2xl font-black hover:scale-105 transition-all shadow-lg shadow-purple-500/20"
            >
              See Full Pricing <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-sm text-white/30 mt-4">1 free analysis on signup. No credit card needed.</p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4 text-white">Trusted by Kenyan Parents</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: "The adaptive learning is real. My son finally understands fractions!", author: 'Grace M.', location: 'Nairobi' },
              { quote: "Academic Clinic showed us exactly where she was struggling. Game changer.", author: 'Peter O.', location: 'Kisumu' },
              { quote: "Learning Compass explains things in ways teachers can't. Worth every shilling.", author: 'Achieng K.', location: 'Mombasa' }
            ].map((t, idx) => (
              <div key={idx} className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl blur opacity-10 group-hover:opacity-20 transition" />
                <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />)}
                  </div>
                  <p className="text-white/80 mb-6 leading-relaxed italic">"{t.quote}"</p>
                  <div className="border-t border-white/10 pt-4">
                    <div className="font-black text-white">{t.author}</div>
                    <div className="text-sm text-white/60">{t.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-20 px-6">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-3xl blur-2xl opacity-20" />
        <div className="relative max-w-4xl mx-auto text-center bg-gradient-to-br from-purple-900/40 via-pink-900/40 to-blue-900/40 backdrop-blur-xl border border-white/10 rounded-3xl py-20 px-6">
          <h2 className="text-4xl md:text-5xl font-black mb-6 text-white">Ready to See Your Child Excel?</h2>
          <p className="text-xl text-white/70 mb-10">Start with 1 free analysis. See exactly where they need help.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-white text-slate-950 px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-2xl shadow-white/20"
          >
            Start Free Analysis <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </>
  )
}