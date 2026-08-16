-- Recovered from production migrations 20260327105503/513/515/525
-- (create_study_groups, create_study_group_members, create_study_group_challenges,
-- create_study_group_answers) — exact statement text, H1M-R2.
-- Original policies preserved here on purpose; db_security_hardening_phase11
-- (applied later in the replay) is responsible for tightening
-- study_group_challenges' INSERT policy — do not pre-correct it here.

CREATE TABLE IF NOT EXISTS public.study_groups (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text        NOT NULL,
  subject      text        NOT NULL,
  grade        integer     NOT NULL,
  invite_code  text        NOT NULL UNIQUE,
  created_by   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ground_rules text[]      DEFAULT '{}',
  status       text        NOT NULL DEFAULT 'active',
  max_members  integer     NOT NULL DEFAULT 8,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_groups_invite_code ON public.study_groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_study_groups_created_by  ON public.study_groups(created_by);

ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read study groups"
  ON public.study_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create study groups"
  ON public.study_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update their groups"
  ON public.study_groups FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete their groups"
  ON public.study_groups FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TABLE IF NOT EXISTS public.study_group_members (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id     uuid        NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name text        NOT NULL,
  points       integer     NOT NULL DEFAULT 0,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_study_group_members_group_id ON public.study_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_study_group_members_user_id  ON public.study_group_members(user_id);

ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read group members"
  ON public.study_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join groups"
  ON public.study_group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own membership"
  ON public.study_group_members FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.study_group_challenges (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id       uuid        NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  date           date        NOT NULL,
  question       text        NOT NULL,
  correct_answer text        NOT NULL,
  hint           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, date)
);

CREATE INDEX IF NOT EXISTS idx_study_group_challenges_group_date ON public.study_group_challenges(group_id, date);

ALTER TABLE public.study_group_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read challenges"
  ON public.study_group_challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create challenges"
  ON public.study_group_challenges FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.study_group_answers (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id  uuid        NOT NULL REFERENCES public.study_group_challenges(id) ON DELETE CASCADE,
  group_id      uuid        NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name  text        NOT NULL,
  answer        text        NOT NULL,
  is_correct    boolean     NOT NULL DEFAULT false,
  is_anonymous  boolean     NOT NULL DEFAULT false,
  points_earned integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_study_group_answers_challenge_id ON public.study_group_answers(challenge_id);
CREATE INDEX IF NOT EXISTS idx_study_group_answers_group_id     ON public.study_group_answers(group_id);
CREATE INDEX IF NOT EXISTS idx_study_group_answers_user_id      ON public.study_group_answers(user_id);

ALTER TABLE public.study_group_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read answers"
  ON public.study_group_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can submit their own answers"
  ON public.study_group_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
