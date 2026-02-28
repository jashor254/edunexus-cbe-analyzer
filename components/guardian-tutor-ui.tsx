'use client';

// ✅ 'export' imewekwa kuhakikisha build inapita
export function GuardianTutorUI({ user, currentTokens }: { user: any; currentTokens: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <span className="text-4xl">🤖</span>
      </div>
      
      <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter mb-2">
        Guardian Tutor AI
      </h3>
      
      <p className="text-slate-500 max-w-sm font-medium mb-8">
        Hapa ndipo uchambuzi wa CBC unafanyika. Una tokens <span className="text-indigo-600 font-black">{currentTokens}</span> tayari kwa kazi.
      </p>

      <button 
        className="px-8 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-[0px_8px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-1 hover:shadow-none transition-all active:scale-95"
        onClick={() => alert('AI Analysis starting... (Coming tomorrow!)')}
      >
        Anza Analysis Mpya 🚀
      </button>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 w-full opacity-40 grayscale">
         <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-bold">PATHWAY GUIDANCE</div>
         <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-bold">CAREER MAPPING</div>
         <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-bold">CBC ANALYTICS</div>
      </div>
    </div>
  );
}
