-- Idle driver detection
alter table jobs add column if not exists idle_since timestamptz;
alter table jobs add column if not exists idle_alert_sent_at timestamptz;
alter table pricing_settings add column if not exists admin_alert_phone text;
alter table pricing_settings add column if not exists idle_alert_minutes numeric not null default 20;

-- Idle/wait-time fee counter (manually started/stopped by the driver at a stop)
alter table jobs add column if not exists wait_time_started_at timestamptz;
alter table jobs add column if not exists total_wait_minutes numeric not null default 0;
alter table jobs add column if not exists idle_fee_cents int not null default 0;
alter table pricing_settings add column if not exists idle_fee_grace_minutes numeric not null default 15;
alter table pricing_settings add column if not exists idle_fee_per_minute_cents int not null default 100;
