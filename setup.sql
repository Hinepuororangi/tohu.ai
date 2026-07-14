-- Te Reo Repetition & Practice Engine — Supabase setup
-- Run in Supabase SQL Editor. Confirm your existing Kupu Bank table name/prefix
-- before running — this assumes th_frame already exists; adjust if it's named differently.

-- 1. Extend the existing frame table (skip if these columns already exist)
alter table th_frame add column if not exists verified boolean default false;
alter table th_frame add column if not exists status text default 'unverified';
-- status: 'unverified' | 'no_source_found' | 'verified'

-- 2. Rep log — the evidence trail, never edited after creation
create table if not exists th_rep_log (
  id uuid primary key default gen_random_uuid(),
  frame_id uuid references th_frame(id) on delete cascade,
  logged_at timestamptz not null default now(),
  method text not null, -- 'tap' | 'voice_note' | 'text_note'
  raw_text text,
  week_start date not null,
  created_at timestamptz not null default now()
);

-- 3. Schedule — one active reminder per frame
create table if not exists th_schedule (
  id uuid primary key default gen_random_uuid(),
  frame_id uuid references th_frame(id) on delete cascade,
  time_of_day time not null default '07:30',
  days_active text[] not null default array['mon','tue','wed','thu','fri'],
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS: enable and add explicit policies (Lesson 12 — enabling RLS without
-- policies blocks all queries). Adjust for your actual auth setup —
-- this assumes single-user, public anon access via publishable key,
-- matching the rest of the shared Supabase project's pattern.

alter table th_rep_log enable row level security;
alter table th_schedule enable row level security;

create policy "allow all on th_rep_log" on th_rep_log
  for all using (true) with check (true);

create policy "allow all on th_schedule" on th_schedule
  for all using (true) with check (true);
