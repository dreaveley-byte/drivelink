-- Distinguishes a chase-vehicle companion job (second driver follows in
-- their own personal vehicle, not delivering anything) from a genuine
-- second-vehicle-delivery companion job. Both currently get created via the
-- same "second driver" flow, but they need very different treatment: no
-- condition report, no customer contact, no customer-facing tracking, and
-- wear & tear accrued on the chase driver's own personal vehicle.
alter table jobs add column if not exists is_chase_vehicle_job boolean not null default false;
