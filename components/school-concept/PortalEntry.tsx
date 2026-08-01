import { CapabilityEntry } from './CapabilityEntry'
import type { ResolvedSchoolCapability } from '@/data/schoolConcepts/types'

/** Generic shared portal-entry surface. Renders nothing when the school has
 * no enabled authenticated capabilities, and one restrained entry link per
 * resolved capability otherwise — never a "School Portal" launcher UI, and
 * never a hardcoded reference to any specific capability. A school with
 * zero, one, or (later) several enabled capabilities all flow through this
 * same, unmodified component; only the list length differs. */
export function PortalEntry({ capabilities }: { capabilities: ResolvedSchoolCapability[] }) {
  if (capabilities.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {capabilities.map((capability) => (
        <CapabilityEntry key={capability.id} capability={capability} />
      ))}
    </div>
  )
}
