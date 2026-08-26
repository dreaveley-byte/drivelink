create or replace function dedupe_additional_charges()
returns trigger
language plpgsql
as $$
declare
  v_result jsonb;
  v_seen_kinds text[] := '{}';
  v_item jsonb;
  v_kind text;
  v_reversed jsonb;
  v_kept jsonb := '[]'::jsonb;
begin
  if NEW.additional_charges is null or jsonb_typeof(NEW.additional_charges) <> 'array' then
    return NEW;
  end if;

  select jsonb_agg(elem) into v_reversed
  from (
    select elem
    from jsonb_array_elements(NEW.additional_charges) with ordinality as t(elem, ord)
    order by ord desc
  ) sub;

  if v_reversed is null then
    return NEW;
  end if;

  for v_item in select * from jsonb_array_elements(v_reversed)
  loop
    v_kind := v_item->>'kind';
    if v_kind is null then
      v_kept := v_kept || jsonb_build_array(v_item);
    elsif not (v_kind = any(v_seen_kinds)) then
      v_seen_kinds := array_append(v_seen_kinds, v_kind);
      v_kept := v_kept || jsonb_build_array(v_item);
    end if;
  end loop;

  select jsonb_agg(elem) into v_result
  from (
    select elem
    from jsonb_array_elements(v_kept) with ordinality as t(elem, ord)
    order by ord desc
  ) sub;

  NEW.additional_charges := coalesce(v_result, '[]'::jsonb);
  return NEW;
end;
$$;

drop trigger if exists trg_dedupe_additional_charges on jobs;
create trigger trg_dedupe_additional_charges
before insert or update on jobs
for each row
execute function dedupe_additional_charges();

-- One-time retroactive cleanup: trivially re-save every job's own
-- additional_charges to itself, which fires the trigger above against all
-- existing data - fixes any job already affected by the duplicate-charges
-- bug immediately, rather than only protecting future saves. The
-- updated_at auto-trigger is temporarily disabled for this specific
-- statement so this cleanup doesn't bump every job's updated_at timestamp,
-- which would otherwise corrupt payroll's "completed this week/month"
-- calculations (those filter by updated_at) for every job in the system.
alter table jobs disable trigger jobs_set_updated_at;
update jobs set additional_charges = additional_charges where additional_charges is not null;
alter table jobs enable trigger jobs_set_updated_at;
