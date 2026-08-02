alter table jobs add column if not exists key_count int;
alter table jobs add column if not exists has_wheel_lock boolean not null default false;
alter table jobs add column if not exists has_charging_cables boolean not null default false;
alter table jobs add column if not exists other_included_items text;
