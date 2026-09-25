-- Root cause found: every single checklist item on the reported job had
-- exactly two copies, with the earliest items showing both copies
-- completed within 1-3 seconds of each other and later items showing one
-- real completion alongside a permanently-null twin. This points to the
-- checklist's initial backfill genuinely creating two full sets back to
-- back (a narrow timing race - e.g. a component remount before the
-- first insert's rows became visible to the second attempt's own
-- existence check) - with no de-duplication in the driver's own
-- checklist UI, the driver ended up seeing two rows per step and, for
-- quick tap items, working through both without necessarily realizing
-- they were duplicates.
--
-- Step 1: before removing any duplicate row, merge its uploaded file
-- paths into whichever row of the pair is being kept, so no uploaded
-- photo/video evidence is lost in the cleanup.
with ranked as (
  select id, job_id, label,
    row_number() over (
      partition by job_id, label
      order by (completed_at is not null) desc, completed_at desc nulls last, id
    ) as rn
  from job_checklist_items
),
keepers as (
  select job_id, label, id as keep_id from ranked where rn = 1
),
merged_files as (
  select k.keep_id, array_agg(distinct f.path) as all_paths
  from keepers k
  join job_checklist_items jci on jci.job_id = k.job_id and jci.label = k.label
  cross join lateral unnest(jci.file_paths) as f(path)
  group by k.keep_id
)
update job_checklist_items jci
set file_paths = mf.all_paths
from merged_files mf
where jci.id = mf.keep_id;

-- Step 2: keep one row per (job, label) - preferring a completed item
-- over an incomplete duplicate, and the most recently completed if both
-- copies were completed - and remove the rest.
with ranked as (
  select id, row_number() over (
    partition by job_id, label
    order by (completed_at is not null) desc, completed_at desc nulls last, id
  ) as rn
  from job_checklist_items
)
delete from job_checklist_items
where id in (select id from ranked where rn > 1);

-- Step 3: make this structurally impossible going forward - a second
-- insert attempt for the same (job, label) now fails outright instead of
-- silently creating a duplicate, regardless of whatever timing race
-- caused it.
alter table job_checklist_items
  add constraint job_checklist_items_job_label_unique unique (job_id, label);
