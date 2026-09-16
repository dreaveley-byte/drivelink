-- The previous backfill (migration 166) approximated completed_at from
-- updated_at, but deliberately skipped any job touched in the last day -
-- which excluded genuinely-this-week completions from every total rather
-- than just avoiding the "looks recent because it was re-touched"
-- problem it was meant to fix. That was overly cautious: job_status_events
-- has been recording the real, exact moment each job's status changed -
-- including to 'completed' - since early in this app's history. That's
-- the actual historical record, not an approximation, so there's no need
-- to guess from updated_at at all.
update jobs j
set completed_at = coalesce(
  (select min(created_at) from job_status_events e where e.job_id = j.id and e.status = 'completed'),
  j.updated_at
)
where j.status = 'completed' and j.completed_at is null;
