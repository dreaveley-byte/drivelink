alter table jobs add column if not exists linked_job_id uuid references jobs(id) on delete set null;
alter table jobs add column if not exists multi_vehicle_arrangement text not null default 'none';
alter table jobs add column if not exists rides_along_with_linked boolean not null default false;

comment on column jobs.multi_vehicle_arrangement is 'none | two_trades_one_purchase | two_purchases_one_trade';
