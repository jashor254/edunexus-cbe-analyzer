import { AcademyRepository } from './academy.repository'
import { AchievementRepository } from './achievement.repository'
import { AnalyticsRepository } from './analytics.repository'
import { AssessmentRepository } from './assessment.repository'
import { AssessmentTypeRepository } from './assessmentType.repository'
import { AttendanceRepository } from './attendance.repository'
import { BillingRepository } from './billing.repository'
import { BlueprintSnapshotRepository } from './blueprintSnapshot.repository'
import { CareerRepository } from './career.repository'
import { ClassCalendarRepository } from './classCalendar.repository'
import { ClassResourceRepository } from './classResource.repository'
import { CompassRepository } from './compass.repository'
import { CompetitionRepository } from './competition.repository'
import { CurriculumRepository } from './curriculum.repository'
import { DeveloperRepository } from './developer.repository'
import { EvidenceRepository } from './evidence.repository'
import { EvidencePurposeRepository } from './evidencePurpose.repository'
import { InnovationRepository } from './innovation.repository'
import { IntelligenceRepository } from './intelligence.repository'
import { JobRepository } from './job.repository'
import { KnowledgeGraphRepository } from './knowledge-graph.repository'
import { LeadershipRepository } from './leadership.repository'
import { LearnerIntelligenceRepository } from './learner-intelligence.repository'
import { LearnerModelRepository } from './learner-model.repository'
import { LearnerRepository } from './learner.repository'
import { LearningSignalRepository } from './learning-signal.repository'
import { NotificationRepository } from './notification.repository'
import { OrganizationRepository } from './organization.repository'
import { PortfolioRepository } from './portfolio.repository'
import { ProjectRepository } from './project.repository'
import { ProjectionRepository } from './projection.repository'
import { PromotionRepository } from './promotion.repository'
import { SchoolRepository } from './school.repository'
import { TeacherRepository } from './teacher.repository'
import { TeacherReflectionRepository } from './teacherReflection.repository'
import { WebhookRepository } from './webhook.repository'
import { WellbeingRepository } from './wellbeing.repository'

export const repos = {
  academy:             new AcademyRepository(),
  achievements:        new AchievementRepository(),
  analytics:           new AnalyticsRepository(),
  assessments:         new AssessmentRepository(),
  assessmentTypes:     new AssessmentTypeRepository(),
  attendance:          new AttendanceRepository(),
  billing:             new BillingRepository(),
  blueprintSnapshots:  new BlueprintSnapshotRepository(),
  careers:             new CareerRepository(),
  compass:             new CompassRepository(),
  // Deliberately distinct naming from `achievements` above — Competitions
  // (the live, external, multi-week process, ADR-0014) and Achievement
  // (the after-the-fact verified claim, ADR-0012) are related but never
  // the same domain. See ADR-0014 Phase 1.
  competitions:        new CompetitionRepository(),
  classCalendar:       new ClassCalendarRepository(),
  classResources:      new ClassResourceRepository(),
  curriculum:          new CurriculumRepository(),
  developers:          new DeveloperRepository(),
  evidence:            new EvidenceRepository(),
  evidencePurposes:    new EvidencePurposeRepository(),
  innovations:         new InnovationRepository(),
  intelligence:        new IntelligenceRepository(),
  jobs:                new JobRepository(),
  knowledgeGraph:      new KnowledgeGraphRepository(),
  // Deliberately distinct naming from `achievements` above — Leadership
  // (the ongoing, reviewable service, ADR-0015) and Achievement (the
  // after-the-fact recognition, ADR-0012) are related but never the same
  // domain, mirroring the identical `competitions`/`achievements` split.
  leadership:          new LeadershipRepository(),
  learnerIntelligence: new LearnerIntelligenceRepository(),
  learnerModel:        new LearnerModelRepository(),
  learners:            new LearnerRepository(),
  learningSignal:      new LearningSignalRepository(),
  notifications:       new NotificationRepository(),
  organizations:       new OrganizationRepository(),
  portfolios:          new PortfolioRepository(),
  // Note the deliberate naming distinction from `projections` below —
  // "Projects" (learner-created work, ADR-0013) and "Projection" (the
  // Learner Intelligence computed-state engine) are unrelated domains
  // that happen to share five letters. See ADR-0013 Phase 1.
  projects:            new ProjectRepository(),
  projections:         new ProjectionRepository(),
  promotions:          new PromotionRepository(),
  schools:             new SchoolRepository(),
  teachers:            new TeacherRepository(),
  teacherReflections:  new TeacherReflectionRepository(),
  webhooks:            new WebhookRepository(),
  // Access to this domain's tables is Support-Team-scoped, not the
  // blanket school-staff-read pattern every other repository above relies
  // on for RLS — lib/learnerWellbeing/ enforces this explicitly at the
  // service layer; see ADR-0017 Phase 8.
  wellbeing:           new WellbeingRepository(),
}

export type Repos = typeof repos

export { AcademyRepository } from './academy.repository'
export { AchievementRepository } from './achievement.repository'
export { AnalyticsRepository } from './analytics.repository'
export { AssessmentRepository } from './assessment.repository'
export { AssessmentTypeRepository } from './assessmentType.repository'
export { AttendanceRepository } from './attendance.repository'
export { BillingRepository } from './billing.repository'
export { CareerRepository } from './career.repository'
export { ClassCalendarRepository } from './classCalendar.repository'
export { ClassResourceRepository } from './classResource.repository'
export { CompassRepository } from './compass.repository'
export { CompetitionRepository } from './competition.repository'
export { CurriculumRepository } from './curriculum.repository'
export { DeveloperRepository } from './developer.repository'
export { EvidenceRepository } from './evidence.repository'
export { EvidencePurposeRepository } from './evidencePurpose.repository'
export { InnovationRepository } from './innovation.repository'
export { IntelligenceRepository } from './intelligence.repository'
export { JobRepository } from './job.repository'
export { KnowledgeGraphRepository } from './knowledge-graph.repository'
export { LeadershipRepository } from './leadership.repository'
export { LearnerIntelligenceRepository } from './learner-intelligence.repository'
export { LearnerModelRepository } from './learner-model.repository'
export { LearnerRepository } from './learner.repository'
export { LearningSignalRepository } from './learning-signal.repository'
export { NotificationRepository } from './notification.repository'
export { OrganizationRepository } from './organization.repository'
export { PortfolioRepository } from './portfolio.repository'
export { ProjectRepository } from './project.repository'
export { ProjectionRepository } from './projection.repository'
export { PromotionRepository } from './promotion.repository'
export { SchoolRepository } from './school.repository'
export { TeacherRepository } from './teacher.repository'
export { TeacherReflectionRepository } from './teacherReflection.repository'
export { WebhookRepository } from './webhook.repository'
export { WellbeingRepository } from './wellbeing.repository'
