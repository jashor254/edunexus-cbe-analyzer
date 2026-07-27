'use client'

// components/blueprint/actionPlan/BlueprintActionPlanSection.tsx
//
// The teacher-only "Blueprint Action Plan" section (Phase 3A) — the one
// coherent workflow surface: inspect an approved action, deliver it,
// see its status, and jump to the existing Review Workspace. Owns only UI
// state (which delivery panel is open, for which action) — every read
// comes from the server-rendered `items` prop
// (`listReviewableBlueprintActionsForLearner()`), every write goes through
// the existing Phase 2B/2C routes via the two delivery panels.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ReviewableActionListItem } from '@/lib/learnerBlueprint/actionPlan/reviewWorkspace'
import BlueprintActionPlanCard from './BlueprintActionPlanCard'
import AssignmentDeliveryPanel, { type AssignmentDeliveryResult } from './AssignmentDeliveryPanel'
import CompassDeliveryPanel, { type CompassDeliveryResult } from './CompassDeliveryPanel'

type OpenPanel = { actionId: string; kind: 'assignment' | 'compass' } | null

export default function BlueprintActionPlanSection({
  learnerId,
  items: initialItems,
}: {
  learnerId: string
  items: ReviewableActionListItem[]
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [announcement, setAnnouncement] = useState<string | null>(null)

  const openItem = openPanel ? items.find(i => i.actionId === openPanel.actionId) ?? null : null

  function handleAssignmentDelivered(actionId: string, result: AssignmentDeliveryResult) {
    setItems(prev => prev.map(i => i.actionId === actionId ? { ...i, assignmentDelivered: true, assignmentId: result.assignment.id } : i))
    setAnnouncement(result.alreadyDelivered ? 'This action was already delivered as an assignment.' : 'Assignment created and delivered to the class.')
    setOpenPanel(null)
    router.refresh()
  }

  function handleCompassDelivered(actionId: string, result: CompassDeliveryResult) {
    setItems(prev => prev.map(i => i.actionId === actionId ? { ...i, compassDelivered: true } : i))
    setAnnouncement(result.alreadyDelivered ? 'This action was already available in Learning Compass.' : 'Objective is now available in Learning Compass.')
    setOpenPanel(null)
    router.refresh()
  }

  if (items.length === 0) {
    return (
      <section aria-labelledby="action-plan-heading" className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
        <h2 id="action-plan-heading" className="text-sm font-black text-gray-900 mb-1">Blueprint Action Plan</h2>
        <p className="text-sm text-gray-500">No approved Blueprint actions are available yet.</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="action-plan-heading" className="space-y-3">
      <h2 id="action-plan-heading" className="text-sm font-black text-gray-900 uppercase tracking-wide">Blueprint Action Plan</h2>
      <div aria-live="polite" className="sr-only">{announcement}</div>
      {announcement && (
        <div role="status" className="text-sm font-bold text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
          {announcement}
        </div>
      )}

      <div className="space-y-3">
        {items.map(item => (
          <BlueprintActionPlanCard
            key={item.actionId}
            item={item}
            learnerId={learnerId}
            onOpenAssignmentDelivery={() => setOpenPanel({ actionId: item.actionId, kind: 'assignment' })}
            onOpenCompassDelivery={() => setOpenPanel({ actionId: item.actionId, kind: 'compass' })}
          />
        ))}
      </div>

      {openItem && openPanel?.kind === 'assignment' && (
        <AssignmentDeliveryPanel
          actionId={openItem.actionId}
          actionTitle={openItem.title}
          learnerAction={openItem.learnerAction}
          intendedOutcome={openItem.intendedOutcome}
          successIndicator={openItem.successIndicator}
          onClose={() => setOpenPanel(null)}
          onDelivered={result => handleAssignmentDelivered(openItem.actionId, result)}
        />
      )}
      {openItem && openPanel?.kind === 'compass' && (
        <CompassDeliveryPanel
          actionId={openItem.actionId}
          actionTitle={openItem.title}
          learnerAction={openItem.learnerAction}
          intendedOutcome={openItem.intendedOutcome}
          successIndicator={openItem.successIndicator}
          onClose={() => setOpenPanel(null)}
          onDelivered={result => handleCompassDelivered(openItem.actionId, result)}
        />
      )}
    </section>
  )
}
