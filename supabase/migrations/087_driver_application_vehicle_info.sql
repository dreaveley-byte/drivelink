alter table driver_applications add column if not exists vehicle_year int;
alter table driver_applications add column if not exists vehicle_make text;
alter table driver_applications add column if not exists vehicle_model text;
alter table driver_applications add column if not exists vehicle_mileage int;
alter table driver_applications add column if not exists vehicle_walkaround_video_path text;
alter table driver_applications add column if not exists dash_odometer_photo_path text;

-- The driver-documents bucket never had an explicit size limit set, meaning
-- it was relying on Supabase's project-wide default - likely too small for
-- a walkaround video, which can easily run larger than typical photo/PDF
-- documents. Raise it explicitly.
update storage.buckets set file_size_limit = 209715200 where id = 'driver-documents'; -- 200MB
