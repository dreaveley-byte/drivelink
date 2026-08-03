drop policy if exists "org admins delete own org invites" on org_invites;
create policy "org admins delete own org invites" on org_invites
  for delete using (
    (organization_id = my_org_id() and my_role() = 'org_admin') or my_role() = 'platform_admin'
  );

grant delete on org_invites to authenticated;
