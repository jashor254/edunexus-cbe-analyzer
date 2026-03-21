import Link from 'next/link'
import { ArrowRight, Sparkles, ShieldCheck, Target, GraduationCap, Users } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            <span className="text-xl font-black text-slate-900">EduNexus</span>
          </div>
          <div className="flex gap-4">
            <Link href="/login" className="text-sm font-bold text-slate-600 hover:text-indigo-600">Login</Link>
            <Link href="/signup" className="text-sm font-bold bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-bold mb-6">
          <Sparkles className="w-4 h-4" />
          Powered by Learning Compass
        </div>
        
        <h1 className="text-5xl md:text-6xl font-black text-slate-900 mb-6">
          From Pathway Choice
          <span className="block text-indigo-600 mt-2">To Career Success</span>
        </h1>
        
        <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-10">
          Complete CBE guidance from Grade 7-12. Choose the right pathway, excel academically, 
          and discover your perfect career fit.
        </p>
        
        <Link 
          href="/signup" 
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-indigo-700 hover:scale-105 transition-all shadow-lg"
        >
          Start your analysis
          <ArrowRight className="w-5 h-5" />
        </Link>
        
        <p className="text-sm text-slate-500 mt-6">Introducing individualized Learning</p>
      </section>

      {/* Features Section */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-black text-center mb-12">Why Choose EduNexus?</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
              <Target className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Pathway Guidance</h3>
              <p className="text-slate-600">Explore STEM, Arts, and Social Sciences to find the perfect fit</p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
              <GraduationCap className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Career Matching</h3>
              <p className="text-slate-600">Discover careers that match your strengths and interests</p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
              <Users className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Parent Dashboard</h3>
              <p className="text-slate-600">Track progress and get insights for every child</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex justify-center gap-8 mb-8">
            <ShieldCheck className="w-10 h-10 text-green-600" />
            <Sparkles className="w-10 h-10 text-amber-500" />
          </div>
          <p className="text-slate-500 text-sm">
            © 2026 EduNexus. Made in Kenya 🇰🇪
          </p>
        </div>
      </section>
    </div>
  )
}