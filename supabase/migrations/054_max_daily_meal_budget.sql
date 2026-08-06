alter table pricing_settings add column if not exists max_daily_meal_budget_cents int not null default 6000;
