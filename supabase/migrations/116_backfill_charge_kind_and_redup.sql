-- Root cause found: some jobs have flight/ground-transport charges from
-- before the "kind" tagging system existed in the code. Those entries are
-- missing the kind field entirely, so the existing dedup logic (which only
-- recognizes and replaces charges with a KNOWN kind) treats them as
-- permanent manual charges and can never clean them up, no matter how many
-- times the job gets recalculated. This backfills the missing kind based on
-- each entry's recognizable description pattern, then re-runs the dedup so
-- jobs affected by this get fixed immediately.

create or replace function backfill_charge_kind(charge jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_desc text;
begin
  if charge ? 'kind' then
    return charge;
  end if;
  v_desc := charge->>'description';
  if v_desc is null then
    return charge;
  end if;
  if v_desc like 'Return ground transport%' then
    return charge || jsonb_build_object('kind', 'ground-home');
  elsif v_desc like 'Ground transport to airport%' then
    return charge || jsonb_build_object('kind', 'ground-to-airport');
  elsif v_desc like 'Flight back%' then
    return charge || jsonb_build_object('kind', 'flight');
  elsif v_desc like '%ferry%' or v_desc like '%Ferry%' then
    return charge || jsonb_build_object('kind', 'ferry');
  elsif v_desc like 'Bus back%' then
    return charge || jsonb_build_object('kind', 'bus');
  end if;
  return charge;
end;
$$;

alter table jobs disable trigger jobs_set_updated_at;

update jobs
set additional_charges = coalesce((
  select jsonb_agg(backfill_charge_kind(elem))
  from jsonb_array_elements(additional_charges) as elem
), '[]'::jsonb)
where additional_charges is not null and jsonb_typeof(additional_charges) = 'array';

-- Re-fire the dedup trigger now that the backfilled kind values make the
-- old duplicate entries actually recognizable as duplicates.
update jobs set additional_charges = additional_charges where additional_charges is not null;

alter table jobs enable trigger jobs_set_updated_at;

drop function backfill_charge_kind(jsonb);
