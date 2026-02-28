import Link from 'next/link'
import { ArrowRight, CheckCircle, Star, Shield, Compass, Target, GraduationCap, MessageCircle, BookOpen } from 'lucide-react'
import { Assessment } from '../../lib/supabase';
import { LearningArea } from '../../lib/cbcCurriculum';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      
      <section className="relative pt-32 pb-20 px-6 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm font-bold mb-8">
            <Compass className="w-4 h-4 text-yellow-400" />
            <span>Powered by Learning Compass</span>
          </div>

          <h1 className="text-5xl lg:text-7xl font-black mb-6">
            From Pathway Choice
            <span className="block text-yellow-400 mt-2">To Career Success</span>
          </h1>

          <p className="text-xl text-blue-100 mb-12 max-w-3xl mx-auto">
            Complete CBE guidance from Grade 7-12. Choose the right pathway, excel academically, and discover your perfect career fit.
          </p>

          <Link href="/signup" className="inline-flex items-center gap-3 bg-yellow-400 text-slate-900 px-10 py-6 rounded-2xl font-black text-xl hover:scale-105 transition">
            Start your analysis
            <ArrowRight className="w-6 h-6" />
          </Link>

          <p className="text-blue-200 text-sm mt-8">
            Introducing individualized Learning
          </p>
        </div>
      </section>

      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center mb-16">
            <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-bold mb-4 inline-block">
              COMPLETE CBE JOURNEY
            </span>
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-4">
              We Support Both Stages
            </h2>
            <p className="text-xl text-slate-600">
              Different challenges at each stage. One platform guides your child all the way.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            
            <div className="bg-white rounded-3xl p-8 border-2 border-blue-200 shadow-xl">
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold mb-6">
                <Target className="w-4 h-4" />
                Grade 7-9
              </div>
              
              <h3 className="text-3xl font-black text-slate-900 mb-4">
                Junior School: Choose Right
              </h3>
              
              <p className="text-lg text-slate-600 mb-6">
                The pathway decision shapes 6 years. We help your child explore all three pathways deeply and choose confidently before KJSEA.
              </p>

              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <div className="font-bold text-slate-900">Pathway Exploration</div>
                    <div className="text-sm text-slate-600">Explore STEM, Arts, Social Sciences</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <div className="font-bold text-slate-900">KJSEA and KBEA Preparation and beyond</div>
                    <div className="text-sm text-slate-600">Track performance early</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <div className="font-bold text-slate-900">24/7 Learning Support</div>
                    <div className="text-sm text-slate-600">individualized learning system, Assessment prep</div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-sm text-blue-800 font-semibold">
                  Goal: Enter Senior School knowing exactly which pathway fits best.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 border-2 border-purple-200 shadow-xl">
              <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-bold mb-6">
                <GraduationCap className="w-4 h-4" />
                Grade 10-12
              </div>
              
              <h3 className="text-3xl font-black text-slate-900 mb-4">
                Senior School: Excel & Prepare
              </h3>
              
              <p className="text-lg text-slate-600 mb-6">
                Pathway chosen. Now focus on excelling within it and discovering the perfect career fit for university.
              </p>

              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-purple-600 mt-1" />
                  <div>
                    <div className="font-bold text-slate-900">Pathway Mastery</div>
                    <div className="text-sm text-slate-600">Excel in chosen track</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-purple-600 mt-1" />
                  <div>
                    <div className="font-bold text-slate-900">Career Discovery</div>
                    <div className="text-sm text-slate-600">Best-fit careers</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-purple-600 mt-1" />
                  <div>
                    <div className="font-bold text-slate-900">University Readiness</div>
                    <div className="text-sm text-slate-600">Course recommendations</div>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <p className="text-sm text-purple-800 font-semibold">
                  Goal:Helps the leaner prepare for expected change of careers in the AI era.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-bold">
                <Compass className="w-4 h-4" />
                The Core Engine
              </div>
              
              <h3 className="text-3xl lg:text-4xl font-black text-slate-900">
                Learning Compass
                <span className="block text-yellow-600 mt-2">Your 24/7 Academic Partner</span>
              </h3>
              
              <p className="text-lg text-slate-600">
                <strong>Why pay for expensive private tutors?</strong> Your child already has regular teachers at school. Learning Compass fills the gaps with 24/7  self pace study help.
              </p>
              
              <div className="bg-yellow-50 rounded-xl p-6 border-2 border-yellow-200">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-2xl font-black text-yellow-700">5 sec</div>
                    <div className="text-xs text-yellow-800 font-semibold">Response</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-yellow-700">24/7</div>
                    <div className="text-xs text-yellow-800 font-semibold">Available</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-yellow-700">All CBE</div>
                    <div className="text-xs text-yellow-800 font-semibold">Subjects</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-yellow-700">🇰🇪</div>
                    <div className="text-xs text-yellow-800 font-semibold">Kenyan</div>
                  </div>
                </div>
                <p className="text-sm text-yellow-800 font-semibold">
                  Uses Kenyan examples. Swahili encouragement.
                </p>
              </div>

              <div className="bg-red-50 rounded-xl p-6 border-l-4 border-red-500">
                <p className="text-sm text-red-800">
                  <strong className="block mb-2">Smart Calculation:</strong>
                  Private tutor: KES 60,000/year<br/>
                  School teachers: Already covered<br/>
                  Learning Compass: KES 4,500/year<br/>
                  <span className="block mt-2 font-bold text-lg">Save KES 55,500!</span>
                </p>
              </div>
            </div>

            <div className="bg-yellow-100 rounded-3xl p-8">
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-yellow-900" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Learning Compass</div>
                    <div className="text-xs text-green-600 font-bold">Available Now</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-sm">
                    Help me with fractions
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-sm">
                    Sawa! Imagine chapati...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 mb-4">
              Complete Support System
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">Pathway Guidance</h3>
              <p className="text-slate-600">
                Analyze all areas. Explore pathways. Choose confidently.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <GraduationCap className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">Career Recommendations</h3>
              <p className="text-slate-600">
                Best-fit careers. University course guidance.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">Academic Clinic</h3>
              <p className="text-slate-600">
                Spot weak subjects early. Track progress weekly.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 mb-4">
              Trusted by Kenyan Parents
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-50 rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-700 mb-6">Pathway analysis showed our son is STEM. Now confident.</p>
              <div className="font-bold text-slate-900">Grace M.</div>
              <div className="text-sm text-slate-500">Nairobi</div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-700 mb-6">Career recommendations opened daughter eyes. She knows engineering field.</p>
              <div className="font-bold text-slate-900">Peter O.</div>
              <div className="text-sm text-slate-500">Kisumu</div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-slate-700 mb-6">Academic Clinic caught English struggle early. Back on track by Week 8.</p>
              <div className="font-bold text-slate-900">Achieng K.</div>
              <div className="text-sm text-slate-500">Mombasa</div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-4">
              Choose Your Plan
            </h2>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            
            <div className="bg-white rounded-2xl p-8 border-2 border-slate-200">
              <h3 className="text-2xl font-black text-slate-900 mb-2">Try First</h3>
              <div className="mb-6">
                <span className="text-4xl font-black">KES 0</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>1 analysis</span>
                </li>
              </ul>
              <Link href="/signup" className="block w-full text-center bg-slate-100 text-slate-700 py-3 rounded-xl font-bold">
                Try Free
              </Link>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-blue-200">
              <h3 className="text-2xl font-black text-slate-900 mb-2">Test More</h3>
              <div className="mb-6">
                <span className="text-4xl font-black">KES 100</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                  <span>10 tokens</span>
                </li>
              </ul>
              <Link href="/signup?plan=token" className="block w-full text-center bg-blue-600 text-white py-3 rounded-xl font-bold">
                Buy Tokens
              </Link>
            </div>

            <div className="bg-white rounded-2xl p-8 border-2 border-green-200">
              <h3 className="text-2xl font-black text-slate-900 mb-2">1 Child</h3>
              <div className="mb-6">
                <span className="text-4xl font-black">KES 1,500</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Unlimited</span>
                </li>
              </ul>
              <Link href="/signup?plan=single" className="block w-full text-center bg-green-600 text-white py-3 rounded-xl font-bold">
                Get Started
              </Link>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-xs font-black">
                BEST VALUE
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Family</h3>
              <div className="mb-6">
                <span className="text-4xl font-black text-white">KES 2,500</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm text-white">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-yellow-400" />
                  <span>2-3 children</span>
                </li>
              </ul>
              <Link href="/signup?plan=family" className="block w-full text-center bg-yellow-400 text-slate-900 py-3 rounded-xl font-black">
                Get Family
              </Link>
            </div>
          </div>

          <div className="mt-12 max-w-3xl mx-auto bg-green-50 rounded-2xl p-8 border-2 border-green-200 flex items-start gap-6">
            <Shield className="w-12 h-12 text-green-600" />
            <div>
              <h4 className="text-xl font-black text-green-900 mb-2">30-Day Money-Back</h4>
              <p className="text-green-800">Not satisfied? Full refund within 30 days.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl lg:text-6xl font-black mb-6">
            Ready to Get Started?
          </h2>
          <Link href="/signup" className="inline-flex items-center gap-3 bg-yellow-400 text-slate-900 px-10 py-6 rounded-2xl font-black text-xl hover:scale-105 transition">
            Start Free Analysis
            <ArrowRight className="w-6 h-6" />
          </Link>
        </div>
      </section>

      <footer className="bg-slate-950 text-slate-400 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <h3 className="text-white font-black text-2xl mb-4">EduNexus</h3>
              <p className="text-slate-400 mb-4">Complete CBC guidance from Junior to Senior School.</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#pricing">Pricing</a></li>
                <li><Link href="/signup">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/legal/privacy">Privacy</Link></li>
                <li><Link href="/legal/terms">Terms</Link></li>
                <li><Link href="/legal/refund">Refund</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 text-center text-sm">
            <p>© 2026 EduNexus. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}