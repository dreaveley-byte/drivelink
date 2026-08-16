-- Discount codes admin can create to incentivize new dealers - a reduced
-- markup for a limited number of days, a limited number of jobs, or both
-- (whichever runs out first ends the discount).
create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent numeric not null check (discount_percent > 0 and discount_percent <= 100),
  expires_days int, -- null = no time limit; counted from when a dealer redeems it, not when the code was created
  max_jobs int, -- null = no job-count limit
  active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table organizations add column if not exists discount_code_id uuid references discount_codes(id);
alter table organizations add column if not exists discount_redeemed_at timestamptz;
alter table organizations add column if not exists discount_jobs_used int not null default 0;

alter table discount_codes enable row level security;

drop policy if exists "admin manages discount codes" on discount_codes;
create policy "admin manages discount codes" on discount_codes
for all using (my_role() = 'platform_admin') with check (my_role() = 'platform_admin');

-- Dealers need to be able to look up a code by its text to redeem it, but
-- shouldn't see the full list or other dealers' usage - handled via the
-- redeem_discount_code() function below instead of direct table access.
grant select, insert, update, delete on discount_codes to authenticated;

-- Called when a dealer enters a code on their org settings page. Validates
-- the code is active and not already used by this org, then attaches it.
create or replace function redeem_discount_code(p_org_id uuid, p_code text)
returns organizations
language plpgsql
security definer
as $$
declare
  v_code discount_codes;
  v_org organizations;
begin
  select * into v_code from discount_codes where lower(code) = lower(trim(p_code)) and active = true;
  if v_code is null then
    raise exception 'That discount code isn''t valid.';
  end if;

  select * into v_org from organizations where id = p_org_id;
  if v_org.discount_code_id is not null then
    raise exception 'A discount code has already been applied to this account.';
  end if;

  update organizations
  set discount_code_id = v_code.id, discount_redeemed_at = now(), discount_jobs_used = 0
  where id = p_org_id
  returning * into v_org;

  return v_org;
end;
$$;

grant execute on function redeem_discount_code(uuid, text) to authenticated;

-- Returns the effective discount percent for an org right now (0 if none
-- active, or if it's expired/used up) - called by the pricing engine when
-- a job is posted.
create or replace function get_active_discount_percent(p_org_id uuid)
returns numeric
language plpgsql
security definer
stable
as $$
declare
  v_org organizations;
  v_code discount_codes;
begin
  select * into v_org from organizations where id = p_org_id;
  if v_org.discount_code_id is null then
    return 0;
  end if;

  select * into v_code from discount_codes where id = v_org.discount_code_id;
  if v_code is null or not v_code.active then
    return 0;
  end if;

  if v_code.expires_days is not null and v_org.discount_redeemed_at + (v_code.expires_days || ' days')::interval < now() then
    return 0;
  end if;

  if v_code.max_jobs is not null and v_org.discount_jobs_used >= v_code.max_jobs then
    return 0;
  end if;

  return v_code.discount_percent;
end;
$$;

grant execute on function get_active_discount_percent(uuid) to authenticated;

-- Increments the job-count usage - called once when a job is posted under
-- an active discount, so a job-limited code correctly runs out.
create or replace function increment_discount_usage(p_org_id uuid)
returns void
language sql
security definer
as $$
  update organizations set discount_jobs_used = discount_jobs_used + 1 where id = p_org_id;
$$;

grant execute on function increment_discount_usage(uuid) to authenticated;
