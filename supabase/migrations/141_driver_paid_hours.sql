-- Stores the actual hours used to calculate driver pay (driverPaidHours
-- from the pricing engine) - correctly round-trip-aware for vehicle
-- deliveries (doubles the one-way drive time unless the driver is flying
-- back), plus inspection/registry/insurance/ferry wait time where
-- applicable. estimated_duration_minutes is only ever the raw one-way
-- Google Maps figure and was never meant to represent booked/paid hours on
-- its own - this new column is the correct source for that comparison.
alter table jobs add column if not exists driver_paid_hours numeric;
