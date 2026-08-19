alter table driver_applications add column if not exists license_class text;
alter table driver_applications add column if not exists preferred_job_types text[];

alter table profiles add column if not exists license_class text;
alter table profiles add column if not exists preferred_job_types text[];
