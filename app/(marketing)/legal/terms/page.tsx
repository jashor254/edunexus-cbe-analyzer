// app/(marketing)/legal/terms/page.tsx
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-slate-900 text-white py-8">
        <div className="max-w-4xl mx-auto px-6">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-4 font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl font-black">Terms of Service</h1>
          <p className="text-slate-300 mt-2 font-semibold">Last Updated: February 25, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-slate prose-lg max-w-none">

          <h2>Agreement to Terms</h2>
          <p>
            By accessing or using EduNexus ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.
          </p>
          <p>
            <strong>EduNexus</strong> is operated by <strong>EduNexus Kenya</strong> from Nairobi, Kenya,
            and governed by Kenyan law.
          </p>

          <h2>Services Provided</h2>
          <p>EduNexus provides:</p>
          <ol>
            <li><strong>Pathway Analysis:</strong> Personalised analysis of student strengths and recommended CBC pathways</li>
            <li><strong>Career Recommendations:</strong> Suggested career paths based on student interests and performance</li>
            <li><strong>Learning Compass:</strong> 24/7 personalised educational support</li>
            <li><strong>Progress Tracking:</strong> Monitor student development over time</li>
          </ol>

          <h2>Subscription Plans & Pricing</h2>

          <h3>Free Trial</h3>
          <ul>
            <li>1 FREE pathway analysis for new users</li>
            <li>No credit card required</li>
          </ul>

          <h3>Pay-As-You-Go (Token Plan)</h3>
          <ul>
            <li>KES 100 for 10 tokens</li>
            <li>KES 300 for 35 tokens</li>
            <li>KES 500 for 60 tokens</li>
            <li>Tokens never expire</li>
            <li>Non-refundable once purchased</li>
          </ul>

          <p><strong>Token Usage:</strong></p>
          <ul>
            <li>Guardian Tutor: 2 tokens per session</li>
            <li>Career Recommendation: 2 tokens per search</li>
          </ul>

          <h3>Termly Unlimited Plan</h3>
          <ul>
            <li>KES 1,500 per term (3 months)</li>
            <li>Unlimited pathway analyses</li>
            <li>Unlimited Guardian Tutor access</li>
            <li>Unlimited career recommendations</li>
            <li>Track up to 3 children</li>
            <li>Auto-renews unless cancelled</li>
          </ul>

          <h2>Payment Terms</h2>
          <p><strong>Accepted Payment Methods:</strong></p>
          <ul>
            <li>M-Pesa</li>
            <li>Visa/Mastercard (via Paystack)</li>
          </ul>

          <p>All payments are processed securely through Paystack. Prices are in Kenyan Shillings (KES).</p>

          <h2>Refund Policy</h2>

          <h3>Token Purchases</h3>
          <ul>
            <li><strong>Non-refundable</strong> once purchased</li>
            <li>Tokens remain valid indefinitely</li>
          </ul>

          <h3>Termly Subscriptions</h3>
          <ul>
            <li><strong>7-day money-back guarantee</strong> from purchase date</li>
            <li>After 7 days: No refunds</li>
            <li>Cancellation stops future charges but does not refund current term</li>
          </ul>

          <p>
            For refund requests, email: <strong>kariukidennis092@gmail.com</strong>
          </p>
          <p>
            <Link href="/legal/refund" className="text-blue-600 hover:underline font-semibold">
              View full Refund Policy →
            </Link>
          </p>

          <h2>AI-Generated Content & Disclaimers</h2>

          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 not-prose my-8">
            <p className="font-black text-yellow-900 text-xl mb-3">⚠️ Important: Educational Tool, Not Professional Advice</p>
            <p className="text-yellow-900 mb-4">
              EduNexus uses artificial intelligence to provide pathway suggestions and career recommendations. However:
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="font-bold text-green-700 mb-2">✅ What We Are:</p>
                <ul className="text-sm text-yellow-900 space-y-1">
                  <li>• An educational guidance tool</li>
                  <li>• Personalised analysis platform</li>
                  <li>• Support for decision-making</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-red-700 mb-2">❌ What We Are NOT:</p>
                <ul className="text-sm text-yellow-900 space-y-1">
                  <li>• Professional career counselors</li>
                  <li>• Educational psychologists</li>
                  <li>• Replacement for professional advice</li>
                </ul>
              </div>
            </div>

            <p className="font-bold text-yellow-900">
              Parents and guardians are fully responsible for final educational decisions. Use EduNexus as ONE input among many.
            </p>
          </div>

          <h3>Accuracy Disclaimer</h3>
          <p>While our AI is trained on extensive data:</p>
          <ul>
            <li>Results are <strong>suggestions, not guarantees</strong></li>
            <li>AI can make mistakes</li>
            <li>Individual circumstances vary</li>
            <li>Professional human judgment is irreplaceable</li>
          </ul>

          <p><strong>We do NOT guarantee:</strong></p>
          <ul>
            <li>Accuracy of pathway predictions</li>
            <li>Career success outcomes</li>
            <li>Admission to specific schools or programs</li>
            <li>Future academic performance</li>
          </ul>

          <h2>User Responsibilities</h2>
          <p><strong>You agree NOT to:</strong></p>
          <ul>
            <li>Share your account with others</li>
            <li>Use the service for illegal purposes</li>
            <li>Attempt to hack, disrupt, or damage the platform</li>
            <li>Upload false, misleading, or harmful information</li>
            <li>Use the service to harm children in any way</li>
          </ul>

          <h2>Limitation of Liability</h2>
          <p>To the maximum extent permitted by Kenyan law:</p>
          <p>
            EduNexus and its owners, employees, and partners are <strong>NOT LIABLE</strong> for:
          </p>
          <ul>
            <li>Indirect, incidental, or consequential damages</li>
            <li>Decisions made based on our AI recommendations</li>
            <li>Technical issues, service interruptions, or data loss</li>
          </ul>
          <p>
            <strong>Maximum Liability:</strong> Our total liability is limited to the amount you paid in the last 3 months (maximum KES 5,000).
          </p>

          <h2>Data Privacy</h2>
          <p>
            Your privacy is important. Please review our{' '}
            <Link href="/legal/privacy" className="text-blue-600 hover:underline font-semibold">
              Privacy Policy →
            </Link>
            {' '}which explains how we collect, use, and protect your data.
          </p>

          <h2>Cancellation</h2>
          <p><strong>You can cancel anytime:</strong></p>
          <ul>
            <li>Log into your account</li>
            <li>Go to Settings → Subscription</li>
            <li>Click "Cancel Subscription"</li>
            <li>Service continues until end of current billing period</li>
          </ul>

          <h2>Governing Law & Dispute Resolution</h2>
          <p>
            These Terms are governed by the <strong>laws of Kenya</strong>.
          </p>
          <p><strong>Dispute Resolution Process:</strong></p>
          <ol>
            <li><strong>Negotiation:</strong> Contact us first to resolve amicably</li>
            <li><strong>Mediation:</strong> If negotiation fails, try mediation</li>
            <li><strong>Arbitration:</strong> Disputes resolved through arbitration in Nairobi, Kenya</li>
            <li><strong>Court:</strong> As a last resort, Kenyan courts have jurisdiction</li>
          </ol>

          <h2>Changes to Terms</h2>
          <p>
            We may modify these Terms at any time. Changes are effective immediately upon posting. Continued use means acceptance of updated terms.
          </p>

          <h2>Contact Information</h2>
          <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-6 not-prose">
            <p className="font-bold text-slate-900 mb-2">EduNexus — operated by EduNexus Kenya</p>
            <p className="text-slate-700"><strong>Email:</strong> kariukidennis092@gmail.com</p>
            <p className="text-slate-700"><strong>Location:</strong> Nairobi, Kenya</p>
          </div>

          <h2>Acknowledgment</h2>
          <p>By using EduNexus, you acknowledge that:</p>
          <ul>
            <li>You have read and understood these Terms</li>
            <li>You agree to be bound by them</li>
            <li>You are legally capable of entering this agreement</li>
            <li>You will use the service responsibly and ethically</li>
          </ul>

          <div className="mt-12 pt-8 border-t-2 border-slate-200 not-prose">
            <p className="text-center text-slate-600 font-semibold">
              🇰🇪 <strong>EduNexus</strong> - Building Your Child's Future Together
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}