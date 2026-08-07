alter table pricing_settings add column if not exists eta_window_buffer_percent numeric not null default 20;
