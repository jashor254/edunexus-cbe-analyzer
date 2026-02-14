"use client";

import Link from "next/link";
import { GraduationCap, TrendingUp, Target, Award, Users, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* HERO */}
      <section className="relative pt-28 pb-32 px-4 overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>

        <div className="max-w-6xl mx-auto relative z-10 text-center">
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-blue-200 rounded-full shadow-lg">
              <Award className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">Trusted by Kenyan Educators</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 leading-tight">
            Transform CBC Assessment
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Into Career Success
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-12">
            AI-powered insights for teachers and parents. Track competencies, identify gaps, and guide learners toward their ideal pathway.
          </p>

          {/* CTA */}
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
              { icon: <Sparkles className="w-6 h-6" />, text: "AI-Powered Insights" },
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

      {/* FEATURES */}
      <section id="features" className="py-24 px-4 bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">Everything You Need to Guide Success</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-12">Comprehensive tools for personalized learning and career planning</p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Target className="w-8 h-8" />, title: "Competency Tracking", description: "Track CBC levels (1-4) across all subjects. Know exactly where each learner stands.", color: "blue" },
              { icon: <TrendingUp className="w-8 h-8" />, title: "Adaptive Learning Plans", description: "AI generates personalized teaching recommendations based on individual gaps and strengths.", color: "indigo" },
              { icon: <GraduationCap className="w-8 h-8" />, title: "Career Pathway Guidance", description: "Data-driven recommendations for STEM, Arts & Sports, or Social Sciences pathways.", color: "purple" },
            ].map((feature, i) => (
              <div key={i} className={`group p-8 bg-gradient-to-br from-slate-50 to-white rounded-2xl border-2 border-slate-100 hover:border-blue-200 hover:shadow-xl transition-all`}>
                <div className={`inline-flex p-4 bg-${feature.color}-50 rounded-xl mb-6 group-hover:scale-110 transition-transform`}>
                  <div className={`text-${feature.color}-600`}>{feature.icon}</div>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ... continue with Teachers, Pricing, FAQ, CTA as your current landing page ... */}
    </div>
  );
}