create policy "driver deletes job media for own claimed job"
on storage.objects for delete
using (
  bucket_id = 'job-media'
  and (
    (storage.foldername(name))[1]::uuid in (select id from jobs where driver_id = auth.uid())
    or my_role() = 'platform_admin'
  )
);
