-- Recurring compliance documents for drivers: driver's abstract and a
-- vulnerable sector/criminal record check (both matching BC's actual
-- 12-month Record Check Certificate requirement for passenger-directed
-- vehicle drivers), plus drug/alcohol test and medical fitness test
-- (12-month internal policy, no specific BC-mandated period found for
-- these two). Tracked separately from the one-time application documents
-- since these need to be re-uploaded and re-reviewed on a recurring basis,
-- not just once at hire.

alter table profiles add column if not exists driver_abstract_path text;
alter table profiles add column if not exists driver_abstract_uploaded_at timestamptz;
alter table profiles add column if not exists driver_abstract_reviewed_at timestamptz;
alter table profiles add column if not exists driver_abstract_reviewed_by uuid references profiles(id);

alter table profiles add column if not exists drug_alcohol_test_path text;
alter table profiles add column if not exists drug_alcohol_test_uploaded_at timestamptz;
alter table profiles add column if not exists drug_alcohol_test_reviewed_at timestamptz;
alter table profiles add column if not exists drug_alcohol_test_reviewed_by uuid references profiles(id);

alter table profiles add column if not exists medical_fitness_test_path text;
alter table profiles add column if not exists medical_fitness_test_uploaded_at timestamptz;
alter table profiles add column if not exists medical_fitness_test_reviewed_at timestamptz;
alter table profiles add column if not exists medical_fitness_test_reviewed_by uuid references profiles(id);

alter table profiles add column if not exists vulnerable_sector_check_path text;
alter table profiles add column if not exists vulnerable_sector_check_uploaded_at timestamptz;
alter table profiles add column if not exists vulnerable_sector_check_reviewed_at timestamptz;
alter table profiles add column if not exists vulnerable_sector_check_reviewed_by uuid references profiles(id);

alter table profiles add column if not exists criminal_background_check_path text;
alter table profiles add column if not exists criminal_background_check_uploaded_at timestamptz;
alter table profiles add column if not exists criminal_background_check_reviewed_at timestamptz;
alter table profiles add column if not exists criminal_background_check_reviewed_by uuid references profiles(id);

-- Seed the ongoing tracking columns from whatever was submitted at
-- application time, so existing approved drivers aren't all immediately
-- treated as having never submitted these documents. Their "reviewed_at"
-- is intentionally left null - the initial application approval already
-- vetted them, but this recurring system tracks renewal separately and
-- an admin should do one explicit pass to confirm/date-stamp each
-- currently-active driver's documents rather than this migration guessing
-- an approval date that doesn't reflect when they were actually reviewed.
update profiles p
set
  criminal_background_check_path = da.criminal_background_check_path,
  drug_alcohol_test_path = da.drug_alcohol_test_path,
  driver_abstract_path = da.drivers_abstract_path,
  medical_fitness_test_path = da.medical_fitness_path
from driver_applications da
where da.user_id = p.id
  and (
    (p.criminal_background_check_path is null and da.criminal_background_check_path is not null)
    or (p.drug_alcohol_test_path is null and da.drug_alcohol_test_path is not null)
    or (p.driver_abstract_path is null and da.drivers_abstract_path is not null)
    or (p.medical_fitness_test_path is null and da.medical_fitness_path is not null)
  );
