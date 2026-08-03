-- Only an org_admin (not a regular team member) can invite new people or
-- edit the dealership's business info / billing details.
drop policy if exists "org members create invites" on org_invites;
create policy "org admins create invites" on org_invites
  for insert with check (
    organization_id = my_org_id() and invited_by = auth.uid() and my_role() = 'org_admin'
  );

drop policy if exists "org members update own organization" on organizations;
create policy "org admins update own organization" on organizations
  for update using (
    (id = my_org_id() and my_role() = 'org_admin') or my_role() = 'platform_admin'
  );
