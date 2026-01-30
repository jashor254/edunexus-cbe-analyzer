'use client';

import React, { useState } from 'react';
import { Lock, FileDown, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  studentId: string;
  studentName: string;
  hasPaid: boolean; // Hii itatoka kwenye query yako ya payments
  scores: any;
  profile: any;
}

export default function DownloadClinicButton({ studentId, studentName, hasPaid, scores, profile }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    if (!hasPaid) {
      toast.error("Tafadhali lipia KES 500 kufungua ripoti hii kamili.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/clinic/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, scores, profile }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Academic_Clinic_${studentName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      toast.success("Ripoti imepakuliwa kikamilifu!");
    } catch (err) {
      toast.error("Kuna tatizo la kiufundi. Jaribu tena.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 bg-white border-2 border-dashed border-blue-100 rounded-2xl text-center">
      <h3 className="text-lg font-bold text-gray-800 mb-2">🏥 Full Academic Clinic Diagnosis</h3>
      <p className="text-sm text-gray-500 mb-6">
        Get the 8-page analysis, 20-year AI career outlook, and 90-day action plan.
      </p>

      {!hasPaid ? (
        <button 
          onClick={() => window.location.href = '/billing'} // Au trigger M-Pesa modal
          className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-all"
        >
          <Lock className="w-5 h-5 text-yellow-400" />
          Unlock Full Report (KES 500)
        </button>
      ) : (
        <button
          onClick={handleDownload}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:bg-blue-300"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Inatengeneza PDF...
            </>
          ) : (
            <>
              <FileDown className="w-5 h-5" />
              Download Full Report
            </>
          )}
        </button>
      )}
      
      <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> AI Verified</span>
        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> CBC Compliant</span>
        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> 2026 Updated</span>
      </div>
    </div>
  );
}