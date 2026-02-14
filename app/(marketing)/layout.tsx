"use client";

import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">

      {/* NAVIGATION */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">

            {/* BRAND */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                EduNexus CBE
              </span>
            </div>

            {/* LINKS */}
            <div className="flex items-center gap-6">
              <Link
                href="#features"
                className="hidden md:block text-gray-600 hover:text-blue-600 font-medium transition-colors"
              >
                Features
              </Link>
              <Link
                href="#dashboard"
                className="hidden md:block text-gray-600 hover:text-blue-600 font-medium transition-colors"
              >
                Demo
              </Link>
              <Link
                href="#pricing"
                className="hidden md:block text-gray-600 hover:text-blue-600 font-medium transition-colors"
              >
                Pricing
              </Link>

              {/* AUTH */}
              <div className="flex items-center gap-4 border-l pl-6">
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-gray-900 font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* PAGE CONTENT */}
      <main>{children}</main>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4 mt-24">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8 text-center md:text-left">

            {/* BRAND */}
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                <span className="text-2xl">📚</span>
                <span className="text-xl font-bold text-white">EduNexus</span>
              </div>
              <p className="text-sm opacity-80">
                AI-powered career guidance tailored for the Kenyan CBC curriculum.
              </p>
            </div>

            {/* SUPPORT */}
            <div>
              <h4 className="font-bold text-white mb-4">Support</h4>
              <ul className="space-y-2 text-sm opacity-80">
                <li>
                  <Link href="https://wa.me/254700000000" className="hover:text-blue-400">
                    WhatsApp Support
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="hover:text-blue-400">
                    FAQs
                  </Link>
                </li>
              </ul>
            </div>

            {/* PRODUCT LINKS */}
            <div>
              <h4 className="font-bold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm opacity-80">
                <li>
                  <Link href="#features" className="hover:text-blue-400">Features</Link>
                </li>
                <li>
                  <Link href="#dashboard" className="hover:text-blue-400">Demo</Link>
                </li>
                <li>
                  <Link href="#pricing" className="hover:text-blue-400">Pricing</Link>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-blue-400">Sign Up</Link>
                </li>
              </ul>
            </div>

            {/* LEGAL */}
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm opacity-80">
                <li>
                  <Link href="/privacy" className="hover:text-blue-400">Privacy Policy</Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-blue-400">Terms of Service</Link>
                </li>
              </ul>
            </div>

          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm opacity-60">
            &copy; {new Date().getFullYear()} EduNexus CBE. Made with ❤️ in Kenya 🇰🇪
          </div>
        </div>
      </footer>
    </div>
  );
}