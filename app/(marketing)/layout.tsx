'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, X, Users, Clock } from 'lucide-react'

// ─── Shared Nav ────────────────────────────────────────────────────────────────
function MarketingNav() {
  return (
    <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 animate-in fade-in slide-in-from-left duration-700">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">EduNexus</span>
        </Link>

        {/* Links */}
        <div className="hidden md:flex gap-8 animate-in fade-in duration-700" style={{ animationDelay: '100ms' }}>
          <a href="/#features"      className="text-sm font-bold text-white/60 hover:text-purple-400 transition-colors">Features</a>
          <a href="/#pricing"       className="text-sm font-bold text-white/60 hover:text-purple-400 transition-colors">Pricing</a>
          <a href="/#testimonials"  className="text-sm font-bold text-white/60 hover:text-purple-400 transition-colors">Testimonials</a>
        </div>

        {/* CTA */}
        <div className="flex gap-3 animate-in fade-in slide-in-from-right duration-700" style={{ animationDelay: '200ms' }}>
          <Link
            href="/login"
            className="text-sm font-bold text-white/60 hover:text-white px-4 py-2 transition-colors"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-xl hover:scale-105 transition-all shadow-lg shadow-purple-500/20 font-bold"
          >
            Start Free
          </Link>
        </div>
      </div>
    </nav>
  )
}

// ─── Shared Footer ─────────────────────────────────────────────────────────────
function MarketingFooter() {
  return (
    <footer className="border-t border-white/5 bg-slate-950/50 backdrop-blur-xl py-12 mt-20">
      <div className="max-w-7xl mx-auto px-6 text-center">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-black text-white/60">EduNexus</span>
        </Link>

        {/* Legal links */}
        <div className="flex justify-center gap-8 mb-6">
          <Link href="/legal/privacy" className="text-sm text-white/40 hover:text-white transition-colors font-bold">Privacy</Link>
          <Link href="/legal/terms"   className="text-sm text-white/40 hover:text-white transition-colors font-bold">Terms</Link>
          <Link href="/legal/refund"  className="text-sm text-white/40 hover:text-white transition-colors font-bold">Refund</Link>
        </div>

        {/* Social hint */}
        <div className="flex justify-center gap-6 mb-6">
          <a
            href="https://tiktok.com/@edunexuscbe"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/30 hover:text-white/60 transition-colors font-bold"
          >
            TikTok
          </a>
          <a
            href="https://facebook.com/edunexuskenya"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/30 hover:text-white/60 transition-colors font-bold"
          >
            Facebook
          </a>
          <a
            href="https://wa.me/254710798030"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/30 hover:text-white/60 transition-colors font-bold"
          >
            WhatsApp
          </a>
        </div>

        <p className="text-sm text-white/40">© 2026 EduNexus. Made in Kenya 🇰🇪</p>
      </div>
    </footer>
  )
}

// ─── Coming Soon Modal (shared across marketing pages) ─────────────────────────
export function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="relative max-w-md w-full">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl blur opacity-30" />
        <div className="relative bg-slate-900 border border-white/10 rounded-3xl p-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-2xl font-black text-center text-white mb-3">Study Groups Coming Soon! 🎉</h3>
          <p className="text-white/70 text-center mb-6 leading-relaxed">
            We're building something special. Join forces with other students, share notes, compete in challenges, and climb leaderboards together.
          </p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 text-amber-300 mb-2">
              <Clock className="w-5 h-5" />
              <span className="font-bold">Keep checking back!</span>
            </div>
            <p className="text-sm text-amber-200/70">
              Study Groups launching soon. Be among the first to collaborate and compete!
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-2xl font-black hover:scale-105 transition-all"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Layout ────────────────────────────────────────────────────────────────────
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Ambient gradient orbs — shared atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/2 -left-1/2 w-[1000px] h-[1000px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse"
          style={{ animationDuration: '8s' }}
        />
        <div
          className="absolute -bottom-1/2 -right-1/2 w-[1000px] h-[1000px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"
          style={{ animationDuration: '10s', animationDelay: '2s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-amber-600/5 rounded-full blur-[100px] animate-pulse"
          style={{ animationDuration: '12s', animationDelay: '4s' }}
        />
      </div>

      {/* Grain texture */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")'
        }}
      />

      {/* Nav */}
      <MarketingNav />

      {/* Page content */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Footer */}
      <MarketingFooter />
    </div>
  )
}