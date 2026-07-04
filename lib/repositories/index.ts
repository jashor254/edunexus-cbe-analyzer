import { LearnerModelRepository } from './learner-model.repository'
import { NotificationRepository } from './notification.repository'

export const repos = {
  learnerModel:  new LearnerModelRepository(),
  notifications: new NotificationRepository(),
}

export type Repos = typeof repos

export { LearnerModelRepository } from './learner-model.repository'
export { NotificationRepository } from './notification.repository'
