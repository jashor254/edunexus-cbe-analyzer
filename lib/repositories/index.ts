import { AcademyRepository } from './academy.repository'
import { AnalyticsRepository } from './analytics.repository'
import { AssessmentRepository } from './assessment.repository'
import { AssessmentTypeRepository } from './assessmentType.repository'
import { AttendanceRepository } from './attendance.repository'
import { BillingRepository } from './billing.repository'
import { BlueprintSnapshotRepository } from './blueprintSnapshot.repository'
import { CareerRepository } from './career.repository'
import { CompassRepository } from './compass.repository'
import { CurriculumRepository } from './curriculum.repository'
import { DeveloperRepository } from './developer.repository'
import { EvidenceRepository } from './evidence.repository'
import { EvidencePurposeRepository } from './evidencePurpose.repository'
import { IntelligenceRepository } from './intelligence.repository'
import { JobRepository } from './job.repository'
import { KnowledgeGraphRepository } from './knowledge-graph.repository'
import { LearnerIntelligenceRepository } from './learner-intelligence.repository'
import { LearnerModelRepository } from './learner-model.repository'
import { LearnerRepository } from './learner.repository'
import { LearningSignalRepository } from './learning-signal.repository'
import { NotificationRepository } from './notification.repository'
import { OrganizationRepository } from './organization.repository'
import { PortfolioRepository } from './portfolio.repository'
import { ProjectionRepository } from './projection.repository'
import { PromotionRepository } from './promotion.repository'
import { SchoolRepository } from './school.repository'
import { TeacherRepository } from './teacher.repository'
import { TeacherReflectionRepository } from './teacherReflection.repository'
import { WebhookRepository } from './webhook.repository'

export const repos = {
  academy:             new AcademyRepository(),
  analytics:           new AnalyticsRepository(),
  assessments:         new AssessmentRepository(),
  assessmentTypes:     new AssessmentTypeRepository(),
  attendance:          new AttendanceRepository(),
  billing:             new BillingRepository(),
  blueprintSnapshots:  new BlueprintSnapshotRepository(),
  careers:             new CareerRepository(),
  compass:             new CompassRepository(),
  curriculum:          new CurriculumRepository(),
  developers:          new DeveloperRepository(),
  evidence:            new EvidenceRepository(),
  evidencePurposes:    new EvidencePurposeRepository(),
  intelligence:        new IntelligenceRepository(),
  jobs:                new JobRepository(),
  knowledgeGraph:      new KnowledgeGraphRepository(),
  learnerIntelligence: new LearnerIntelligenceRepository(),
  learnerModel:        new LearnerModelRepository(),
  learners:            new LearnerRepository(),
  learningSignal:      new LearningSignalRepository(),
  notifications:       new NotificationRepository(),
  organizations:       new OrganizationRepository(),
  portfolios:          new PortfolioRepository(),
  projections:         new ProjectionRepository(),
  promotions:          new PromotionRepository(),
  schools:             new SchoolRepository(),
  teachers:            new TeacherRepository(),
  teacherReflections:  new TeacherReflectionRepository(),
  webhooks:            new WebhookRepository(),
}

export type Repos = typeof repos

export { AcademyRepository } from './academy.repository'
export { AnalyticsRepository } from './analytics.repository'
export { AssessmentRepository } from './assessment.repository'
export { AssessmentTypeRepository } from './assessmentType.repository'
export { AttendanceRepository } from './attendance.repository'
export { BillingRepository } from './billing.repository'
export { CareerRepository } from './career.repository'
export { CompassRepository } from './compass.repository'
export { CurriculumRepository } from './curriculum.repository'
export { DeveloperRepository } from './developer.repository'
export { EvidenceRepository } from './evidence.repository'
export { EvidencePurposeRepository } from './evidencePurpose.repository'
export { IntelligenceRepository } from './intelligence.repository'
export { JobRepository } from './job.repository'
export { KnowledgeGraphRepository } from './knowledge-graph.repository'
export { LearnerIntelligenceRepository } from './learner-intelligence.repository'
export { LearnerModelRepository } from './learner-model.repository'
export { LearnerRepository } from './learner.repository'
export { LearningSignalRepository } from './learning-signal.repository'
export { NotificationRepository } from './notification.repository'
export { OrganizationRepository } from './organization.repository'
export { PortfolioRepository } from './portfolio.repository'
export { ProjectionRepository } from './projection.repository'
export { PromotionRepository } from './promotion.repository'
export { SchoolRepository } from './school.repository'
export { TeacherRepository } from './teacher.repository'
export { TeacherReflectionRepository } from './teacherReflection.repository'
export { WebhookRepository } from './webhook.repository'
