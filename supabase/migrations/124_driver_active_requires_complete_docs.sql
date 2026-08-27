-- Central definition of "is this driver's required documentation
-- complete" - covers three things:
--   1. The four recurring compliance documents (driver's abstract,
--      drug/alcohol test, medical fitness test, vulnerable sector check)
--      must each be reviewed and not past their 12-month renewal window.
--   2. The one-time required documents from the original application
--      (profile photo, driver's license, criminal background check,
--      optical test, void cheque, vehicle registration, vehicle
--      insurance) must be on file. VSA license is intentionally excluded
--      since it's marked optional on the application form.
--   3. No outstanding required legal agreement (driver contractor
--      agreement, drug/alcohol policy, etc.) left unsigned.
-- Used both to gate active status (see the trigger below) and to power
-- the "Incomplete" badge in the admin driver list.
create or replace function is_driver_documentation_complete(p_driver_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  v_profile profiles;
  v_app driver_applications;
  v_outstanding_legal int;
begin
  select * into v_profile from profiles where id = p_driver_id;
  if v_profile is null or v_profile.role <> 'driver' then
    return true; -- not a driver, nothing to check
  end if;

  if v_profile.driver_abstract_reviewed_at is null or v_profile.driver_abstract_reviewed_at < now() - interval '12 months' then
    return false;
  end if;
  if v_profile.drug_alcohol_test_reviewed_at is null or v_profile.drug_alcohol_test_reviewed_at < now() - interval '12 months' then
    return false;
  end if;
  if v_profile.medical_fitness_test_reviewed_at is null or v_profile.medical_fitness_test_reviewed_at < now() - interval '12 months' then
    return false;
  end if;
  if v_profile.vulnerable_sector_check_reviewed_at is null or v_profile.vulnerable_sector_check_reviewed_at < now() - interval '12 months' then
    return false;
  end if;

  select * into v_app from driver_applications where user_id = p_driver_id order by created_at desc limit 1;
  if v_app is null then
    return false;
  end if;
  if v_app.profile_photo_path is null or v_app.drivers_license_path is null
    or v_app.criminal_background_check_path is null or v_app.optical_test_path is null
    or v_app.void_cheque_path is null or v_app.vehicle_registration_path is null
    or v_app.vehicle_insurance_path is null then
    return false;
  end if;

  select count(*) into v_outstanding_legal
  from legal_documents ld
  where ld.is_current
    and ld.slug in (
      'driver_contractor_agreement',
      'drug_alcohol_policy',
      'driver_standards_code_of_conduct',
      'vehicle_inspection_damage_policy',
      'driver_expense_reimbursement_policy',
      'privacy_policy',
      'platform_terms_of_service'
    )
    and not exists (
      select 1 from legal_acceptances la
      where la.user_id = p_driver_id
        and la.document_slug = ld.slug
        and la.document_version = ld.version
    );
  if v_outstanding_legal > 0 then
    return false;
  end if;

  return true;
end;
$$;

grant execute on function is_driver_documentation_complete(uuid) to authenticated;

-- Batch version for list views - one query instead of N calls to the
-- single-driver function above.
create or replace function driver_documentation_completeness()
returns table (driver_id uuid, is_complete boolean)
language sql
stable
as $$
  select id, is_driver_documentation_complete(id) from profiles where role = 'driver';
$$;

grant execute on function driver_documentation_completeness() to authenticated;

-- Forces a driver's is_active to false whenever their required
-- documentation is incomplete, regardless of what the client tries to
-- set it to - this both auto-deactivates when something expires/becomes
-- unapproved, and blocks a manual reactivation attempt while anything is
-- still missing. Deliberately does NOT auto-reactivate when documentation
-- becomes complete again - admin must explicitly flip the toggle once
-- they're satisfied everything is in order, so a driver never goes live
-- without an explicit human decision.
create or replace function enforce_driver_active_requires_complete_docs()
returns trigger
language plpgsql
as $$
begin
  if NEW.role = 'driver' and NEW.is_active and not is_driver_documentation_complete(NEW.id) then
    NEW.is_active := false;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_driver_active_requires_complete_docs on profiles;
create trigger trg_enforce_driver_active_requires_complete_docs
before insert or update on profiles
for each row
execute function enforce_driver_active_requires_complete_docs();

-- The trigger above only fires on an actual write to a driver's profile
-- row - a document quietly expiring with the passage of time alone (no
-- one editing anything) wouldn't otherwise flip is_active until some
-- unrelated update happens to touch that row. This daily sweep closes
-- that gap by re-checking every currently-active driver and forcing
-- inactive if their documentation has since become incomplete, so the
-- visible Active/Inactive status stays accurate day to day, not just
-- reactively on the next edit.
create extension if not exists pg_cron;

create or replace function sweep_driver_active_status()
returns void
language plpgsql
as $$
begin
  update profiles
  set is_active = false
  where role = 'driver'
    and is_active = true
    and not is_driver_documentation_complete(id);
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sweep-driver-active-status-daily') then
    perform cron.unschedule('sweep-driver-active-status-daily');
  end if;
end $$;

select cron.schedule(
  'sweep-driver-active-status-daily',
  '0 8 * * *', -- 8am UTC daily
  $$select sweep_driver_active_status()$$
);
