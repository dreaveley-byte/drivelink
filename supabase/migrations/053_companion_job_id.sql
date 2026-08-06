alter table jobs add column if not exists companion_job_id uuid references jobs(id) on delete set null;
