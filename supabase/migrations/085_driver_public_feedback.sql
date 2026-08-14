-- Public feedback submitted by anyone who scans a driver's QR code - separate
-- from job-specific customer_rating/customer_feedback on jobs, since this
-- isn't tied to any particular delivery and anyone (not just a customer on a
-- completed job) can leave it.
create table if not exists driver_public_feedback (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('complaint', 'praise')),
  message text not null,
  submitter_name text,
  submitter_contact text,
  created_at timestamptz not null default now()
);

create index if not exists driver_public_feedback_driver_id_idx on driver_public_feedback(driver_id, created_at desc);

alter table driver_public_feedback enable row level security;

-- Anyone (including anonymous visitors who scanned a QR code) can submit
-- feedback - no account needed.
drop policy if exists "anyone can submit driver feedback" on driver_public_feedback;
create policy "anyone can submit driver feedback" on driver_public_feedback
for insert with check (true);

-- Feedback is publicly readable (shown on the driver's own public profile
-- page) and fully visible to admin.
drop policy if exists "driver feedback is publicly readable" on driver_public_feedback;
create policy "driver feedback is publicly readable" on driver_public_feedback
for select using (true);

grant select, insert on driver_public_feedback to anon, authenticated;

-- Safe, narrow public view of a driver for the QR-code profile page - only
-- exposes name, photo, and active status, never phone/PII, and only for
-- profiles that are actually drivers (not any arbitrary profile id).
create or replace function get_driver_public_profile(p_driver_id uuid)
returns table(full_name text, photo_url text, is_active boolean)
language sql
security definer
stable
as $$
  select full_name, photo_url, is_active
  from profiles
  where id = p_driver_id and role = 'driver';
$$;
grant execute on function get_driver_public_profile(uuid) to anon, authenticated;

-- Aggregate rating for the same public profile page, computed from
-- completed jobs only.
create or replace function get_driver_public_rating(p_driver_id uuid)
returns table(avg_rating numeric, rating_count int)
language sql
security definer
stable
as $$
  select round(avg(customer_rating)::numeric, 1), count(customer_rating)::int
  from jobs
  where driver_id = p_driver_id and status = 'completed' and customer_rating is not null;
$$;
grant execute on function get_driver_public_rating(uuid) to anon, authenticated;
