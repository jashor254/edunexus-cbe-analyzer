'use client'

import type { IntegratedLearningPlan } from '@/lib/ai/careerAnalysis'

interface Props {
  plan: IntegratedLearningPlan
}

export default function IntegratedLearningPlanDisplay({ plan }: Props) {
  const getLevelBadge = (level: number) => {
    const configs = {
      1: { label: 'BE', color: 'bg-red-100 text-red-800', icon: '🔴' },
      2: { label: 'AE', color: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
      3: { label: 'ME', color: 'bg-green-100 text-green-800', icon: '🟢' },
      4: { label: 'EE', color: 'bg-blue-100 text-blue-800', icon: '🔵' },
    }
    return configs[level as keyof typeof configs] || configs[1]
  }

  const currentBadge = getLevelBadge(plan.currentLevel)
  const targetBadge = getLevelBadge(plan.targetLevel)

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border-2 border-purple-300 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-purple-900 mb-2">
            🎯 Career-Integrated Learning Plan
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-gray-700">{plan.subject}</span>
            <span className="text-gray-400">→</span>
            <span className="text-lg font-semibold text-purple-700">{plan.career}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${currentBadge.color}`}>
            {currentBadge.icon} Level {plan.currentLevel}
          </div>
          <span className="text-gray-400">→</span>
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${targetBadge.color}`}>
            {targetBadge.icon} Level {plan.targetLevel}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 mb-4 border-2 border-purple-200">
        <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2 text-lg">
          <span className="text-2xl">💡</span> Why This Matters for Your Career
        </h4>
        <p className="text-gray-800 leading-relaxed text-base">{plan.whyItMatters}</p>
      </div>

      <div className="bg-white rounded-lg p-5 mb-4">
        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-xl">🎯</span> Your Career-Focused Action Plan
        </h4>
        <ol className="space-y-3">
          {plan.careerSpecificSteps.map((step, idx) => (
            <li key={idx} className="flex gap-3">
              <span className="font-bold text-purple-600 text-lg min-w-[28px]">
                {idx + 1}.
              </span>
              <span className="text-gray-700 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="bg-white rounded-lg p-5 mb-4">
        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-xl">📚</span> Career-Aligned Resources
        </h4>
        <ul className="space-y-2">
          {plan.careerSpecificResources.map((resource, idx) => (
            <li key={idx} className="flex gap-2 items-start">
              <span className="text-purple-500 mt-1">✓</span>
              <span className="text-gray-700">{resource}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-5 mb-4 border-2 border-yellow-200">
        <h4 className="font-bold text-orange-900 mb-4 flex items-center gap-2">
          <span className="text-xl">⭐</span> Inspiring Success Stories
        </h4>
        <div className="space-y-3">
          {plan.successStories.map((story, idx) => (
            <div key={idx} className="bg-white rounded-lg p-3">
              <p className="text-sm text-gray-700 italic">&quot;{story}&quot;</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-xl">🗓️</span> Your 3-Month Milestone Journey
        </h4>
        <div className="space-y-4">
          {plan.milestones.map((milestone, idx) => (
            <div key={idx} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                  {milestone.month}
                </div>
                {idx < plan.milestones.length - 1 && (
                  <div className="w-0.5 h-12 bg-purple-200 my-1"></div>
                )}
              </div>
              <div className="flex-1 pb-4">
                <div className="font-bold text-gray-900 mb-1">{milestone.goal}</div>
                <div className="text-sm text-purple-700 bg-purple-50 rounded-lg p-2">
                  🎯 <strong>Career Link:</strong> {milestone.careerRelevance}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-4 text-center">
        <p className="text-white font-semibold text-lg">
          🚀 Stay focused on your {plan.career} dream! Every step counts!
        </p>
      </div>
    </div>
  )
}