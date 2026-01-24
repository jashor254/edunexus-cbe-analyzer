import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                CBC Pathway Analyzer
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                href="/login" 
                className="text-gray-700 hover:text-gray-900 font-medium"
              >
                Login
              </Link>
              <Link 
                href="/signup" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
            🇰🇪 Built for Kenyan CBC Students
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Unlock Your Child's <br />
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Perfect Career Path
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            AI-powered career guidance for CBC students. Track performance, discover strengths, 
            and make confident pathway decisions from Grade 7 to Grade 12.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link 
              href="/signup" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Start Free Trial 🚀
            </Link>
            <Link 
              href="#how-it-works" 
              className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-4 rounded-xl font-bold text-lg transition-all"
            >
              See How It Works
            </Link>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span>3 free AI analyses</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-xl">✓</span>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              The CBC Pathway Decision is Critical
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              In Grade 10, your child must choose between STEM, Arts & Sports, or Social Sciences. 
              This decision shapes their university options and career future.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-md border border-red-100">
              <div className="text-4xl mb-4">😰</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Parents Are Confused</h3>
              <p className="text-gray-600">
                "Which pathway is best for my child? What if we choose wrong? 
                How do I know their true strengths?"
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-md border border-orange-100">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Limited Guidance</h3>
              <p className="text-gray-600">
                Most schools provide minimal career counseling. Parents are left 
                to figure it out alone using guesswork.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-md border border-yellow-100">
              <div className="text-4xl mb-4">⏰</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Time is Running Out</h3>
              <p className="text-gray-600">
                Junior school (Grades 7-9) flies by. Without early tracking, 
                you miss critical insights about your child's potential.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution/Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Data-Driven Pathway Guidance
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Track CBC performance, analyze strengths, and get AI-powered career recommendations 
              tailored to your child's unique abilities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-8 rounded-xl border-2 border-blue-200">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">AI Career Analysis</h3>
              <p className="text-gray-700 mb-4">
                Our AI analyzes CBC scores (1-4 competency levels) and recommends the top 5 
                careers perfectly matched to your child's strengths.
              </p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Kenya-specific university recommendations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Industry demand analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Salary expectations and career paths</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-teal-50 p-8 rounded-xl border-2 border-green-200">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Performance Tracking</h3>
              <p className="text-gray-700 mb-4">
                Monitor progress across all subjects term-by-term. See trends, identify gaps, 
                and track improvement velocity.
              </p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Visual dashboards for every subject</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Strengths and weaknesses analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Pathway affinity scoring</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-xl border-2 border-purple-200">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Personalized Learning Plans</h3>
              <p className="text-gray-700 mb-4">
                Get career-integrated learning roadmaps. If your child dreams of being a doctor, 
                we show why Biology matters and how to excel at it.
              </p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Baby steps for struggling subjects</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Advanced challenges for top performers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>3-month milestone roadmaps</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-red-50 p-8 rounded-xl border-2 border-orange-200">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Pathway Confidence</h3>
              <p className="text-gray-700 mb-4">
                Know with certainty which pathway suits your child. Our confidence scoring 
                (High/Medium/Low) removes the guesswork.
              </p>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>STEM, Arts & Sports, Social Sciences scores</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Trend analysis across terms</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Clear, actionable recommendations</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">
              Three simple steps to unlock your child's career potential
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Add Student & Assessments</h3>
              <p className="text-gray-600">
                Create your child's profile and input CBC assessment scores (1-4 competency levels) 
                for each term.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-purple-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Get AI Career Analysis</h3>
              <p className="text-gray-600">
                Our AI analyzes performance patterns and generates personalized career 
                recommendations with university options.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-green-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Follow Learning Roadmap</h3>
              <p className="text-gray-600">
                Receive career-integrated learning plans that show exactly how to improve in 
                each subject to reach career goals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600">
              Start free, upgrade when you need more AI power
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover:shadow-xl transition-shadow">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Free Plan</h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  KES 0<span className="text-lg text-gray-600">/month</span>
                </div>
                <p className="text-gray-600">Perfect to get started</p>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl mt-0.5">✓</span>
                  <span className="text-gray-700">1 student</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl mt-0.5">✓</span>
                  <span className="text-gray-700">Basic performance tracking</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl mt-0.5">✓</span>
                  <span className="text-gray-700">Pathway guidance</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl mt-0.5">✓</span>
                  <span className="text-gray-700">3 AI career analyses/month</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl mt-0.5">✓</span>
                  <span className="text-gray-700">5 learning plans/month</span>
                </li>
              </ul>

              <Link 
                href="/signup" 
                className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-900 text-center px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Start Free
              </Link>
            </div>

            {/* Family Plan - POPULAR */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-2xl p-8 shadow-2xl transform scale-105 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                  MOST POPULAR
                </span>
              </div>

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold mb-2">Family Plan</h3>
                <div className="text-4xl font-bold mb-2">
                  KES 500<span className="text-lg opacity-90">/month</span>
                </div>
                <p className="opacity-90">For serious parents</p>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <span className="text-yellow-300 text-xl mt-0.5">✓</span>
                  <span>Up to 3 students</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-yellow-300 text-xl mt-0.5">✓</span>
                  <span>Everything in Free</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-yellow-300 text-xl mt-0.5">✓</span>
                  <span>30 AI career analyses/month</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-yellow-300 text-xl mt-0.5">✓</span>
                  <span>50 learning plans/month</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-yellow-300 text-xl mt-0.5">✓</span>
                  <span>PDF report exports</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-yellow-300 text-xl mt-0.5">✓</span>
                  <span>Email support</span>
                </li>
              </ul>

              <Link 
                href="/signup" 
                className="block w-full bg-white text-blue-600 text-center px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors"
              >
                Start Family Plan
              </Link>
            </div>

            {/* School Plan */}
            <div className="bg-white border-2 border-purple-200 rounded-2xl p-8 hover:shadow-xl transition-shadow">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">School Plan</h3>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  Custom
                </div>
                <p className="text-gray-600">For educational institutions</p>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <span className="text-purple-500 text-xl mt-0.5">✓</span>
                  <span className="text-gray-700">Unlimited students</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-500 text-xl mt-0.5">✓</span>
                  <span className="text-gray-700">Unlimited AI analyses</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-500 text-xl mt-0.5">✓</span>
                  <span className="text-gray-700">Admin dashboard</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-500 text-xl mt-0.5">✓</span>
                  <span className="text-gray-700">Bulk import/export</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-500 text-xl mt-0.5">✓</span>
                  <span className="text-gray-700">Priority support</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-purple-500 text-xl mt-0.5">✓</span>
                  <span className="text-gray-700">Custom training</span>
                </li>
              </ul>

              <button className="block w-full bg-purple-600 hover:bg-purple-700 text-white text-center px-6 py-3 rounded-lg font-bold transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Give Your Child the Career Clarity They Deserve
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of Kenyan parents making confident pathway decisions with data, not guesswork.
          </p>
          <Link 
            href="/signup" 
            className="inline-block bg-white text-blue-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all transform hover:scale-105 shadow-xl"
          >
            Start Your Free Trial Today 🚀
          </Link>
          <p className="mt-4 text-sm opacity-75">
            No credit card required • 3 free AI analyses • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📚</span>
                <span className="text-xl font-bold text-white">CBC Analyzer</span>
              </div>
              <p className="text-sm">
                AI-powered career guidance for Kenyan CBC students.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">Features</Link></li>
                <li><Link href="#" className="hover:text-white">Pricing</Link></li>
                <li><Link href="#" className="hover:text-white">How It Works</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">About Us</Link></li>
                <li><Link href="#" className="hover:text-white">Contact</Link></li>
                <li><Link href="#" className="hover:text-white">Privacy Policy</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">Help Center</Link></li>
                <li><Link href="#" className="hover:text-white">Documentation</Link></li>
                <li><Link href="#" className="hover:text-white">FAQs</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 CBC Pathway Analyzer. All rights reserved. Made with ❤️ in Kenya 🇰🇪</p>
          </div>
        </div>
      </footer>
    </div>
  )
}