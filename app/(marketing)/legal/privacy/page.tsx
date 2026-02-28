// app/(marketing)/legal/privacy/page.tsx
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-black">Privacy Policy</h1>
          <p className="text-slate-300 mt-2 font-semibold">Last Updated: February 25, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-slate prose-lg max-w-none">

          <h2>Introduction</h2>
          <p>
            EduNexus ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our educational pathway analysis platform.
          </p>
          <p>
            This policy complies with the <strong>Kenya Data Protection Act, 2019</strong>.
          </p>

          <h2>Information We Collect</h2>
          
          <h3>Personal Information You Provide</h3>
          <p>When you use EduNexus, we collect:</p>
          <ul>
            <li><strong>Account Information:</strong> Name, email address, phone number</li>
            <li><strong>Student/Learner Information:</strong> Student name, grade level, school type, academic interests</li>
            <li><strong>Academic Data:</strong> Subject performance, strengths, weaknesses, pathway preferences</li>
            <li><strong>Payment Information:</strong> Payment method, transaction details (processed securely through Paystack)</li>
            <li><strong>Communication Data:</strong> Messages sent through our Guardian AI Tutor feature</li>
          </ul>

          <h3>Information Collected Automatically</h3>
          <ul>
            <li><strong>Usage Data:</strong> Pages visited, features used, time spent on platform</li>
            <li><strong>Device Information:</strong> Browser type, operating system, IP address</li>
            <li><strong>Cookies:</strong> We use essential cookies for authentication and session management</li>
          </ul>

          <h2>How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ol>
            <li><strong>Provide Services:</strong> Generate pathway analyses, career recommendations, and AI tutoring</li>
            <li><strong>Process Payments:</strong> Handle token purchases and subscription payments</li>
            <li><strong>Improve Our Platform:</strong> Analyze usage patterns to enhance user experience</li>
            <li><strong>Customer Support:</strong> Respond to your questions and resolve issues</li>
            <li><strong>Send Updates:</strong> Notify you about account changes, new features (you can opt-out)</li>
            <li><strong>Comply with Laws:</strong> Meet legal obligations under Kenyan law</li>
          </ol>

          <h2>Legal Basis for Processing (Kenya DPA 2019)</h2>
          <p>We process your data based on:</p>
          <ul>
            <li><strong>Consent:</strong> You explicitly agree when creating an account</li>
            <li><strong>Contract Performance:</strong> Necessary to provide our services</li>
            <li><strong>Legitimate Interest:</strong> Improving our platform and preventing fraud</li>
            <li><strong>Legal Obligation:</strong> Compliance with Kenyan laws and regulations</li>
          </ul>

          <h2>How We Protect Your Information</h2>
          <p>We implement industry-standard security measures:</p>
          <ul>
            <li><strong>Encryption:</strong> All data transmitted using SSL/TLS encryption</li>
            <li><strong>Secure Storage:</strong> Data stored on secure servers (Supabase - AWS)</li>
            <li><strong>Access Controls:</strong> Limited employee access on need-to-know basis</li>
            <li><strong>Regular Audits:</strong> Periodic security reviews and updates</li>
          </ul>

          <h2>Data Sharing and Disclosure</h2>
          <p className="font-bold text-lg">We DO NOT sell your personal information.</p>
          <p>We may share your data with:</p>
          <ul>
            <li><strong>Service Providers:</strong> Payment processors (Paystack), cloud hosting (Supabase/AWS), AI providers (DeepSeek)</li>
            <li><strong>Legal Requirements:</strong> When required by Kenyan law or court order</li>
            <li><strong>Business Transfers:</strong> In case of merger, acquisition, or sale of assets (you'll be notified)</li>
          </ul>

          <h2>Your Rights Under Kenya DPA 2019</h2>
          <p>You have the right to:</p>
          <ol>
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Correction:</strong> Update incorrect or incomplete information</li>
            <li><strong>Deletion:</strong> Request deletion of your data (subject to legal obligations)</li>
            <li><strong>Data Portability:</strong> Receive your data in a portable format</li>
            <li><strong>Withdraw Consent:</strong> Opt-out of marketing communications</li>
            <li><strong>Object to Processing:</strong> Object to certain types of data processing</li>
            <li><strong>Complain:</strong> File a complaint with the Office of the Data Protection Commissioner (Kenya)</li>
          </ol>
          <p>
            To exercise these rights, email us at: <strong>kariukidennis092@gmail.com</strong>
          </p>

          <h2>Children's Privacy</h2>
          <p>
            EduNexus is designed for parents and guardians to track their children's academic pathways. We collect information about students/learners, but:
          </p>
          <ul>
            <li>We do NOT knowingly collect data directly from children under 18</li>
            <li>All student data is entered by parents/guardians</li>
            <li>Parents/guardians control their children's data</li>
          </ul>
          <p>
            If you're under 18, please have your parent/guardian use EduNexus on your behalf.
          </p>

          <h2>Data Retention</h2>
          <p>We retain your data:</p>
          <ul>
            <li><strong>Account Data:</strong> Until you delete your account</li>
            <li><strong>Assessment Results:</strong> As long as your account is active</li>
            <li><strong>Payment Records:</strong> 7 years (Kenyan tax requirements)</li>
            <li><strong>Chat History:</strong> Until you delete conversations or close your account</li>
          </ul>
          <p>You can request data deletion at any time by contacting us.</p>

          <h2>Cookies Policy</h2>
          <p>We use cookies for:</p>
          <ul>
            <li><strong>Essential Cookies:</strong> Authentication, session management (required)</li>
            <li><strong>Analytics Cookies:</strong> Understanding how you use our platform (optional)</li>
          </ul>
          <p>You can control cookies through your browser settings.</p>

          <h2>International Data Transfers</h2>
          <p>Your data is primarily stored in servers located in:</p>
          <ul>
            <li><strong>Primary:</strong> AWS Ireland (EU - GDPR compliant)</li>
            <li><strong>Backup:</strong> AWS Frankfurt (EU - GDPR compliant)</li>
          </ul>
          <p>
            We ensure adequate safeguards for international data transfers as required by Kenya DPA 2019.
          </p>

          <h2>Changes to This Privacy Policy</h2>
          <p>We may update this policy from time to time. We'll notify you of significant changes by:</p>
          <ul>
            <li>Email notification</li>
            <li>Notice on our website</li>
            <li>Update to "Last Updated" date</li>
          </ul>
          <p>Continued use after changes means you accept the updated policy.</p>

          <h2>Contact Us</h2>
          <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-6 not-prose">
            <p className="font-bold text-slate-900 mb-2">Data Controller: EduNexus</p>
            <p className="text-slate-700"><strong>Email:</strong> kariukidennis092@gmail.com</p>
            <p className="text-slate-700"><strong>Location:</strong> Nairobi, Kenya</p>
            
            <p className="font-bold text-slate-900 mt-4 mb-2">Kenya Data Protection Office:</p>
            <p className="text-slate-700">Office of the Data Protection Commissioner</p>
            <p className="text-slate-700"><strong>Website:</strong> www.odpc.go.ke</p>
            <p className="text-slate-700"><strong>Email:</strong> complaints@odpc.go.ke</p>
          </div>

          <h2>Your Consent</h2>
          <p>
            By using EduNexus, you consent to this Privacy Policy and agree to its terms.
          </p>

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