alter table driver_applications add column if not exists vehicle_photo_path text;

alter table profiles add column if not exists vehicle_photo_url text;
alter table profiles add column if not exists vehicle_year int;
alter table profiles add column if not exists vehicle_make text;
alter table profiles add column if not exists vehicle_model text;
