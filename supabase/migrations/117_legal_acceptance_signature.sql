-- The driver/dealer contract documents (driver_contractor_agreement,
-- dealer_master_services_agreement) require a real pen signature, not just a
-- click-through. Store the signature image path alongside the acceptance row
-- so admins can see what was actually signed. accepted_at already defaults to
-- now() at the DB layer (not client-supplied), which is what's shown back to
-- the user/admin as the acceptance timestamp.

alter table legal_acceptances add column if not exists signature_path text;

-- Private bucket for legal-document signature captures (driver/dealer contract
-- e-signatures). Mirrors the job-media bucket pattern.
insert into storage.buckets (id, name, public)
values ('legal-signatures', 'legal-signatures', false)
on conflict (id) do nothing;

-- Files are stored under a folder named after the signing user's id.
create policy "users read own legal signatures"
on storage.objects for select
using (
  bucket_id = 'legal-signatures'
  and ((storage.foldername(name))[1] = auth.uid()::text or my_role() = 'platform_admin')
);

create policy "users upload own legal signatures"
on storage.objects for insert
with check (
  bucket_id = 'legal-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);
