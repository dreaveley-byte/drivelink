-- ============================================
-- READ RECEIPTS for the internal driver/dealer/admin chat
-- ============================================
create table if not exists job_chat_reads (
  job_id uuid not null references jobs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (job_id, user_id)
);

alter table job_chat_reads enable row level security;

drop policy if exists "participants manage own read state" on job_chat_reads;
create policy "participants manage own read state" on job_chat_reads
  for all using (
    user_id = auth.uid() and exists (
      select 1 from jobs j where j.id = job_chat_reads.job_id
      and (j.organization_id = my_org_id() or j.driver_id = auth.uid() or my_role() = 'platform_admin')
    )
  ) with check (user_id = auth.uid());

grant select, insert, update on job_chat_reads to authenticated;
alter publication supabase_realtime add table job_chat_reads;

-- ============================================
-- CUSTOMER SMS THREAD (separate from the internal team chat — this is a real
-- two-way text conversation between the driver and the customer's phone)
-- ============================================
create table if not exists customer_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  direction text not null check (direction in ('to_customer', 'from_customer')),
  body text not null,
  twilio_sid text,
  created_at timestamptz not null default now()
);

alter table customer_messages enable row level security;

drop policy if exists "participants view customer messages" on customer_messages;
create policy "participants view customer messages" on customer_messages
  for select using (
    exists (
      select 1 from jobs j where j.id = customer_messages.job_id
      and (j.organization_id = my_org_id() or j.driver_id = auth.uid() or my_role() = 'platform_admin')
    )
  );

drop policy if exists "participants send to customer" on customer_messages;
create policy "participants send to customer" on customer_messages
  for insert with check (
    direction = 'to_customer' and exists (
      select 1 from jobs j where j.id = customer_messages.job_id
      and (j.organization_id = my_org_id() or j.driver_id = auth.uid() or my_role() = 'platform_admin')
    )
  );

grant select, insert on customer_messages to authenticated;
alter publication supabase_realtime add table customer_messages;

-- Lets the inbound-SMS webhook (Twilio calling us directly, no user session)
-- safely record a customer's reply by matching their phone to their most
-- relevant job — digit-only comparison so formatting differences don't matter.
create or replace function record_inbound_customer_message(p_phone text, p_body text, p_twilio_sid text)
returns uuid language plpgsql security definer as $$
declare
  v_job_id uuid;
  v_digits text := regexp_replace(p_phone, '\D', '', 'g');
begin
  select id into v_job_id from jobs
  where right(regexp_replace(customer_phone, '\D', '', 'g'), 10) = right(v_digits, 10)
  order by (status not in ('completed', 'cancelled')) desc, updated_at desc
  limit 1;

  if v_job_id is null then
    return null;
  end if;

  insert into customer_messages (job_id, direction, body, twilio_sid)
  values (v_job_id, 'from_customer', p_body, p_twilio_sid);

  return v_job_id;
end;
$$;

grant execute on function record_inbound_customer_message(text, text, text) to anon, authenticated;
