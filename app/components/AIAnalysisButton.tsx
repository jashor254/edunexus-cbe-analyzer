'use client'

import { useState } from 'react' // 1. LAZIMA u-import hii!
import { useTokens } from '@/hooks/useTokens'
import { showToast } from '@/components/toast-system'

// 2. Weka interface ili TypeScript isilete fujo ya "Implicit Any"
interface AIAnalysisButtonProps {
  userId: string;
  studentId: string;
}

export function AIAnalysisButton({ userId, studentId }: AIAnalysisButtonProps) {
  const { withTokens, tokensRemaining, isChecking } = useTokens()
  
  // 3. Tangaza hizi states hapa ndani
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false) // Hii ilikuwa inakosekana

  const handleAnalysis = async () => {
    setLoading(true)

    try {
      const result = await withTokens('career_guidance', async () => {
        // Call AI API
        const response = await fetch('/api/ai/career-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }, // Piga spana hapa
          body: JSON.stringify({ studentId })
        })
        
        if (!response.ok) throw new Error('Analysis failed')
        
        return response.json()
      })

      if (result) {
        // Success! Tokens already deducted by withTokens
        showToast.success('Analysis Complete!', 'Check your results below')
        setShowResults(true)
      }
    } catch (error) {
      console.error('AI Error:', error)
      showToast.error('Analysis Failed', 'Something went wrong with the AI service.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 bg-white border-4 border-black rounded-[32px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      {/* Show balance */}
      <div className="mb-4 flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${tokensRemaining === 0 ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
        <span className="font-black uppercase text-xs tracking-widest">
          {tokensRemaining === 'unlimited' 
            ? '⭐ Unlimited Access' 
            : `⚡ ${tokensRemaining} tokens remaining`
          }
        </span>
      </div>

      {/* Action button */}
      <button
        onClick={handleAnalysis}
        disabled={loading || isChecking || tokensRemaining === 0}
        className={`w-full p-4 rounded-2xl font-black uppercase tracking-tighter transition-all 
          ${loading 
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
            : 'bg-black text-white hover:scale-[1.02] active:scale-95 shadow-lg'
          }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin text-xl">🌀</span> Analyzing...
          </span>
        ) : (
          'Get AI Career Analysis (5 tokens)'
        )}
      </button>

      {/* Kama matokeo yapo, onyesha hapa */}
      {showResults && (
        <div className="mt-6 p-4 bg-purple-50 border-2 border-purple-200 rounded-2xl animate-in slide-in-from-top-4">
          <p className="text-purple-900 font-bold text-sm">✨ Results generated successfully!</p>
        </div>
      )}
    </div>
  )
}