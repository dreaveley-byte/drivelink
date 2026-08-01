alter table jobs add column vehicle_mode text not null default 'driven' check (vehicle_mode in ('driven', 'towed'));
alter table jobs add column used_own_vehicle boolean not null default false;
alter table jobs add column out_of_province_inspection boolean not null default false;
alter table jobs add column registry_visit boolean not null default false;
alter table jobs add column additional_charges jsonb not null default '[]'::jsonb;
alter table jobs add column overnight_required boolean not null default false;
