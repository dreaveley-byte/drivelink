-- ============================================
-- DRIVER APPLICATIONS
-- ============================================

create table driver_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,

  full_name text,
  address text,
  cell_phone text,
  home_phone text,
  email text,

  -- Payment / tax info
  payout_method text check (payout_method in ('individual', 'company')),
  company_name text,
  gst_number text,
  sin_number text,  -- sensitive: locked down via RLS below, admin-only visibility
  void_cheque_path text,

  -- Documents (each stores a path to a file in the driver-documents storage bucket)
  profile_photo_path text,
  drivers_license_path text,
  drivers_abstract_path text,
  criminal_background_check_path text,
  vsa_license_path text,
  medical_fitness_path text,
  drug_alcohol_test_path text,
  optical_test_path text,

  -- Contract
  contract_signed_at timestamptz,
  contract_signature_path text,
  agreed_to_drug_alcohol_policy boolean not null default false,
  agreed_to_probation_terms boolean not null default false,

  status text not null default 'pending' check (status in ('pending', 'in_review', 'approved', 'rejected')),
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger driver_applications_set_updated_at
  before update on driver_applications
  for each row execute function set_updated_at();

alter table driver_applications enable row level security;

create policy "drivers view own application" on driver_applications
  for select using (user_id = auth.uid() or my_role() = 'platform_admin');

create policy "drivers create own application" on driver_applications
  for insert with check (user_id = auth.uid());

create policy "drivers update own pending application" on driver_applications
  for update using (
    (user_id = auth.uid() and status = 'pending') or my_role() = 'platform_admin'
  );

grant select, insert, update on driver_applications to authenticated;


-- ============================================
-- DEALER APPLICATIONS
-- ============================================

create table dealer_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  submitted_by uuid not null references profiles(id),

  business_name text,
  business_address text,
  pst_number text,
  gst_number text,
  dealer_number text,

  contact_full_name text,
  contact_position text,
  store_phone text,
  contact_cell_phone text,

  payment_method text check (payment_method in ('credit_card', 'pre_authorized_debit')),
  pre_authorized_debit_form_path text,
  -- Note: actual card details are never stored here — handled directly by Stripe

  contract_signed_at timestamptz,
  contract_signature_path text,
  liability_release_signed boolean not null default false,

  status text not null default 'pending' check (status in ('pending', 'in_review', 'approved', 'rejected')),
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger dealer_applications_set_updated_at
  before update on dealer_applications
  for each row execute function set_updated_at();

alter table dealer_applications enable row level security;

create policy "org members view own application" on dealer_applications
  for select using (
    submitted_by = auth.uid()
    or organization_id = my_org_id()
    or my_role() = 'platform_admin'
  );

create policy "org members create own application" on dealer_applications
  for insert with check (submitted_by = auth.uid());

create policy "org members update own pending application" on dealer_applications
  for update using (
    (submitted_by = auth.uid() and status = 'pending') or my_role() = 'platform_admin'
  );

grant select, insert, update on dealer_applications to authenticated;


-- ============================================
-- SECURE FILE STORAGE
-- ============================================

insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('dealer-documents', 'dealer-documents', false)
on conflict (id) do nothing;

-- Drivers can upload/view only their own files (stored under a folder named after their user id)
create policy "drivers manage own document folder"
on storage.objects for all
using (
  bucket_id = 'driver-documents'
  and (auth.uid()::text = (storage.foldername(name))[1] or my_role() = 'platform_admin')
)
with check (
  bucket_id = 'driver-documents'
  and (auth.uid()::text = (storage.foldername(name))[1] or my_role() = 'platform_admin')
);

create policy "dealers manage own document folder"
on storage.objects for all
using (
  bucket_id = 'dealer-documents'
  and (auth.uid()::text = (storage.foldername(name))[1] or my_role() = 'platform_admin')
)
with check (
  bucket_id = 'dealer-documents'
  and (auth.uid()::text = (storage.foldername(name))[1] or my_role() = 'platform_admin')
);
