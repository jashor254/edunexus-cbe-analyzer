import Link from 'next/link';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Rasmi */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📚</span>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                EduNexus CBE
              </span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="#how-it-works" className="hidden md:block text-gray-600 hover:text-blue-600 font-medium transition-colors">
                How It Works
              </Link>
              <Link href="#pricing" className="hidden md:block text-gray-600 hover:text-blue-600 font-medium transition-colors">
                Pricing
              </Link>
              <div className="flex items-center gap-4 border-l pl-6">
                <Link href="/login" className="text-gray-700 hover:text-gray-900 font-medium">
                  Login
                </Link>
                <Link 
                  href="/signup" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      {/* Footer Rasmi */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8 text-center md:text-left">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                <span className="text-2xl">📚</span>
                <span className="text-xl font-bold text-white">EduNexus</span>
              </div>
              <p className="text-sm opacity-80">
                AI-powered career guidance tailored for the Kenyan CBC curriculum.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Msaada</h4>
              <ul className="space-y-2 text-sm opacity-80">
                <li><Link href="https://wa.me/255XXXXXXXXX" className="hover:text-blue-400">WhatsApp Support</Link></li>
                <li><Link href="/faq" className="hover:text-blue-400">Maswali ya Kila Mara</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm opacity-60">
            <p>&copy; {new Date().getFullYear()} EduNexus CBE. Made with ❤️ in Kenya 🇰🇪</p>
          </div>
        </div>
      </footer>
    </div>
  );
}