-- Data cleanup: drivers should never be linked to an organization (that's what
-- made them show up under a dealer's "Team Members"). This was leftover from
-- earlier test data / re-approvals, not something current code does.
update profiles set organization_id = null where role = 'driver' and organization_id is not null;

-- ============================================
-- DEALER TEAM INVITES
-- ============================================
create table if not exists org_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  invited_by uuid not null references profiles(id),
  email text,
  token uuid not null default gen_random_uuid(),
  accepted_at timestamptz,
  accepted_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table org_invites enable row level security;

create policy "org members view own org invites" on org_invites
  for select using (organization_id = my_org_id() or my_role() = 'platform_admin');

create policy "org members create invites" on org_invites
  for insert with check (organization_id = my_org_id() and invited_by = auth.uid());

grant select, insert on org_invites to authenticated;

-- Lets someone accepting an invite link look up basic info (org name, whether
-- it's already used) before they've signed up / linked their account.
create or replace function get_invite_info(p_token uuid)
returns table (organization_name text, already_accepted boolean)
language sql stable security definer as $$
  select o.name, (i.accepted_at is not null)
  from org_invites i
  join organizations o on o.id = i.organization_id
  where i.token = p_token;
$$;

grant execute on function get_invite_info(uuid) to anon, authenticated;

-- Accepts an invite: links the calling (already signed-up) user to the invite's
-- organization as an org_member, and marks the invite used.
create or replace function accept_org_invite(p_token uuid)
returns void language plpgsql security definer as $$
declare
  v_org_id uuid;
  v_already timestamptz;
begin
  select organization_id, accepted_at into v_org_id, v_already
  from org_invites where token = p_token;

  if v_org_id is null then
    raise exception 'Invalid invite link';
  end if;
  if v_already is not null then
    raise exception 'This invite has already been used';
  end if;

  update profiles set organization_id = v_org_id, role = 'org_member' where id = auth.uid();
  update org_invites set accepted_at = now(), accepted_by = auth.uid() where token = p_token;
end;
$$;

grant execute on function accept_org_invite(uuid) to authenticated;

-- ============================================
-- BILLING (references only — no card numbers ever stored here)
-- ============================================
-- Actual card data lives with Stripe; we only keep the token/reference and
-- non-sensitive display info (last 4 digits, brand) for admin's own reference.
alter table dealer_applications add column if not exists stripe_customer_id text;
alter table dealer_applications add column if not exists stripe_payment_method_id text;
alter table dealer_applications add column if not exists card_brand text;
alter table dealer_applications add column if not exists card_last4 text;
