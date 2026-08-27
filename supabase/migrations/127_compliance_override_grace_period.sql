alter table profiles add column if not exists compliance_override_expires_at timestamptz;

-- Override now respects an optional expiry - if set, the override only
-- applies until that date, after which the normal documentation check
-- resumes automatically (picked up by the next daily sweep or the next
-- write to that driver's row). A null expiry means the override is
-- indefinite, same as before.
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
    return true;
  end if;

  if v_profile.compliance_override and (v_profile.compliance_override_expires_at is null or v_profile.compliance_override_expires_at > now()) then
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
