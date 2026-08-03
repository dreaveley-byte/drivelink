-- Bug fix: there was never an UPDATE policy on organizations, so dealer
-- "Business Info" edits (address/phone) and org name syncing have been
-- silently failing. This adds it.
create policy "org members update own organization" on organizations
  for update using (id = my_org_id() or my_role() = 'platform_admin');

-- Coordinates for the admin coverage map (dealer location, driver home base)
alter table organizations add column if not exists lat numeric;
alter table organizations add column if not exists lng numeric;
alter table profiles add column if not exists home_lat numeric;
alter table profiles add column if not exists home_lng numeric;
