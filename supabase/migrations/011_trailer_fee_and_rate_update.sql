alter table pricing_settings add column trailer_fee_cents_per_day int not null default 12500;

update pricing_settings set
  hourly_rate_cents = 3500,
  fuel_economy_towed_l_per_100km = 18
where id = 1;
