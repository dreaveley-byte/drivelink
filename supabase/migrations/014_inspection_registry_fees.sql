alter table pricing_settings add column out_of_province_inspection_fee_cents int not null default 15000;
alter table pricing_settings add column registry_visit_fee_cents int not null default 10000;
