create policy "admins update any profile" on profiles
  for update using (my_role() = 'platform_admin');
