'use client'

import { useEffect, useState } from 'react'

interface QuotaData {
  careerAnalysis: { allowed: boolean; remaining: number; limit: number }
  learningPlans: { allowed: boolean; remaining: number; limit: number }
  chatMessages: { allowed: boolean; remaining: number; limit: number }
}

interface Props {
  userId: string
  tier: 'free' | 'family' | 'school'
}

export default function UsageQuota({ userId, tier }: Props) {
  const [quota, setQuota] = useState<QuotaData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchQuota()
  }, [userId, tier])

  const fetchQuota = async () => {
    try {
      const response = await fetch(`/api/ai/usage?userId=${userId}&tier=${tier}`)
      const data = await response.json()
      
      if (data.success) {
        setQuota(data.usage)
      }
    } catch (error) {
      console.error('Failed to fetch quota:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (!quota) return null

  const getPercentage = (remaining: number, limit: number) => {
    if (limit === -1) return 100
    return (remaining / limit) * 100
  }

  const getColor = (percentage: number) => {
    if (percentage > 50) return 'bg-green-500'
    if (percentage > 25) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const tierLabels = {
    free: { name: 'Free Plan', color: 'bg-gray-100 text-gray-800' },
    family: { name: 'Family Plan', color: 'bg-blue-100 text-blue-800' },
    school: { name: 'School Plan', color: 'bg-purple-100 text-purple-800' }
  }

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">🎯 AI Usage This Month</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${tierLabels[tier].color}`}>
          {tierLabels[tier].name}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">🤖 Career Analysis</span>
            <span className="font-bold text-gray-900">
              {quota.careerAnalysis.limit === -1 
                ? 'Unlimited' 
                : `${quota.careerAnalysis.remaining}/${quota.careerAnalysis.limit}`
              }
            </span>
          </div>
          {quota.careerAnalysis.limit !== -1 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${getColor(getPercentage(quota.careerAnalysis.remaining, quota.careerAnalysis.limit))}`}
                style={{ width: `${getPercentage(quota.careerAnalysis.remaining, quota.careerAnalysis.limit)}%` }}
              />
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">📚 Learning Plans</span>
            <span className="font-bold text-gray-900">
              {quota.learningPlans.limit === -1 
                ? 'Unlimited' 
                : `${quota.learningPlans.remaining}/${quota.learningPlans.limit}`
              }
            </span>
          </div>
          {quota.learningPlans.limit !== -1 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${getColor(getPercentage(quota.learningPlans.remaining, quota.learningPlans.limit))}`}
                style={{ width: `${getPercentage(quota.learningPlans.remaining, quota.learningPlans.limit)}%` }}
              />
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">💬 Chat Messages</span>
            <span className="font-bold text-gray-900">
              {quota.chatMessages.limit === -1 
                ? 'Unlimited' 
                : `${quota.chatMessages.remaining}/${quota.chatMessages.limit}`
              }
            </span>
          </div>
          {quota.chatMessages.limit !== -1 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${getColor(getPercentage(quota.chatMessages.remaining, quota.chatMessages.limit))}`}
                style={{ width: `${getPercentage(quota.chatMessages.remaining, quota.chatMessages.limit)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {tier === 'free' && (
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-200">
          <div className="text-sm font-semibold text-blue-900 mb-2">
            🚀 Want More AI Power?
          </div>
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
            Upgrade to Family Plan
          </button>
        </div>
      )}
    </div>
  )
}