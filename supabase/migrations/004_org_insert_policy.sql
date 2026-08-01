create policy "admins create organizations" on organizations
  for insert with check (my_role() = 'platform_admin');
