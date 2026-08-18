create or replace function submit_customer_feedback(p_token uuid, p_rating int, p_feedback text)
returns void language plpgsql security definer as $$
declare
  v_driver_id uuid;
  v_job_id uuid;
  v_companion_job_id uuid;
  v_companion_is_chase boolean;
begin
  select id, driver_id, companion_job_id into v_job_id, v_driver_id, v_companion_job_id
  from jobs where tracking_token = p_token;

  if v_driver_id is not null and v_driver_id = auth.uid() then
    raise exception 'You can''t rate your own job.';
  end if;

  update jobs set customer_rating = p_rating, customer_feedback = p_feedback
  where id = v_job_id;

  if v_companion_job_id is not null then
    select is_chase_vehicle_job into v_companion_is_chase from jobs where id = v_companion_job_id;
    if v_companion_is_chase then
      update jobs set customer_rating = p_rating, customer_feedback = p_feedback
      where id = v_companion_job_id;
    end if;
  end if;
end;
$$;

grant execute on function submit_customer_feedback(uuid, int, text) to anon, authenticated;
