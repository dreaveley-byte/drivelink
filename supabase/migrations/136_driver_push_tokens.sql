-- Stores each driver's device token for sending real push notifications
-- (works even with the app closed/phone locked) - a driver can have
-- multiple tokens if they've logged in on more than one device, so this
-- isn't just a column on profiles.
create table if not exists driver_push_tokens (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references profiles(id) on delete cascade,
  device_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (driver_id, device_token)
);

alter table driver_push_tokens enable row level security;

create policy "drivers manage own push tokens" on driver_push_tokens
  for all using (driver_id = auth.uid()) with check (driver_id = auth.uid());

create policy "admin reads push tokens" on driver_push_tokens
  for select using (my_role() = 'platform_admin');

grant select, insert, update, delete on driver_push_tokens to authenticated;

-- Active driver push tokens for the "new job posted" notification. There's
-- no location tracking for a driver while they're NOT on an active job
-- (deliberately, per the privacy policy - Drivflo doesn't track idle
-- drivers), so this can't be filtered by proximity without building a
-- separate, privacy-sensitive background-location feature. Notifies every
-- active driver instead - simple, and reasonable at the scale this
-- platform operates at today.
create or replace function get_active_driver_push_tokens()
returns table (driver_id uuid, device_token text, platform text)
language sql
stable
as $$
  select dpt.driver_id, dpt.device_token, dpt.platform
  from driver_push_tokens dpt
  join profiles p on p.id = dpt.driver_id
  where p.role = 'driver' and p.is_active = true;
$$;

grant execute on function get_active_driver_push_tokens() to authenticated;
