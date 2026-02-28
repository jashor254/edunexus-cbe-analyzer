'use client';

import Link from 'next/link';
import { GraduationCap, Menu, X, Mail } from 'lucide-react';
import { useState } from 'react';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* NAVIGATION */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <GraduationCap className="w-7 h-7 text-blue-600" />
              <span className="text-xl font-black text-slate-900 tracking-tight">
                EDUNEXUS
              </span>
              <span className="hidden sm:inline-flex items-center text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                🇰🇪 CBC
              </span>
            </Link>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-8">
              {[
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'Pricing', href: '#pricing' },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-slate-600 hover:text-slate-900 font-semibold transition-colors text-sm"
                >
                  {item.label}
                </a>
              ))}
            </div>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/login"
                className="text-slate-600 hover:text-slate-900 font-bold transition-colors text-sm"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all hover:scale-105 shadow-md"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu Content */}
          {mobileMenuOpen && (
            <div className="md:hidden pt-4 pb-4 border-t border-slate-200 mt-4 space-y-4">
              {[
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'Pricing', href: '#pricing' },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-slate-600 hover:text-slate-900 font-semibold py-2"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-4 flex flex-col gap-3 border-t border-slate-200">
                <Link href="/login" className="text-center border-2 border-slate-200 text-slate-700 py-3 rounded-full font-bold">Login</Link>
                <Link href="/signup" className="text-center bg-blue-600 text-white py-3 rounded-full font-bold shadow-md">Get Started</Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="pt-[72px] flex-1">
        {children}
      </main>

      {/* UPDATED FOOTER */}
      <footer className="bg-slate-900 text-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">

            {/* Brand Section */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-6 h-6 text-blue-400" />
                <span className="text-xl font-black italic tracking-tighter">EDUNEXUS</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Kenya's first CBC pathway intelligence platform. Helping parents
                understand and support their children's journey.
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-400 font-semibold">
                <span>🇰🇪</span>
                <span>Made in Nairobi, for Kenya</span>
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="font-black text-xs uppercase tracking-widest text-blue-400 mb-6">Product</h4>
              <div className="space-y-4 text-sm font-medium">
                <a href="#how-it-works" className="block text-slate-400 hover:text-white transition-colors">How It Works</a>
                <a href="#pricing" className="block text-slate-400 hover:text-white transition-colors">Pricing</a>
                <Link href="/signup" className="block text-slate-400 hover:text-white transition-colors">Get Started</Link>
              </div>
            </div>

            {/* Updated Legal Links - Correct Paths */}
            <div>
              <h4 className="font-black text-xs uppercase tracking-widest text-blue-400 mb-6">Legal</h4>
              <div className="space-y-4 text-sm font-medium">
                <Link href="/legal/privacy" className="block text-slate-400 hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/legal/terms" className="block text-slate-400 hover:text-white transition-colors">Terms of Service</Link>
                <Link href="/legal/refund" className="block text-slate-400 hover:text-white transition-colors">Refund Policy</Link>
                <Link href="/legal" className="block text-blue-400 hover:underline transition-colors italic">Legal Center →</Link>
              </div>
            </div>

            {/* Support Section */}
            <div>
              <h4 className="font-black text-xs uppercase tracking-widest text-blue-400 mb-6">Support</h4>
              <div className="space-y-4 text-sm font-medium text-slate-400">
                <p>Have questions? Reach out:</p>
                <a href="mailto:kariukidennis092@gmail.com" className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors">
                  <Mail className="w-4 h-4" />
                  Email Support
                </a>
              </div>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="border-t border-white/10 pt-8 flex flex-col md:row justify-between items-center gap-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
              © {new Date().getFullYear()} EDUNEXUS KENYA. ALL RIGHTS RESERVED.
            </p>
            <div className="flex items-center gap-2">
               <span className="text-slate-600 text-[10px] font-black tracking-tighter uppercase">Status:</span>
               <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 text-[10px] rounded font-bold">SYSTEMS ONLINE</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}