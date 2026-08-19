-- ============================================
-- LEGAL DOCUMENTS (versioned, DB-backed source of truth for driver/dealer/
-- customer facing legal text — replaces the previously hardcoded/paraphrased
-- agreement text in the driver and dealer apply flows and the delivery
-- disclosure). Editing a document via the admin panel inserts a new version
-- row and flips is_current, keeping prior versions in history.
-- ============================================

create table legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  version int not null,
  title text not null,
  body text not null,
  audience text not null check (audience in ('driver', 'dealer', 'customer', 'all')),
  is_current boolean not null default true,
  effective_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- Only one current version per slug at a time.
create unique index legal_documents_one_current_per_slug
  on legal_documents (slug)
  where is_current;

create index legal_documents_slug_version_idx on legal_documents (slug, version);

alter table legal_documents enable row level security;

-- Everyone signed in can read the current version of any document (needed to
-- render the apply flows, resign flow and per-job delivery acknowledgement).
-- Older versions are only readable by admins (e.g. to show what a user signed).
create policy "anyone can read current legal documents" on legal_documents
  for select using (is_current or my_role() = 'platform_admin');

create policy "platform admin manages legal documents" on legal_documents
  for insert with check (my_role() = 'platform_admin');

create policy "platform admin updates legal documents" on legal_documents
  for update using (my_role() = 'platform_admin');

grant select, insert, update on legal_documents to authenticated;


-- ============================================
-- LEGAL ACCEPTANCES (audit trail of who accepted which version of which
-- document, and when — one row per document per user per version accepted;
-- per-job for the customer-facing vehicle delivery acknowledgement).
-- ============================================

create table legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  application_type text not null check (application_type in ('driver', 'dealer', 'customer')),
  document_slug text not null,
  document_version int not null,
  job_id uuid references jobs(id) on delete set null,
  media_consent boolean,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index legal_acceptances_user_idx on legal_acceptances (user_id, document_slug);
create index legal_acceptances_job_idx on legal_acceptances (job_id) where job_id is not null;

alter table legal_acceptances enable row level security;

create policy "users read own legal acceptances" on legal_acceptances
  for select using (user_id = auth.uid() or my_role() = 'platform_admin');

create policy "users insert own legal acceptances" on legal_acceptances
  for insert with check (user_id = auth.uid() or my_role() = 'platform_admin');

create policy "platform admin manages legal acceptances" on legal_acceptances
  for update using (my_role() = 'platform_admin');

grant select, insert, update on legal_acceptances to authenticated;
-- The vehicle delivery acknowledgement is signed by the customer on the driver's
-- device, not by an authenticated Drivflo user — the driver's own session performs
-- the insert on the customer's behalf (application_type = 'customer', user_id left
-- null), which the "insert own" policy above does not cover since auth.uid() is the
-- driver, not the customer. Allow any authenticated user to insert customer/job-scoped
-- acceptances tied to a real job; reads stay admin-only for those (no user_id owner).
create policy "drivers record customer delivery acceptance" on legal_acceptances
  for insert with check (
    application_type = 'customer'
    and job_id is not null
    and exists (select 1 from jobs where jobs.id = job_id and jobs.driver_id = auth.uid())
  );
