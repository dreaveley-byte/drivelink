create or replace function submit_customer_feedback(p_token uuid, p_rating int, p_feedback text)
returns void language plpgsql security definer as $$
declare
  v_driver_id uuid;
begin
  select driver_id into v_driver_id from jobs where tracking_token = p_token;

  if v_driver_id is not null and v_driver_id = auth.uid() then
    raise exception 'You can''t rate your own job.';
  end if;

  update jobs set customer_rating = p_rating, customer_feedback = p_feedback
  where tracking_token = p_token;
end;
$$;

grant execute on function submit_customer_feedback(uuid, int, text) to anon, authenticated;
