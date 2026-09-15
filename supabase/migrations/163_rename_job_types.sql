-- Renames three job type labels shown in the post-job dropdown. Only the
-- display name changes - the row's id stays the same, so every existing
-- job posted under the old name keeps working exactly as before (jobs
-- reference job_type_id, not the name text).
update job_types set name = 'Sold Vehicle Delivery' where name = 'Vehicle Delivery';
update job_types set name = 'Vehicle Pick / Drop Off' where name = 'Vehicle Pickup';
update job_types set name = 'Dealer Trade' where name = 'Dealer to Dealer';
