-- BC's Passenger Directed Vehicle rules require a mechanical safety
-- inspection every 6 or 12 months depending on mileage driven (confirmed
-- against the Province of BC's own PDV driver requirements page) - since
-- mileage isn't tracked precisely here, this uses the stricter 6-month
-- interval always, only for drivers who've opted into passenger jobs
-- (Customer Pick Up / Customer Drop Off in their preferred job types).
-- Not yet actively required in practice since Drivflo isn't licensed for
-- passenger transport yet, but built now so it's ready when that changes.

alter table profiles add column if not exists vehicle_safety_inspection_path text;
alter table profiles add column if not exists vehicle_safety_inspection_uploaded_at timestamptz;
alter table profiles add column if not exists vehicle_safety_inspection_reviewed_at timestamptz;
alter table profiles add column if not exists vehicle_safety_inspection_reviewed_by uuid references profiles(id);

create or replace function is_driver_documentation_complete(p_driver_id uuid, p_ignore_override boolean default false)
returns boolean
language plpgsql
stable
as $$
declare
  v_profile profiles;
  v_app driver_applications;
  v_outstanding_legal int;
  v_wants_passenger_jobs boolean;
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

  -- Passenger-vehicle safety inspection: only required if this driver has
  -- opted into passenger jobs, and renews every 6 months (not 12, like the
  -- others), per BC's PDV requirement for higher-mileage vehicles - using
  -- the stricter interval always since actual mileage isn't tracked here.
  v_wants_passenger_jobs := v_profile.preferred_job_types is not null
    and (v_profile.preferred_job_types && array['Customer Pick Up', 'Customer Drop Off']);
  if v_wants_passenger_jobs then
    if v_profile.vehicle_safety_inspection_reviewed_at is null or v_profile.vehicle_safety_inspection_reviewed_at < now() - interval '6 months' then
      return false;
    end if;
  end if;

  select * into v_app from driver_applications where user_id = p_driver_id order by created_at desc limit 1;
  if v_app is null then
    return false;
  end if;
  if v_app.profile_photo_path is null or v_app.drivers_license_path is null
    or v_app.criminal_background_check_path is null or v_app.optical_test_path is null
    or v_app.void_cheque_path is null or v_app.vehicle_registration_path is null
    or v_app.vehicle_insurance_path is null or v_app.vehicle_photo_path is null
    or v_app.vehicle_walkaround_video_path is null or v_app.dash_odometer_photo_path is null then
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
