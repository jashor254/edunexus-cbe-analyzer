import { AcademyRepository } from './academy.repository'
import { AnalyticsRepository } from './analytics.repository'
import { AssessmentRepository } from './assessment.repository'
import { BillingRepository } from './billing.repository'
import { CareerRepository } from './career.repository'
import { CompassRepository } from './compass.repository'
import { CurriculumRepository } from './curriculum.repository'
import { DeveloperRepository } from './developer.repository'
import { JobRepository } from './job.repository'
import { KnowledgeGraphRepository } from './knowledge-graph.repository'
import { LearnerIntelligenceRepository } from './learner-intelligence.repository'
import { LearnerModelRepository } from './learner-model.repository'
import { LearnerRepository } from './learner.repository'
import { NotificationRepository } from './notification.repository'
import { OrganizationRepository } from './organization.repository'
import { SchoolRepository } from './school.repository'
import { TeacherRepository } from './teacher.repository'
import { WebhookRepository } from './webhook.repository'

export const repos = {
  academy:             new AcademyRepository(),
  analytics:           new AnalyticsRepository(),
  assessments:         new AssessmentRepository(),
  billing:             new BillingRepository(),
  careers:             new CareerRepository(),
  compass:             new CompassRepository(),
  curriculum:          new CurriculumRepository(),
  developers:          new DeveloperRepository(),
  jobs:                new JobRepository(),
  knowledgeGraph:      new KnowledgeGraphRepository(),
  learnerIntelligence: new LearnerIntelligenceRepository(),
  learnerModel:        new LearnerModelRepository(),
  learners:            new LearnerRepository(),
  notifications:       new NotificationRepository(),
  organizations:       new OrganizationRepository(),
  schools:             new SchoolRepository(),
  teachers:            new TeacherRepository(),
  webhooks:            new WebhookRepository(),
}

export type Repos = typeof repos

export { AcademyRepository } from './academy.repository'
export { AnalyticsRepository } from './analytics.repository'
export { AssessmentRepository } from './assessment.repository'
export { BillingRepository } from './billing.repository'
export { CareerRepository } from './career.repository'
export { CompassRepository } from './compass.repository'
export { CurriculumRepository } from './curriculum.repository'
export { DeveloperRepository } from './developer.repository'
export { JobRepository } from './job.repository'
export { KnowledgeGraphRepository } from './knowledge-graph.repository'
export { LearnerIntelligenceRepository } from './learner-intelligence.repository'
export { LearnerModelRepository } from './learner-model.repository'
export { LearnerRepository } from './learner.repository'
export { NotificationRepository } from './notification.repository'
export { OrganizationRepository } from './organization.repository'
export { SchoolRepository } from './school.repository'
export { TeacherRepository } from './teacher.repository'
export { WebhookRepository } from './webhook.repository'
