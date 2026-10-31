-- 1) Per-dealer markup: when set, this replaces the global dealer markup % for
--    that dealer's jobs (null = use the global setting). Admin-only to change.
-- 2) Per-job discount: admin can take a % off a single job's price.
alter table organizations add column if not exists markup_percent_override numeric
  check (markup_percent_override is null or markup_percent_override > 0);
alter table jobs add column if not exists admin_discount_percent numeric not null default 0
  check (admin_discount_percent >= 0 and admin_discount_percent <= 100);

-- Dealers can edit their own organization row and their own jobs, so make sure
-- only a platform admin (or the SQL editor) can touch these two pricing fields.
create or replace function protect_organization_markup()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.uid() is not null and my_role() is distinct from 'platform_admin' then
    if tg_op = 'INSERT' and new.markup_percent_override is not null then
      raise exception 'Only Drivflo admin can set a custom markup.';
    end if;
    if tg_op = 'UPDATE' and new.markup_percent_override is distinct from old.markup_percent_override then
      raise exception 'Only Drivflo admin can change a custom markup.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_organization_markup_trg on organizations;
create trigger protect_organization_markup_trg
  before insert or update on organizations
  for each row execute function protect_organization_markup();

create or replace function protect_job_discount()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.uid() is not null and my_role() is distinct from 'platform_admin' then
    if tg_op = 'INSERT' and coalesce(new.admin_discount_percent, 0) <> 0 then
      raise exception 'Only Drivflo admin can discount a job.';
    end if;
    if tg_op = 'UPDATE' and new.admin_discount_percent is distinct from old.admin_discount_percent then
      raise exception 'Only Drivflo admin can discount a job.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_job_discount_trg on jobs;
create trigger protect_job_discount_trg
  before insert or update on jobs
  for each row execute function protect_job_discount();

notify pgrst, 'reload schema';
