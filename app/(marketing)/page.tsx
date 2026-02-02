import Link from 'next/link';
import { Sparkles, TrendingUp, Target, ShieldCheck, Zap, Globe, BarChart3 } from 'lucide-react';

export default function LandingPage() {
  return (
    <>
      {/* Hero Section: The "World Class" Entry */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-slate-50 via-white to-white overflow-hidden">
        <div className="max-w-6xl mx-auto text-center relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-100/40 blur-3xl rounded-full -z-10" />
          
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold tracking-widest uppercase animate-fade-in">
            <Globe className="w-3 h-3 text-blue-400" /> Global Standards. Kenyan Curriculum.
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-6 leading-tight tracking-tight">
            Stop Guessing. <br />
            <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-500 bg-clip-text text-transparent">
              Engineer Their Future.
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Grade 9 is the ultimate crossroad. Harness the power of Elite AI to map your child's competency levels to high-growth pathways in STEM, Arts, or Social Sciences.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center mb-16">
            <Link 
              href="/signup" 
              className="w-full sm:w-auto bg-slate-900 hover:bg-blue-700 text-white px-12 py-5 rounded-2xl font-bold text-xl transition-all transform hover:scale-105 shadow-2xl"
            >
              Get Started Now 🚀
            </Link>
            <Link 
              href="#how-it-works" 
              className="w-full sm:w-auto border-2 border-slate-200 hover:border-slate-900 text-slate-900 px-12 py-5 rounded-2xl font-bold text-xl transition-all"
            >
              Explore the Engine
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto text-sm font-semibold text-slate-500 border-t border-slate-100 pt-10">
            <div className="flex items-center justify-center gap-2">
              <Zap className="text-amber-500 w-5 h-5" /> Instant CBE Alignment
            </div>
            <div className="flex items-center justify-center gap-2">
              <BarChart3 className="text-blue-500 w-5 h-5" /> 2045 Career Projections
            </div>
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck className="text-emerald-500 w-5 h-5" /> Military-Grade Privacy
            </div>
          </div>
        </div>
      </section>

      {/* Features Section: Why EduNexus? */}
      <section id="how-it-works" className="py-24 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Precision Guidance for 21st Century Success</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">We bridge the gap between classroom performance and global market demands.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { icon: <Sparkles className="text-blue-400" />, title: "Predictive Analytics", desc: "Our AI analyzes multi-subject competencies to forecast professional aptitude with scientific accuracy." },
              { icon: <TrendingUp className="text-indigo-400" />, title: "Economic ROI", desc: "We don't just find careers; we calculate the lifetime return on your educational investment." },
              { icon: <Target className="text-emerald-400" />, title: "Pathway Precision", desc: "Eliminate the confusion of STEM vs. Arts with data-driven clarity tailored for Grade 9 decisions." }
            ].map((feature, i) => (
              <div key={i} className="group p-8 rounded-3xl bg-slate-800/50 border border-slate-700 hover:border-blue-500 transition-all">
                <div className="w-14 h-14 bg-slate-700 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section: Premium Value */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-16">Invest in Their Legacy</h2>
          <div className="max-w-lg mx-auto bg-slate-900 text-white rounded-[2.5rem] p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
               <span className="bg-blue-600 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full">Official Selection</span>
            </div>
            
            <h3 className="text-3xl font-bold mt-4">The Guardian Plan</h3>
            <p className="text-slate-400 mt-2">Comprehensive Support for Growing Families</p>
            
            <div className="my-10">
              <span className="text-6xl font-black">KES 500</span>
              <span className="text-slate-400 text-lg"> /month</span>
            </div>

            <div className="space-y-5 mb-12 text-left">
              {[
                "Full Assessment for 3 Students",
                "Infinite Growth Trajectory Tracking",
                "Advanced AI Pathway Analysis",
                "Verified Professional PDF Reports",
                "24/7 Guardian AI Tutor Access"
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <ShieldCheck className="text-blue-400 w-4 h-4" />
                  </div>
                  <span className="text-slate-200 font-medium">{item}</span>
                </div>
              ))}
            </div>

            <Link href="/signup" className="block w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-xl shadow-lg transition-all hover:shadow-blue-500/40">
              Secure This Plan
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}