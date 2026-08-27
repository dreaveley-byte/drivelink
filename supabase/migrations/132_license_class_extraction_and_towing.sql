alter table profiles add column if not exists extracted_license_class text;
alter table profiles add column if not exists can_tow_trailer boolean;

alter table driver_applications add column if not exists extracted_license_class text;
alter table driver_applications add column if not exists can_tow_trailer boolean;
