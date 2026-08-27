-- Adds an optional second parameter to skip the override check, rather
-- than duplicating this whole function's logic into a separate "raw"
-- version - one source of truth, since this logic has already been
-- edited several times and duplicating it risks the two versions
-- drifting apart later. Default behavior (no second argument) is
-- unchanged - every existing caller (the active-status trigger, the
-- daily sweep, claim_job_if_no_conflict) keeps respecting the override
-- exactly as before.
-- create or replace with a different parameter list creates a NEW,
-- separate overload in Postgres rather than truly replacing the old
-- one - explicitly drop the old single-argument version first, so every
-- existing caller (the active-status trigger, the daily sweep,
-- claim_job_if_no_conflict) actually resolves to this new version
-- instead of silently continuing to use an orphaned, un-updated copy.
drop function if exists is_driver_documentation_complete(uuid);

create or replace function is_driver_documentation_complete(p_driver_id uuid, p_ignore_override boolean default false)
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
    return true;
  end if;

  if not p_ignore_override and v_profile.compliance_override
    and (v_profile.compliance_override_expires_at is null or v_profile.compliance_override_expires_at > now()) then
    return true;
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

grant execute on function is_driver_documentation_complete(uuid, boolean) to authenticated;

-- Batch version for the drivers list "Incomplete" badge, ignoring
-- override - always reflects the actual, raw state of a driver's
-- documents, separate from whether an override currently lets them work
-- anyway (that's what the separate "Override" badge is for).
create or replace function driver_documentation_completeness_raw()
returns table (driver_id uuid, is_complete boolean)
language sql
stable
as $$
  select id, is_driver_documentation_complete(id, true) from profiles where role = 'driver';
$$;

grant execute on function driver_documentation_completeness_raw() to authenticated;
