-- Jobs Radar — LinkedIn offers scorés par fit (Cowork daily scan).
-- Reconstitue le DDL des tables créées manuellement à l'origine.
-- Statut actuel en prod : tables présentes, RLS activée, policy UPDATE via `jobs_user_update`.

create table if not exists public.jobs (
  id                uuid primary key default gen_random_uuid(),
  linkedin_job_id   text unique,
  first_seen_date   date not null default current_date,
  last_seen_date    date not null default current_date,
  title             text not null,
  company           text not null,
  url               text not null,
  posted_date       date,
  role_category     text check (role_category in ('produit','rte','pgm','pjm','cos')),
  company_stage     text check (company_stage in ('seed','A','B','C','scale','grand_groupe')),
  pitch             text,
  compensation      text,
  score_seniority   numeric,
  score_sector      numeric,
  score_impact      numeric,
  score_bonus       integer default 0,
  score_total       numeric,
  rubric_justif     jsonb,
  cv_recommended    text check (cv_recommended in ('pdf','docx')),
  cv_reason         text,
  intel             jsonb,
  intel_depth       text default 'none' check (intel_depth in ('none','light','deep')),
  status            text default 'new' check (status in ('new','to_apply','applied','snoozed','archived')),
  user_notes        text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists jobs_status_score_idx on public.jobs (status, score_total desc);
create index if not exists jobs_first_seen_idx on public.jobs (first_seen_date desc);

create table if not exists public.job_scans (
  id                  uuid primary key default gen_random_uuid(),
  scan_date           date not null unique,
  raw_count           integer default 0,
  dedup_strict_count  integer default 0,
  processed_count     integer default 0,
  hot_leads_count     integer default 0,
  tendances           jsonb,
  signal_cv           jsonb,
  actions             jsonb,
  created_at          timestamptz default now()
);

-- Trigger: bump updated_at on jobs row edit
create or replace function public.jobs_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists jobs_touch_updated_at on public.jobs;
create trigger jobs_touch_updated_at before update on public.jobs
for each row execute function public.jobs_touch_updated_at();

-- RLS
alter table public.jobs      enable row level security;
alter table public.job_scans enable row level security;

drop policy if exists jobs_read_public on public.jobs;
create policy jobs_read_public on public.jobs
  for select using (true);

-- Frontend UPDATE allowed (status + user_notes only, policed by application layer).
-- The scan Cowork writes via service_role and bypasses RLS for all other columns.
drop policy if exists jobs_user_update on public.jobs;
create policy jobs_user_update on public.jobs
  for update using (true) with check (true);

drop policy if exists job_scans_read_public on public.job_scans;
create policy job_scans_read_public on public.job_scans
  for select using (true);
