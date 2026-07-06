// lib/learningSignal/types.ts
// Layer 1: the universal "did learning take place" primitive. Graph-free,
// subject/grade agnostic — works for any subject that has strand_assessments
// rows, not just Grade 7 Mathematics.

export type Movement = 'movedUp' | 'flat' | 'regressed' | 'insufficient_data'

export type TopicLearningDelta = {
  topic:            string
  strand:           string
  ratingT1:         number | null
  ratingT2:         number | null
  delta:            number | null   // ratingT2 - ratingT1, null when insufficient_data
  movement:         Movement
  crossedThreshold: boolean         // ratingT1 < MASTERY_THRESHOLD <= ratingT2
}

export type LearnerLearningReport = {
  learnerId: string
  subject:   string
  grade:     number
  fromDate:  string
  toDate:    string
  topics:    TopicLearningDelta[]
}

export type ClassTopicAggregate = {
  topic:           string
  strand:          string
  learnerCount:    number   // learners with usable data for this topic (excludes insufficient_data)
  movedUpCount:    number
  flatCount:       number
  regressedCount:  number
  pctMovedUp:      number   // 0-100, rounded
}

export type ClassLearningReport = {
  classId:  string
  subject:  string
  grade:    number
  fromDate: string
  toDate:   string
  topics:   ClassTopicAggregate[]
}
