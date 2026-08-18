alter table jobs add column if not exists dealer_paid_at timestamptz;
alter table jobs add column if not exists dealer_paid_by uuid references profiles(id);
alter table jobs add column if not exists dealer_paid_notes text;
