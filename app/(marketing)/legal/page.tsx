import Link from 'next/link'
import { ShieldCheck, FileText, RefreshCcw, ArrowRight } from 'lucide-react'
import { FOCUS_RING_ON_LIGHT } from '../constants'

export default function LegalHubPage() {
  const legalLinks = [
    {
      title: "Privacy Policy",
      description: "How we handle and protect your personal and student data under Kenya DPA 2019.",
      href: "/legal/privacy",
      icon: <ShieldCheck className="w-8 h-8 text-blue-600" />,
      color: "bg-blue-50"
    },
    {
      title: "Terms of Service",
      description: "The rules, guidelines, and AI disclaimers for using the EduNexus platform.",
      href: "/legal/terms",
      icon: <FileText className="w-8 h-8 text-purple-600" />,
      color: "bg-purple-50"
    },
    {
      title: "Refund Policy",
      description: "Our policy on token purchases, termly subscriptions, and money-back guarantees.",
      href: "/legal/refund",
      icon: <RefreshCcw className="w-8 h-8 text-emerald-600" />,
      color: "bg-emerald-50"
    }
  ]

  return (
    <div className="min-h-screen bg-slate-50 py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
            Legal Center
          </h1>
          <p className="text-lg text-slate-600 font-medium">
            Everything you need to know about our policies, terms, and how we protect your family.
          </p>
        </div>

        <div className="grid gap-6">
          {legalLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className={`group bg-white border-2 border-slate-200 p-8 rounded-2xl hover:border-blue-500 hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row items-center gap-6 ${FOCUS_RING_ON_LIGHT}`}
            >
              <div className={`${link.color} p-4 rounded-xl group-hover:scale-110 transition-transform`}>
                {link.icon}
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl font-bold text-slate-900 mb-1">{link.title}</h2>
                <p className="text-slate-500 font-medium">{link.description}</p>
              </div>

              <div className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-2 transition-all">
                <ArrowRight className="w-6 h-6" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-slate-400 text-sm font-semibold italic">
            Last Updated: February 25, 2026 • Nairobi, Kenya 🇰🇪
          </p>
        </div>
      </div>
    </div>
  )
}