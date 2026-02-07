import Link from 'next/link';
import { GraduationCap, TrendingUp, Target, Award, Users, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-4 overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-blue-200 rounded-full shadow-lg">
              <Award className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">Trusted by Kenyan Educators</span>
            </div>
          </div>

          {/* Main heading */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 leading-tight">
              Transform CBC Assessment
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Into Career Success
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              AI-powered insights for teachers and parents. Track competencies, identify gaps, and guide learners toward their ideal pathway.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link 
              href="/signup" 
              className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              href="#features" 
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-900 px-8 py-4 rounded-xl font-bold text-lg border-2 border-slate-200 hover:border-slate-300 transition-all"
            >
              See How It Works
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { icon: <GraduationCap className="w-6 h-6" />, text: "CBC Aligned" },
              { icon: <Users className="w-6 h-6" />, text: "For Teachers & Parents" },
              { icon: <Sparkles className="w-6 h-6" />, text: "AI-Powered Insights" }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2 text-center">
                <div className="p-3 bg-white rounded-xl shadow-md text-blue-600">
                  {item.icon}
                </div>
                <span className="text-sm font-semibold text-slate-700">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
              Everything You Need to Guide Success
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Comprehensive tools for personalized learning and career planning
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Target className="w-8 h-8" />,
                title: "Competency Tracking",
                description: "Track CBC levels (1-4) across all subjects. Know exactly where each learner stands.",
                color: "blue"
              },
              {
                icon: <TrendingUp className="w-8 h-8" />,
                title: "Adaptive Learning Plans",
                description: "AI generates personalized teaching recommendations based on individual gaps and strengths.",
                color: "indigo"
              },
              {
                icon: <GraduationCap className="w-8 h-8" />,
                title: "Career Pathway Guidance",
                description: "Data-driven recommendations for STEM, Arts & Sports, or Social Sciences pathways.",
                color: "purple"
              }
            ].map((feature, i) => (
              <div 
                key={i} 
                className="group p-8 bg-gradient-to-br from-slate-50 to-white rounded-2xl border-2 border-slate-100 hover:border-blue-200 hover:shadow-xl transition-all"
              >
                <div className={`inline-flex p-4 bg-${feature.color}-50 rounded-xl mb-6 group-hover:scale-110 transition-transform`}>
                  <div className={`text-${feature.color}-600`}>
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Teachers Section */}
      <section className="py-24 px-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full mb-6">
                <span className="text-sm font-bold">For Teachers</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
                Stop Teaching Everyone the Same Way
              </h2>
              <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                Know each student's exact competency level. Get AI-powered teaching plans. Generate professional reports parents love.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  "Track up to 3 students per account",
                  "Subject-by-subject gap analysis",
                  "Personalized teaching recommendations",
                  "Professional PDF reports for parents",
                  "24/7 AI tutor support"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                    <span className="text-lg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
              <div className="bg-white rounded-2xl p-8 shadow-2xl">
                <div className="text-slate-900">
                  <div className="text-sm font-bold text-blue-600 mb-2">TEACHER TESTIMONIAL</div>
                  <p className="text-lg italic mb-4">
                    "Before CBC Analyzer, I was guessing what each student needed. Now I know exactly what to teach and when. Parents are amazed by the detailed reports!"
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
                      MK
                    </div>
                    <div>
                      <div className="font-bold">Mary Kamau</div>
                      <div className="text-sm text-slate-600">Grade 7 Teacher, Nairobi</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-slate-600">
              Start your free trial today. Cancel anytime.
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="relative">
              {/* Popular badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg">
                  Most Popular
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-2xl p-10 border-2 border-blue-200">
                <div className="text-center mb-8">
                  <h3 className="text-3xl font-black text-slate-900 mb-2">Guardian Plan</h3>
                  <p className="text-slate-600">Perfect for teachers & parents</p>
                </div>

                {/* Pricing toggle */}
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-5xl font-black text-slate-900">KES 500</span>
                      <span className="text-xl text-slate-600">/month</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">Billed monthly</p>
                  </div>
                  <div className="text-slate-400 font-bold">or</div>
                  <div className="text-center">
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-5xl font-black text-slate-900">KES 5,000</span>
                      <span className="text-xl text-slate-600">/year</span>
                    </div>
                    <p className="text-sm text-green-600 font-semibold mt-2">Save 2 months! 🎉</p>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-4 mb-8">
                  {[
                    "Track 3 students (learners)",
                    "Unlimited assessments & reports",
                    "AI-powered learning plans",
                    "Career pathway guidance",
                    "Professional PDF reports",
                    "24/7 AI tutor chat access",
                    "WhatsApp report sharing",
                    "Progress tracking & analytics"
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
                      <span className="text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <Link 
                  href="/signup"
                  className="block w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-center py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all transform hover:scale-105"
                >
                  Start 7-Day Free Trial
                </Link>
                <p className="text-center text-sm text-slate-500 mt-4">
                  No credit card required • Cancel anytime
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 text-center mb-16">
            Common Questions
          </h2>
          <div className="space-y-6">
            {[
              {
                q: "Who is this for?",
                a: "CBC Analyzer is designed for teachers and parents of Grade 7-12 learners. Teachers can track multiple students and generate reports. Parents can monitor their child's progress and access AI tutoring."
              },
              {
                q: "How does the AI work?",
                a: "Our AI analyzes CBC competency levels (1-4) across all subjects, identifies patterns, and generates personalized learning plans. It recommends which pathway (STEM, Arts, or Social Sciences) best suits each learner."
              },
              {
                q: "Can I try before paying?",
                a: "Yes! We offer a 7-day free trial. No credit card required. Cancel anytime during the trial period."
              },
              {
                q: "What's included in the reports?",
                a: "Reports include: subject-by-subject performance, competency level analysis, personalized teaching recommendations, career pathway guidance, and AI-powered future projections."
              },
              {
                q: "Do you offer school packages?",
                a: "Yes! Contact us for custom pricing for schools wanting to track 15+ students or entire classes."
              }
            ].map((faq, i) => (
              <details key={i} className="group bg-slate-50 rounded-xl p-6 cursor-pointer hover:bg-slate-100 transition-all">
                <summary className="flex items-center justify-between font-bold text-lg text-slate-900 list-none">
                  {faq.q}
                  <span className="text-2xl group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-4 text-slate-600 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
            Ready to Transform Learning?
          </h2>
          <p className="text-xl text-blue-200 mb-10 max-w-2xl mx-auto">
            Join hundreds of Kenyan teachers using AI to personalize education and guide students toward successful careers.
          </p>
          <Link 
            href="/signup"
            className="inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 px-10 py-5 rounded-xl font-bold text-xl shadow-2xl transition-all transform hover:scale-105"
          >
            Start Your Free Trial
            <ArrowRight className="w-6 h-6" />
          </Link>
          <p className="mt-6 text-blue-200">
            7 days free • No credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-black text-white">CBC Analyzer</span>
              </div>
              <p className="text-slate-400 leading-relaxed mb-4">
                Transforming CBC assessment into career success through AI-powered insights for Kenyan educators and parents.
              </p>
              <div className="text-sm text-slate-500">
                © 2026 CBC Analyzer. All rights reserved.
              </div>
            </div>

            {/* Product */}
            <div>
              <h3 className="font-bold text-white mb-4">Product</h3>
              <ul className="space-y-2">
                <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Login</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="font-bold text-white mb-4">Support</h3>
              <ul className="space-y-2">
                <li><a href="mailto:support@cbcanalyzer.com" className="hover:text-white transition-colors">Email Us</a></li>
                <li><a href="https://wa.me/254700000000" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">WhatsApp</a></li>
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 text-center text-sm text-slate-500">
                                  • Built on CBE standards
          </div>
        </div>
      </footer>
    </div>
  );
}