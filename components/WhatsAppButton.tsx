'use client';

import { MessageCircle, Clock } from 'lucide-react';
import { useState } from 'react';

export default function WhatsAppButton() {
  const [showTooltip, setShowTooltip] = useState(false);
  const whatsappUrl = "https://wa.me/254710798030?text=Hello%20EduNexus%2C%20I%20have%20a%20question%20about%20the%20Academic%20Clinic.";

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Working hours indicator (optional) */}
      <div className="absolute bottom-16 right-0 bg-white text-xs text-gray-600 px-3 py-1 rounded-full shadow-md border border-green-200 mb-2 whitespace-nowrap">
        <Clock className="w-3 h-3 inline mr-1 text-green-600" />
        Online: 8am - 8pm
      </div>
      
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full shadow-2xl hover:scale-110 hover:shadow-green-500/30 transition-all duration-300 group relative"
        aria-label="Chat on WhatsApp"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <MessageCircle className="w-8 h-8" />
        
        {/* Animated ping effect */}
        <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-20"></span>
        
        {/* Tooltip */}
        {showTooltip && (
          <span className="absolute right-16 bg-white text-gray-800 text-sm font-bold px-4 py-2.5 rounded-xl shadow-xl whitespace-nowrap border-2 border-green-100 animate-in slide-in-from-right-2">
            💬 Chat with us on WhatsApp!
            <span className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-r-2 border-t-2 border-green-100 rotate-45"></span>
          </span>
        )}
      </a>
    </div>
  );
}