-- Discovered by H1D-3C D1 expansion (lib/projection/careerPropagation.integration.test.ts)
-- via getOrCreateLearnerProfile's ON CONFLICT (student_id) upsert. Live in
-- production, absent from every tracked migration / loose file that
-- creates learner_profiles locally.

ALTER TABLE learner_profiles ADD CONSTRAINT learner_profiles_student_id_key UNIQUE (student_id);
