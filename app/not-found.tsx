import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-9xl font-black text-gray-200">404</h1>
        <div className="relative -mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Lost in the Pathway?</h2>
          <p className="text-gray-600 mb-8">
            Even the best explorers get lost sometimes. Let's get you back to track.
          </p>
          
          <div className="space-y-3">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
            >
              <Home className="w-5 h-5" />
              Return to Dashboard
            </Link>
            
            <Link
              href="/"
              className="flex items-center justify-center gap-2 w-full py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-white"
            >
              <ArrowLeft className="w-5 h-5" />
              Go to Home Page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}