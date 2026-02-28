import Link from 'next/link'

export default function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-slate-100 py-12">
      <div className="max-w-5xl mx-auto px-6 flex flex-col items-center text-center">
        
        {/* Logo & Slogan */}
        <div className="mb-8">
          <h2 className="text-xl font-black text-slate-900 tracking-tighter italic">EduNexus</h2>
          <p className="text-slate-50 text-sm font-medium mt-1">
            Navigating the future of CBC together. 🇰🇪
          </p>
        </div>

        {/* Essential Links Only */}
        <nav className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-8">
          <Link href="/legal/privacy" className="text-slate-500 hover:text-blue-600 text-sm font-bold transition">
            Privacy
          </Link>
          <Link href="/legal/terms" className="text-slate-500 hover:text-blue-600 text-sm font-bold transition">
            Terms
          </Link>
          <Link href="/legal/refund" className="text-slate-500 hover:text-blue-600 text-sm font-bold transition">
            Refunds
          </Link>
          <a href="mailto:kariukidennis092@gmail.com" className="text-slate-500 hover:text-blue-600 text-sm font-bold transition">
            Support
          </a>
        </nav>

        {/* Tiny Credit Line */}
        <div className="pt-8 border-t border-slate-50 w-full max-w-xs">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
            © {currentYear}NAIROBI KENYA
          </p>
        </div>

      </div>
    </footer>
  )
}