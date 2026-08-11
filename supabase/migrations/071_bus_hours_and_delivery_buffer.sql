alter table pricing_settings add column if not exists bus_terminal_buffer_hours numeric not null default 2;
alter table pricing_settings add column if not exists bus_max_distance_km numeric not null default 600;
alter table pricing_settings add column if not exists delivery_handling_buffer_hours numeric not null default 1;
