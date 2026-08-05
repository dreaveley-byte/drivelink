alter table pricing_settings add column if not exists flight_airport_buffer_hours numeric not null default 3;
alter table pricing_settings add column if not exists break_duration_minutes int not null default 15;
