alter table pricing_settings add column if not exists minimum_driver_pay_cents int not null default 1900;
