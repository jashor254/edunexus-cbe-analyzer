import Link from 'next/link';
import { Sparkles, TrendingUp, Target, ShieldCheck } from 'lucide-react';

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-blue-50 via-white to-white overflow-hidden">
        <div className="max-w-6xl mx-auto text-center relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-200/30 blur-3xl rounded-full -z-10" />
          
          <div className="inline-block mb-6 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-bold animate-fade-in">
            🇰🇪 Built for Kenyan Grade 7-12 Students
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight">
            Usiotea Tena. <br />
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Chagua Pathway Sahihi
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Grade 9 ndio njia panda. Tumia AI kuchambua uwezo wa mwanao na kupata mwelekeo sahihi kati ya STEM, Arts, au Social Sciences kulingana na mtaala wa CBE.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center mb-16">
            <Link 
              href="/signup" 
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-2xl font-bold text-xl transition-all transform hover:scale-105 shadow-xl hover:shadow-blue-200/50"
            >
              Anza Bure Sasa 🚀
            </Link>
            <Link 
              href="#how-it-works" 
              className="w-full sm:w-auto border-2 border-gray-200 hover:border-blue-600 hover:text-blue-600 text-gray-700 px-10 py-5 rounded-2xl font-bold text-xl transition-all"
            >
              Inafanyaje Kazi?
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-3xl mx-auto text-sm font-medium text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck className="text-green-500 w-5 h-5" /> 3 Free AI Analyses
            </div>
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck className="text-green-500 w-5 h-5" /> Cancel Anytime
            </div>
            <div className="hidden md:flex items-center justify-center gap-2 uppercase tracking-wider text-xs">
              Powered by Google Gemini AI
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="how-it-works" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">Kwa Nini EduNexus?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Tumetengeneza mfumo unaoelewa mtaala wa Kenya na changamoto za wazazi wa CBC.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: <Sparkles className="text-blue-600" />, title: "AI Analysis", desc: "Inachambua competency levels 1-4 na kupendekeza careers." },
              { icon: <TrendingUp className="text-purple-600" />, title: "Trend Tracking", desc: "Ona kama mwanafunzi anaimarika au anashuka kimasomo." },
              { icon: <Target className="text-green-600" />, title: "Pathway Score", desc: "Pata uhakika wa 100% wa mchepuo unaomfaa mtoto." },
              { icon: <ShieldCheck className="text-orange-600" />, title: "Secure Data", desc: "Taarifa za mwanao ziko salama na ni siri yako." }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - Unified with your plan */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-extrabold mb-12">Gharama Nafuu Kwa Kila Mzazi</h2>
          <div className="max-w-md mx-auto bg-gradient-to-br from-blue-600 to-purple-700 text-white rounded-3xl p-10 shadow-2xl transform hover:scale-105 transition-all">
            <span className="bg-yellow-400 text-black px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Most Popular</span>
            <h3 className="text-2xl font-bold mt-4">Family Plan</h3>
            <div className="my-6">
              <span className="text-5xl font-bold">KES 500</span>
              <span className="opacity-80">/mwezi</span>
            </div>
            <ul className="text-left space-y-4 mb-10">
              <li className="flex items-center gap-3"><ShieldCheck className="text-yellow-400 w-5 h-5" /> Up to 3 Students</li>
              <li className="flex items-center gap-3"><ShieldCheck className="text-yellow-400 w-5 h-5" /> Unlimited Performance Tracking</li>
              <li className="flex items-center gap-3"><ShieldCheck className="text-yellow-400 w-5 h-5" /> 30 AI Career Analyses</li>
              <li className="flex items-center gap-3"><ShieldCheck className="text-yellow-400 w-5 h-5" /> PDF Progress Reports</li>
            </ul>
            <Link href="/signup" className="block w-full bg-white text-blue-600 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors">
              Anza Sasa
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}