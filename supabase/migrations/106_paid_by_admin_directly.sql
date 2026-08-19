alter table job_expenses add column if not exists paid_by_admin_directly boolean not null default false;
