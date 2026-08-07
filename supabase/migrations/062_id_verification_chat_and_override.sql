alter table jobs add column if not exists id_verification_failed_attempts int not null default 0;
alter table jobs add column if not exists id_verification_manual_override boolean not null default false;
alter table jobs add column if not exists id_verification_manual_override_by uuid references profiles(id);
alter table jobs add column if not exists id_verification_manual_override_at timestamptz;
alter table pricing_settings add column if not exists id_verification_approval_wait_minutes numeric not null default 5;

-- Posts the "please approve" message into the job's own chat thread as an
-- anonymous customer action (no sender_id) — security definer so it doesn't
-- need an authenticated session, same reasoning as the other verification RPCs.
create or replace function post_id_verification_chat_message(p_token uuid, p_body text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_job_id uuid;
begin
  select id into v_job_id from jobs where id_verification_token = p_token;
  if v_job_id is null then
    return false;
  end if;
  insert into job_messages (job_id, sender_id, sender_role, sender_name, body)
  values (v_job_id, null, 'platform_admin', 'Drivflo', p_body);
  return true;
end;
$$;
grant execute on function post_id_verification_chat_message(uuid, text) to anon, authenticated;

-- Tracks a failed AI verification attempt and returns the new count, so the
-- client knows when to switch to the manual driver-confirms-in-person fallback.
create or replace function increment_id_verification_failures(p_token uuid)
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  update jobs
  set id_verification_failed_attempts = id_verification_failed_attempts + 1
  where id_verification_token = p_token
  returning id_verification_failed_attempts into v_count;
  return v_count;
end;
$$;
grant execute on function increment_id_verification_failures(uuid) to anon, authenticated;
