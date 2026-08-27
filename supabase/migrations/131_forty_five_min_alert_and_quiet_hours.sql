alter table jobs add column if not exists forty_five_min_away_alert_sent_at timestamptz;

-- Adjustable "no texts before this hour" setting, in Admin -> Pricing.
-- Default 8 (8am). Applies to routine notifications only - the
-- 45-minutes-away, 5-minutes-away, and arrived alerts are always sent
-- regardless of the hour, since they're time-critical for the customer
-- to actually be ready.
alter table pricing_settings add column if not exists quiet_hours_end_hour int not null default 8;

-- Queue for routine SMS that land during quiet hours, to be sent once
-- quiet hours end instead of skipped entirely. There's no reliable cron
-- on this infrastructure, so this gets flushed opportunistically from the
-- same GPS-ping-driven route that already handles proximity alerts -
-- same pattern already used for idle-driver detection.
create table if not exists pending_customer_sms (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  phone text not null,
  body text not null,
  send_after timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table pending_customer_sms enable row level security;

create policy "view pending sms for visible jobs" on pending_customer_sms
  for select using (job_id in (select id from jobs));

create policy "insert pending sms for own jobs" on pending_customer_sms
  for insert with check (
    job_id in (select id from jobs where driver_id = auth.uid() or organization_id = my_org_id() or my_role() = 'platform_admin')
  );

create policy "update pending sms for own jobs" on pending_customer_sms
  for update using (
    job_id in (select id from jobs where driver_id = auth.uid() or organization_id = my_org_id() or my_role() = 'platform_admin')
  );
