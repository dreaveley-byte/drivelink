alter table jobs add column if not exists id_verification_approved_at timestamptz;
alter table jobs add column if not exists id_verification_approved_by uuid references profiles(id);
alter table jobs add column if not exists id_verification_match_notes text;
