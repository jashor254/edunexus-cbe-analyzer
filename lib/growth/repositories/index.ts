import { GrowthUserRepository } from './growthUser.repository'
import { GrowthSchoolRepository } from './school.repository'
import { GrowthContactRepository } from './contact.repository'
import { GrowthActivityRepository } from './activity.repository'
import { GrowthFollowUpRepository } from './followUp.repository'

// Deliberately separate from `repos` (lib/repositories/index.ts) — the Growth
// Engine is its own bounded context (docs/growth-os/edunexus-growth-engine-specification.md §0)
// and must not be reachable from learner-platform code via a shared singleton.
export const growthRepos = {
  users: new GrowthUserRepository(),
  schools: new GrowthSchoolRepository(),
  contacts: new GrowthContactRepository(),
  activities: new GrowthActivityRepository(),
  followUps: new GrowthFollowUpRepository(),
}
