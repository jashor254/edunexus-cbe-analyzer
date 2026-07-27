// app/(marketing)/legal/refund/page.tsx
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import { FOCUS_RING } from '../../constants'

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-slate-900 text-white py-8">
        <div className="max-w-4xl mx-auto px-6">
          <Link
            href="/"
            className={`inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-4 font-semibold ${FOCUS_RING}`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl font-black">Refund Policy</h1>
          <p className="text-slate-300 mt-2 font-semibold">Last Updated: February 25, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-slate prose-lg max-w-none">

          <h2>Our Commitment</h2>
          <p>
            At EduNexus, we want you to be completely satisfied with our service. This Refund Policy explains when and how refunds are issued.
          </p>

          <h2>Token Purchases (Pay-As-You-Go)</h2>
          
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 not-prose my-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-black text-red-900 text-lg mb-2">Policy: Non-Refundable</p>
                <p className="text-red-800">
                  Once you purchase tokens, they are non-refundable. However:
                </p>
                <ul className="text-red-800 mt-2 space-y-1">
                  <li>✓ Tokens never expire</li>
                  <li>✓ Can be used anytime</li>
                  <li>✓ Transferable within your account</li>
                </ul>
              </div>
            </div>
          </div>

          <p><strong>Why Non-Refundable?</strong></p>
          <p>
            Tokens are digital goods delivered instantly. Once purchased and added to your account, the service has been provided.
          </p>

          <p><strong>Exception:</strong></p>
          <p>
            If there's a technical error preventing you from using tokens, contact us immediately. We'll either fix the issue OR issue a refund.
          </p>

          <h2>Termly Unlimited Subscription</h2>

          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 not-prose my-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-black text-green-900 text-lg mb-2">7-Day Money-Back Guarantee</p>
                <div className="grid md:grid-cols-2 gap-4 mt-3">
                  <div>
                    <p className="font-bold text-green-800 mb-2">✅ Within 7 days:</p>
                    <ul className="text-green-800 text-sm space-y-1">
                      <li>• Full refund, no questions asked</li>
                      <li>• Processed in 7-14 business days</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-bold text-red-800 mb-2">❌ After 7 days:</p>
                    <ul className="text-red-800 text-sm space-y-1">
                      <li>• No refunds for current term</li>
                      <li>• Can cancel future charges</li>
                      <li>• Keep access until term ends</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h2>Technical Issues / Service Failure</h2>
          <p>
            If EduNexus is unavailable for <strong>3+ consecutive days</strong>, we'll issue a prorated refund for unused subscription days.
          </p>

          <p><strong>What counts as service failure:</strong></p>
          <ul>
            <li>Platform completely inaccessible</li>
            <li>All features non-functional</li>
            <li>Database errors preventing use</li>
          </ul>

          <p><strong>What does NOT count:</strong></p>
          <ul>
            <li>Slow performance</li>
            <li>Single feature temporarily down</li>
            <li>Scheduled maintenance</li>
            <li>Your internet connection issues</li>
          </ul>

          <h2>How to Request a Refund</h2>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 not-prose my-6">
            <p className="font-bold text-blue-900 mb-3">Email: kariukidennis092@gmail.com</p>
            <p className="text-blue-800 mb-3">Include the following:</p>
            <ol className="text-blue-800 space-y-2">
              <li>1. Your account email</li>
              <li>2. Purchase date and amount</li>
              <li>3. Transaction reference (if available)</li>
              <li>4. Reason for refund</li>
              <li>5. Screenshot of payment (if possible)</li>
            </ol>
          </div>

          <h3>Response Time</h3>
          <ul>
            <li><strong>Initial response:</strong> Within 24-48 hours</li>
            <li><strong>Refund decision:</strong> Within 5 business days</li>
            <li><strong>Refund processing:</strong> 7-14 business days</li>
          </ul>

          <h2>Refund Method</h2>
          <p>Refunds are issued to:</p>
          <ul>
            <li><strong>M-Pesa:</strong> Same number used for payment (1-3 business days)</li>
            <li><strong>Card Payments:</strong> Original card via Paystack (7-14 business days)</li>
            <li><strong>Bank Transfer:</strong> If M-Pesa/card unavailable (3-5 business days)</li>
          </ul>

          <h2>Chargebacks</h2>
          
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 not-prose my-6">
            <p className="font-black text-yellow-900 text-lg mb-2">⚠️ Please Contact Us BEFORE Filing a Chargeback!</p>
            <p className="text-yellow-900 mb-3">
              Chargebacks can result in:
            </p>
            <ul className="text-yellow-900 space-y-1">
              <li>• Immediate account suspension</li>
              <li>• Additional fees we must recover</li>
              <li>• Possible permanent ban</li>
            </ul>
            <p className="text-yellow-900 mt-3 font-semibold">
              We resolve most issues quickly - give us a chance to help!
            </p>
          </div>

          <h2>Exceptions</h2>
          <p><strong>We reserve the right to deny refunds if:</strong></p>
          <ul>
            <li>You violate our Terms of Service</li>
            <li>Fraudulent activity detected</li>
            <li>Abuse of refund policy</li>
            <li>False information provided</li>
          </ul>

          <h2>Fair Use Commitment</h2>
          <p>We believe in fair treatment:</p>
          <ul>
            <li>✅ Legitimate refund requests honored</li>
            <li>✅ Technical issues resolved quickly</li>
            <li>✅ Transparent communication</li>
            <li>✅ Customer satisfaction priority</li>
          </ul>
          <p className="font-semibold">We'll work with you to find a fair solution!</p>

          <h2>Contact Us</h2>
          <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-6 not-prose">
            <p className="font-bold text-slate-900 mb-2">For Refund Requests:</p>
            <p className="text-slate-700"><strong>Email:</strong> kariukidennis092@gmail.com</p>
            <p className="text-slate-700"><strong>Subject:</strong> "Refund Request - [Your Name]"</p>
            <p className="text-slate-700 mt-3"><strong>Location:</strong> Nairobi, Kenya</p>
          </div>

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