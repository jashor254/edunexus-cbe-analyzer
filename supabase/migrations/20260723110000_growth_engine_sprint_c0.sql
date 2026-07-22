-- Growth Engine — Sprint C0 (Commercial Foundation)
-- Schools, Contacts, Activities, Follow-ups, Pipeline (enum on growth_schools).
-- Additive only, per docs/growth-os/edunexus-growth-engine-implementation-blueprint.md §2.
-- Separate bounded context from the learner platform — no FKs into learner tables.

-- growth_users: one row per Growth OS user. Mode 1 = exactly one row (the founder),
-- self-registered on first authenticated Growth Engine API call (no seed data needed
-- since we don't know the founder's auth.users id ahead of a migration).
create table if not exists growth_users (
  id uuid primary key references auth.users(id),
  full_name text not null,
  role text not null default 'founder' check (role in ('founder')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table growth_users enable row level security;

create policy growth_users_select_own on growth_users
  for select using (id = auth.uid());

create policy growth_users_insert_own on growth_users
  for insert with check (id = auth.uid());

create policy growth_users_update_own on growth_users
  for update using (id = auth.uid());

-- Shared predicate for every other growth_* table's RLS: "is this caller a
-- registered Growth OS user at all." Mode 1 has exactly one such user, so this
-- is effectively founder-only without hardcoding an id anywhere.
create or replace function is_growth_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from growth_users where id = auth.uid());
$$;

-- growth_schools: the hub. Pipeline stage lives here directly in Sprint C0
-- (hardcoded enum, no growth_pipeline_stages table yet — promoted later per
-- the Blueprint's Phase 1 "trigger-based, not calendar-based" sprint).
create table if not exists growth_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  county text,
  category text,
  students_count int,
  status text not null default 'active' check (status in ('active', 'dormant', 'lost')),
  pipeline_stage text not null default 'research' check (pipeline_stage in (
    'research', 'contacted', 'discovery', 'demo_scheduled', 'demo_completed',
    'pilot_offered', 'pilot_running', 'pilot_won', 'deferred', 'lost'
  )),
  next_action text,
  next_action_date date,
  owner_id uuid references growth_users(id),
  notes text,
  last_contact_at timestamptz,
  created_by uuid references growth_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_schools_owner_id_idx on growth_schools (owner_id);
create index if not exists growth_schools_pipeline_stage_idx on growth_schools (pipeline_stage);
create index if not exists growth_schools_county_idx on growth_schools (county);

alter table growth_schools enable row level security;

create policy growth_schools_all on growth_schools
  for all using (is_growth_user()) with check (is_growth_user());

-- growth_contacts
create table if not exists growth_contacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references growth_schools(id) on delete cascade,
  role text check (role in ('principal', 'deputy', 'dos', 'ict_teacher', 'other')),
  full_name text not null,
  phone text,
  email text,
  preferred_contact text check (preferred_contact in ('call', 'whatsapp', 'email')),
  relationship_score int check (relationship_score between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_contacts_school_id_idx on growth_contacts (school_id);

alter table growth_contacts enable row level security;

create policy growth_contacts_all on growth_contacts
  for all using (is_growth_user()) with check (is_growth_user());

-- growth_activities: the timeline. Append-mostly — updates are limited to the
-- notes field via the service layer, never a wholesale rewrite of what happened.
create table if not exists growth_activities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references growth_schools(id) on delete cascade,
  contact_id uuid references growth_contacts(id),
  type text not null check (type in (
    'called', 'visited', 'whatsapp', 'email', 'meeting', 'demo', 'training', 'support'
  )),
  notes text,
  occurred_at timestamptz not null default now(),
  created_by uuid references growth_users(id),
  created_at timestamptz not null default now()
);

create index if not exists growth_activities_school_id_idx on growth_activities (school_id);
create index if not exists growth_activities_contact_id_idx on growth_activities (contact_id);

alter table growth_activities enable row level security;

create policy growth_activities_all on growth_activities
  for all using (is_growth_user()) with check (is_growth_user());

-- growth_follow_ups: "who needs me tomorrow."
create table if not exists growth_follow_ups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references growth_schools(id) on delete cascade,
  task text not null,
  due_date date not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid references growth_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists growth_follow_ups_school_id_idx on growth_follow_ups (school_id);
create index if not exists growth_follow_ups_due_date_idx on growth_follow_ups (due_date) where not completed;

alter table growth_follow_ups enable row level security;

create policy growth_follow_ups_all on growth_follow_ups
  for all using (is_growth_user()) with check (is_growth_user());
