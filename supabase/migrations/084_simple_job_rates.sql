-- Courier/Package, Paperwork Signing, and Customer Pick Up/Drop Off are much
-- simpler and shorter than a full vehicle delivery - using the same hourly
-- rate and minimum pay floor calibrated for vehicle deliveries makes these
-- unnecessarily expensive. Separate, independently adjustable rate and floor
-- for these simple job types.
alter table pricing_settings add column if not exists simple_job_hourly_rate_cents int not null default 2500;
alter table pricing_settings add column if not exists simple_job_minimum_pay_cents int not null default 2000;
