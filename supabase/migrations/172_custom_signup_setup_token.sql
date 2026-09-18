-- Bypasses Supabase's own email-confirmation link mechanism entirely for
-- signup completion. That mechanism turned out to require the PKCE code
-- exchange regardless of client flowType settings, which in turn requires
-- a locally-stored verifier from the exact browser/session that started
-- the signup - fragile across the realistic gap in time and possibly
-- context (a different tab, a closed browser, a different app opening
-- the email link) between filling out the form and clicking the email,
-- and confirmed failing repeatedly in practice regardless of flow-type
-- configuration.
--
-- This is a much simpler, fully custom mechanism instead: a random token
-- generated only once the phone is verified, emailed as part of a plain
-- link with no session/auth state of its own required to use it. Whoever
-- has the token and the correct lead id can set a password once - the
-- account is created (already confirmed) directly at that point via the
-- service role, with no separate confirmation step to fail.
alter table driver_signup_leads add column if not exists setup_token text;
alter table driver_signup_leads add column if not exists setup_token_expires_at timestamptz;
alter table driver_signup_leads add column if not exists setup_token_used_at timestamptz;

alter table dealer_signup_leads add column if not exists setup_token text;
alter table dealer_signup_leads add column if not exists setup_token_expires_at timestamptz;
alter table dealer_signup_leads add column if not exists setup_token_used_at timestamptz;

-- Generates a setup token, but only for a lead whose phone has actually
-- been verified - this is the gate that replaces Supabase's own
-- verification step.
create or replace function create_driver_signup_setup_token(p_lead_id uuid)
returns table (token text, full_name text, email text)
language plpgsql
security definer
as $$
declare
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_lead driver_signup_leads%rowtype;
begin
  select * into v_lead from driver_signup_leads where id = p_lead_id and phone_verified_at is not null;
  if v_lead is null then
    return;
  end if;
  update driver_signup_leads
  set setup_token = v_token, setup_token_expires_at = now() + interval '24 hours', setup_token_used_at = null
  where id = p_lead_id;
  return query select v_token, v_lead.full_name, v_lead.email;
end;
$$;

create or replace function create_dealer_signup_setup_token(p_lead_id uuid)
returns table (token text, contact_full_name text, contact_email text)
language plpgsql
security definer
as $$
declare
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_lead dealer_signup_leads%rowtype;
begin
  select * into v_lead from dealer_signup_leads where id = p_lead_id and phone_verified_at is not null;
  if v_lead is null then
    return;
  end if;
  update dealer_signup_leads
  set setup_token = v_token, setup_token_expires_at = now() + interval '24 hours', setup_token_used_at = null
  where id = p_lead_id;
  return query select v_token, v_lead.contact_full_name, v_lead.contact_email;
end;
$$;

-- Checked server-side (with the service role) before ever creating an
-- account - confirms the token is real, unexpired, and unused.
create or replace function check_driver_signup_setup_token(p_lead_id uuid, p_token text)
returns table (email text)
language sql
security definer
stable
as $$
  select email from driver_signup_leads
  where id = p_lead_id and setup_token = p_token
    and setup_token_expires_at > now() and setup_token_used_at is null;
$$;

create or replace function check_dealer_signup_setup_token(p_lead_id uuid, p_token text)
returns table (email text)
language sql
security definer
stable
as $$
  select contact_email as email from dealer_signup_leads
  where id = p_lead_id and setup_token = p_token
    and setup_token_expires_at > now() and setup_token_used_at is null;
$$;

create or replace function mark_driver_setup_token_used(p_lead_id uuid)
returns void
language sql
security definer
as $$
  update driver_signup_leads set setup_token_used_at = now() where id = p_lead_id;
$$;

create or replace function mark_dealer_setup_token_used(p_lead_id uuid)
returns void
language sql
security definer
as $$
  update dealer_signup_leads set setup_token_used_at = now() where id = p_lead_id;
$$;

grant execute on function create_driver_signup_setup_token(uuid) to anon, authenticated;
grant execute on function create_dealer_signup_setup_token(uuid) to anon, authenticated;
grant execute on function check_driver_signup_setup_token(uuid, text) to anon, authenticated, service_role;
grant execute on function check_dealer_signup_setup_token(uuid, text) to anon, authenticated, service_role;
grant execute on function mark_driver_setup_token_used(uuid) to anon, authenticated, service_role;
grant execute on function mark_dealer_setup_token_used(uuid) to anon, authenticated, service_role;
