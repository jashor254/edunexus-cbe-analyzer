import Link from 'next/link'
import { MessageCircle, Facebook, Music2, Phone, Mail } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

export default function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800">
      <div className="max-w-6xl mx-auto px-6">
        
        {/* Main Footer Grid */}
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          
          {/* Brand Column */}
          <div className="md:col-span-1">
            <div className="mb-4"><Logo variant="dark" size="sm" /></div>
            <p className="text-slate-400 text-sm mb-6">
              Complete CBE guidance from Junior to Senior School. 🇰🇪
            </p>
            
            {/* WhatsApp Support - Direct Line */}
            <div className="bg-green-600/20 border border-green-600/30 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-white font-bold text-sm">Need Help?</div>
                  <div className="text-xs text-green-400">Reply in 5 min</div>
                </div>
              </div>
              <a 
                href="https://wa.me/254710798030" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-green-600 hover:bg-green-700 text-white p-3 rounded-xl font-bold text-sm transition-all"
              >
                <span>Chat on WhatsApp</span>
                <MessageCircle className="w-4 h-4" />
              </a>
              <p className="text-xs text-slate-500 mt-2 text-center">+254 710 798 030</p>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-white font-bold mb-4 text-lg">Product</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/#pricing" className="text-slate-400 hover:text-white text-sm transition flex items-center gap-2">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-slate-400 hover:text-white text-sm transition flex items-center gap-2">
                  Get Started
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm transition flex items-center gap-2">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-white font-bold mb-4 text-lg">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/legal/privacy" className="text-slate-400 hover:text-white text-sm transition flex items-center gap-2">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="text-slate-400 hover:text-white text-sm transition flex items-center gap-2">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal/refund" className="text-slate-400 hover:text-white text-sm transition flex items-center gap-2">
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Social Media */}
          <div>
            <h4 className="text-white font-bold mb-4 text-lg">Connect With Us</h4>
            <div className="space-y-4">
              
              {/* Facebook */}
              <a 
                href="https://facebook.com/edunexuskenya" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-slate-400 hover:text-white transition group"
              >
                <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center group-hover:bg-blue-600/30 transition">
                  <Facebook className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-white font-bold text-sm">Facebook</div>
                  <div className="text-xs text-slate-500">@edunexuskenya</div>
                </div>
              </a>

              {/* TikTok */}
              <a 
                href="https://tiktok.com/@edunexuscbe" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-slate-400 hover:text-white transition group"
              >
                <div className="w-10 h-10 bg-pink-600/20 rounded-xl flex items-center justify-center group-hover:bg-pink-600/30 transition">
                  <Music2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-white font-bold text-sm">TikTok</div>
                  <div className="text-xs text-slate-500">@edunexuscbe</div>
                </div>
              </a>

              {/* Email Support */}
              <a 
                href="mailto:kariukidennis092@gmail.com"
                className="flex items-center gap-3 text-slate-400 hover:text-white transition group"
              >
                <div className="w-10 h-10 bg-yellow-600/20 rounded-xl flex items-center justify-center group-hover:bg-yellow-600/30 transition">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-white font-bold text-sm">Email</div>
                  <div className="text-xs text-slate-500">24h response</div>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <p className="text-sm text-slate-500">
              © {currentYear} EduNexus. All rights reserved. Nairobi, Kenya 🇰🇪
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Developed by{' '}
              <span className="text-slate-400 font-semibold">Jashor Technologies</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/legal/privacy" className="text-xs text-slate-600 hover:text-slate-400 transition">
              Privacy Policy
            </Link>
            <span className="text-slate-700">•</span>
            <Link href="/legal/terms" className="text-xs text-slate-600 hover:text-slate-400 transition">
              Terms of Use
            </Link>
            <span className="text-slate-700">•</span>
            <Link href="/legal/refund" className="text-xs text-slate-600 hover:text-slate-400 transition">
              Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}