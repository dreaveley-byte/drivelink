-- Persists whether the return method was auto-selected or manually chosen at
-- posting time. Without this, the edit page had no way to know a dealer had
-- manually locked in a specific return method (e.g. entered a flight price
-- themselves) versus letting auto-select pick one - it always defaulted back
-- to auto-select on load, silently re-running the full comparison and
-- potentially overwriting a manual choice the moment admin recalculated.
alter table jobs add column if not exists auto_select_return_method boolean not null default true;
