-- Mirror auth email onto profiles so admin actions (password reset, etc.)
-- don't need the service-role key just to look up an address.
alter table profiles add column if not exists email text;

update profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Notification preferences
alter table profiles add column if not exists sms_notifications_opt_in boolean not null default true;

-- ============================================
-- JOB CHAT
-- ============================================
create table if not exists job_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  sender_id uuid references profiles(id),
  sender_role text not null check (sender_role in ('driver', 'org_member', 'org_admin', 'platform_admin', 'customer')),
  sender_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table job_messages enable row level security;

create policy "view messages for own jobs" on job_messages
  for select using (
    exists (
      select 1 from jobs j
      where j.id = job_messages.job_id
      and (j.organization_id = my_org_id() or j.driver_id = auth.uid() or my_role() = 'platform_admin')
    )
  );

create policy "send messages on own jobs" on job_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from jobs j
      where j.id = job_messages.job_id
      and (j.organization_id = my_org_id() or j.driver_id = auth.uid() or my_role() = 'platform_admin')
    )
  );

grant select, insert on job_messages to authenticated;

alter publication supabase_realtime add table job_messages;

-- Lets an anonymous customer read and send chat messages using only their
-- tracking token — same pattern as get_tracking_info() / submit_customer_feedback().
create or replace function get_tracking_messages(p_token uuid)
returns table (
  id uuid,
  sender_role text,
  sender_name text,
  body text,
  created_at timestamptz
) language sql stable security definer as $$
  select m.id, m.sender_role, m.sender_name, m.body, m.created_at
  from job_messages m
  join jobs j on j.id = m.job_id
  where j.tracking_token = p_token
  order by m.created_at asc;
$$;

grant execute on function get_tracking_messages(uuid) to anon, authenticated;

create or replace function send_tracking_message(p_token uuid, p_body text)
returns void language plpgsql security definer as $$
declare
  v_job_id uuid;
  v_customer_name text;
begin
  select id, coalesce(customer_full_name, recipient_name, 'Customer')
  into v_job_id, v_customer_name
  from jobs where tracking_token = p_token;

  if v_job_id is null then
    raise exception 'Invalid tracking link';
  end if;

  insert into job_messages (job_id, sender_id, sender_role, sender_name, body)
  values (v_job_id, null, 'customer', v_customer_name, p_body);
end;
$$;

grant execute on function send_tracking_message(uuid, text) to anon, authenticated;
