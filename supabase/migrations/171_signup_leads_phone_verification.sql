-- Two-step signup: a short "basic info" form is submitted with no account
-- yet, a 6-digit code texts to the phone given, and only once that code is
-- confirmed does an actual account get created - at which point Supabase's
-- own built-in signup-confirmation email fires, and clicking it is what
-- lets someone finish the rest of the application (set a real password,
-- vehicle/license info, documents, agreements) already logged in.
--
-- These tables hold only non-sensitive contact info (no SIN, no payment
-- details) and exist purely to bridge the gap between "someone typed their
-- info in" and "an account exists" - there is deliberately no long-term
-- value in a row here beyond that bridge.
create table driver_signup_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  home_address text not null,
  cell_phone text not null,
  home_phone text,
  email text not null,
  verification_code text,
  verification_code_expires_at timestamptz,
  phone_verified_at timestamptz,
  converted_user_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table dealer_signup_leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  business_address text not null,
  contact_full_name text not null,
  contact_position text,
  store_phone text,
  contact_email text not null,
  contact_cell_phone text not null,
  verification_code text,
  verification_code_expires_at timestamptz,
  phone_verified_at timestamptz,
  converted_user_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table driver_signup_leads enable row level security;
alter table dealer_signup_leads enable row level security;
-- No direct table policies at all for anon/authenticated - every access
-- goes through the security-definer functions below, so the verification
-- code itself is never a column the browser could read directly, only
-- ever compared server-side inside verify_*_signup_code.

-- Starts a signup: stores the basic info, generates a code, and hands the
-- new lead's id + the code back to the caller (an API route) so it can
-- text the code - the code is never stored anywhere the client can read it
-- back from.
create or replace function start_driver_signup(
  p_full_name text, p_home_address text, p_cell_phone text, p_home_phone text, p_email text
)
returns table (lead_id uuid, code text)
language plpgsql
security definer
as $$
declare
  v_code text := lpad(floor(random() * 1000000)::text, 6, '0');
  v_id uuid;
begin
  insert into driver_signup_leads (full_name, home_address, cell_phone, home_phone, email, verification_code, verification_code_expires_at)
  values (p_full_name, p_home_address, p_cell_phone, nullif(p_home_phone, ''), p_email, v_code, now() + interval '10 minutes')
  returning id into v_id;
  return query select v_id, v_code;
end;
$$;

create or replace function start_dealer_signup(
  p_business_name text, p_business_address text, p_contact_full_name text, p_contact_position text,
  p_store_phone text, p_contact_email text, p_contact_cell_phone text
)
returns table (lead_id uuid, code text)
language plpgsql
security definer
as $$
declare
  v_code text := lpad(floor(random() * 1000000)::text, 6, '0');
  v_id uuid;
begin
  insert into dealer_signup_leads (business_name, business_address, contact_full_name, contact_position, store_phone, contact_email, contact_cell_phone, verification_code, verification_code_expires_at)
  values (p_business_name, p_business_address, p_contact_full_name, nullif(p_contact_position, ''), nullif(p_store_phone, ''), p_contact_email, p_contact_cell_phone, v_code, now() + interval '10 minutes')
  returning id into v_id;
  return query select v_id, v_code;
end;
$$;

-- Checks the code server-side; the only thing that ever leaves this
-- function is true/false, never the stored code itself.
create or replace function verify_driver_signup_code(p_lead_id uuid, p_code text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_lead driver_signup_leads%rowtype;
begin
  select * into v_lead from driver_signup_leads where id = p_lead_id;
  if v_lead is null or v_lead.verification_code_expires_at < now() or v_lead.verification_code is distinct from p_code then
    return false;
  end if;
  update driver_signup_leads set phone_verified_at = now() where id = p_lead_id;
  return true;
end;
$$;

create or replace function verify_dealer_signup_code(p_lead_id uuid, p_code text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_lead dealer_signup_leads%rowtype;
begin
  select * into v_lead from dealer_signup_leads where id = p_lead_id;
  if v_lead is null or v_lead.verification_code_expires_at < now() or v_lead.verification_code is distinct from p_code then
    return false;
  end if;
  update dealer_signup_leads set phone_verified_at = now() where id = p_lead_id;
  return true;
end;
$$;

-- Used to pre-fill the rest-of-application step once someone arrives back
-- logged in via the confirmation email - only returns anything once the
-- phone has actually been verified, so a guessed/leaked id alone can't
-- pull someone's contact info before they've proven the phone is theirs.
create or replace function get_verified_driver_lead(p_lead_id uuid)
returns table (full_name text, home_address text, cell_phone text, home_phone text, email text)
language sql
security definer
stable
as $$
  select full_name, home_address, cell_phone, home_phone, email
  from driver_signup_leads
  where id = p_lead_id and phone_verified_at is not null;
$$;

create or replace function get_verified_dealer_lead(p_lead_id uuid)
returns table (business_name text, business_address text, contact_full_name text, contact_position text, store_phone text, contact_email text, contact_cell_phone text)
language sql
security definer
stable
as $$
  select business_name, business_address, contact_full_name, contact_position, store_phone, contact_email, contact_cell_phone
  from dealer_signup_leads
  where id = p_lead_id and phone_verified_at is not null;
$$;

-- Marks a lead as converted once the actual account/application exists,
-- so it's easy to tell a completed signup from an abandoned one.
create or replace function mark_driver_lead_converted(p_lead_id uuid, p_user_id uuid)
returns void
language sql
security definer
as $$
  update driver_signup_leads set converted_user_id = p_user_id where id = p_lead_id;
$$;

create or replace function mark_dealer_lead_converted(p_lead_id uuid, p_user_id uuid)
returns void
language sql
security definer
as $$
  update dealer_signup_leads set converted_user_id = p_user_id where id = p_lead_id;
$$;

grant execute on function start_driver_signup(text, text, text, text, text) to anon, authenticated;
grant execute on function start_dealer_signup(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function verify_driver_signup_code(uuid, text) to anon, authenticated;
grant execute on function verify_dealer_signup_code(uuid, text) to anon, authenticated;
grant execute on function get_verified_driver_lead(uuid) to anon, authenticated;
grant execute on function get_verified_dealer_lead(uuid) to anon, authenticated;
grant execute on function mark_driver_lead_converted(uuid, uuid) to anon, authenticated;
grant execute on function mark_dealer_lead_converted(uuid, uuid) to anon, authenticated;
