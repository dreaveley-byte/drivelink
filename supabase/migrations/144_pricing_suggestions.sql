-- Stores AI-generated pricing suggestions, triggered after a job
-- completes. Admin reviews and explicitly approves before anything is
-- ever applied to pricing_settings - this table records the suggestion,
-- the evidence behind it, and the eventual decision, so there's a full
-- audit trail of what changed and why.
create table if not exists pricing_suggestions (
  id uuid primary key default gen_random_uuid(),
  triggering_job_id uuid references jobs(id) on delete set null,
  title text not null,
  analysis_summary text not null,
  -- Only ever one of a small, safe allowlist of pure hourly-rate fields -
  -- enforced in application code, never safety/compliance settings.
  field_name text not null,
  current_value numeric not null,
  suggested_value numeric not null,
  similar_jobs_count int not null,
  avg_variance_percent numeric not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'applied')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table pricing_suggestions enable row level security;

create policy "admin manages pricing suggestions" on pricing_suggestions
  for all using (my_role() = 'platform_admin') with check (my_role() = 'platform_admin');

grant select, insert, update on pricing_suggestions to authenticated;
