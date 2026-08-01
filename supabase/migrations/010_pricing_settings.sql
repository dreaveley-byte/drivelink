create table pricing_settings (
  id int primary key default 1,
  hourly_rate_cents int not null default 3000,
  fuel_price_cents_per_litre int not null default 198,
  fuel_economy_driven_l_per_100km numeric not null default 13,
  fuel_economy_towed_l_per_100km numeric not null default 25,
  hotel_rate_cents int not null default 15000,
  overnight_fee_cents int not null default 10000,
  wear_and_tear_cents_per_km int not null default 6,
  meal_allowance_cents int not null default 2000,
  meal_allowance_every_hours numeric not null default 0.5,
  meal_allowance_max_count int not null default 5,
  dealer_markup_percent numeric not null default 120,
  out_of_province_inspection_min_hours numeric not null default 2,
  registry_visit_min_hours numeric not null default 1,
  max_driving_hours_before_overnight numeric not null default 13,
  updated_at timestamptz not null default now(),

  constraint single_row check (id = 1)
);

insert into pricing_settings (id) values (1);

alter table pricing_settings enable row level security;

create policy "anyone logged in can view pricing settings" on pricing_settings
  for select using (auth.uid() is not null);

create policy "only admins update pricing settings" on pricing_settings
  for update using (my_role() = 'platform_admin');

grant select, update on pricing_settings to authenticated;
