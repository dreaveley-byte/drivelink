-- Adds the Driver Hours & Fatigue Safety Policy as a new required driver
-- legal document — drivers must read, review and accept it before they can
-- claim/continue claiming jobs, same as the other required driver documents
-- (driver_contractor_agreement, drug_alcohol_policy, etc.). Already-approved
-- drivers get routed through the existing re-sign gate (/driver/resign) the
-- next time they open the app, since this is a NEW required doc slug they
-- have no acceptance row for yet.

insert into legal_documents (slug, version, title, body, audience, is_current, effective_date)
values (
  'driver_hours_fatigue_safety_policy',
  1,
  'Driver Hours & Fatigue Safety Policy',
  'The safety of our drivers, our customers, their vehicles, and the travelling public is Drivflo’s highest priority.

Drivflo has adopted driving-hour and fatigue-management standards modeled on Canadian commercial transportation Hours of Service safety principles, regardless of whether those regulations legally apply to the specific vehicle being transported.

1. 13-Hour Hard Driving Limit
No Drivflo driver may exceed 13 hours of actual driving time within a driving period.

This is a hard safety limit and is not optional.

A driver must not:
continue driving beyond the 13-hour maximum;
accept or continue an assignment that would knowingly require them to exceed the maximum;
alter, ignore, or misrepresent recorded driving time;
continue driving because of a delivery deadline, customer request, dealership request, traffic delay, weather delay, or other scheduling pressure.

No delivery deadline is more important than driver safety.

2. Mandatory Rest
Once a driver reaches the 13-hour driving limit, the driver must stop driving and take a minimum of 10 consecutive hours of rest before beginning another Drivflo driving assignment.

The driver must be sufficiently rested and fit to safely operate a vehicle before returning to service.

3. Fatigue Overrides the Clock
The 13-hour limit is a maximum — not a target.

Drivers are responsible for continuously assessing their fitness to drive.

If at any point a driver feels tired or drowsy; unable to concentrate; heavy-eyed or repeatedly yawning; mentally unfocused; slower than normal in reacting; irritable or unusually distracted; unable to remember portions of the previous few kilometres; is drifting within their lane; is missing exits, turns, signs, or directions; or is otherwise unsafe to continue driving — the driver must stop and rest before continuing.

Drivers have full authority to stop an assignment because of fatigue.

A driver will not be penalized for making a reasonable safety-related decision to stop and rest.

4. Required Breaks
Drivers are expected to take reasonable breaks throughout long-distance assignments for rest; food and hydration; fuel; washroom use; stretching and movement; and maintaining alertness.

Breaks do not give a driver permission to exceed the 13-hour maximum driving limit.

5. Weather and Road Conditions
Drivers must adjust their travel plans according to snow; ice; heavy rain; fog; poor visibility; road closures; construction; traffic; mountain conditions; and any other condition affecting safe vehicle operation.

If road conditions make continued travel unsafe, the driver must stop at a safe location.

Delivery times are estimates and must never override safe driving decisions.

6. Alcohol, Drugs and Impairment
Drivers must never operate a vehicle while impaired by alcohol; cannabis; illegal drugs; prescription medication that impairs the ability to drive; over-the-counter medication causing drowsiness; or any other substance or condition that makes driving unsafe.

7. Driver Responsibility
Before beginning an assignment, every driver is responsible for confirming that they:
are adequately rested;
are physically and mentally fit to drive;
have sufficient available driving time to reasonably complete the assignment;
have disclosed any relevant driving already performed before beginning the Drivflo assignment; and
understand that they must stop if they become fatigued.

8. Drivflo Safety Authority
Drivflo may suspend, delay, reassign, or cancel an assignment where continued operation would create a safety concern.

Drivers must immediately report any situation where they believe they cannot safely complete an assignment within the permitted driving time.

9. Zero Pressure Policy
Dealership personnel, customers, dispatchers, Drivflo personnel, or any other party must never pressure a driver to continue driving while fatigued; exceed Drivflo’s driving-hour limits; speed in order to meet a delivery time; or continue travelling during unsafe road or weather conditions.

If this occurs, the driver must report it to Drivflo.

10. Safety Comes First
13 hours is the maximum — not the goal.

If you are tired, STOP. If conditions are unsafe, STOP. If continuing the trip would put you or others at risk, STOP.

A late vehicle can be explained. An unsafe driving decision cannot always be undone.

By accepting assignments through Drivflo, drivers acknowledge and agree to comply with this Driver Hours & Fatigue Safety Policy.',
  'driver',
  true,
  current_date
);

-- Keep the DB-side gate in sync with DRIVER_REQUIRED_DOCS in
-- src/lib/legalDocuments.ts, per the note in 116_gate_jobs_on_legal_docs.sql.
create or replace function claim_job_if_no_conflict(p_job_id uuid)
returns jobs
language plpgsql
security definer
as $$
declare
  v_job jobs;
  v_start timestamptz;
  v_end timestamptz;
  v_conflict_count int;
  v_has_active_jobs int;
  v_outstanding_docs int;
begin
  select count(*) into v_outstanding_docs
  from legal_documents ld
  where ld.is_current
    and ld.slug in (
      'driver_contractor_agreement',
      'drug_alcohol_policy',
      'driver_standards_code_of_conduct',
      'vehicle_inspection_damage_policy',
      'driver_expense_reimbursement_policy',
      'driver_hours_fatigue_safety_policy',
      'privacy_policy',
      'platform_terms_of_service'
    )
    and not exists (
      select 1 from legal_acceptances la
      where la.user_id = auth.uid()
        and la.document_slug = ld.slug
        and la.document_version = ld.version
    );

  if v_outstanding_docs > 0 then
    raise exception 'A new agreement needs to be signed before you can claim jobs — visit /driver/resign to review it.';
  end if;

  select * into v_job from jobs where id = p_job_id for update;

  if v_job is null then
    raise exception 'Job not found.';
  end if;

  if v_job.status <> 'awaiting_driver' then
    raise exception 'This job is no longer available — someone else may have just claimed it.';
  end if;

  select count(*) into v_has_active_jobs
  from jobs where driver_id = auth.uid() and status in ('assigned', 'picked_up', 'in_progress', 'delivered');

  if v_has_active_jobs > 0 then
    if v_job.scheduled_for is null then
      raise exception 'This job has no scheduled time, and you already have an active job — claim it once your current job is finished.';
    end if;

    v_start := v_job.scheduled_for;
    v_end := v_start + (coalesce(v_job.estimated_duration_minutes, 60) * 2 || ' minutes')::interval;

    select count(*) into v_conflict_count
    from jobs existing
    where existing.driver_id = auth.uid()
      and existing.status in ('assigned', 'picked_up', 'in_progress', 'delivered')
      and (
        existing.scheduled_for is null
        or (
          v_start < existing.scheduled_for + (coalesce(existing.estimated_duration_minutes, 60) * 2 || ' minutes')::interval
          and existing.scheduled_for < v_end
        )
      );

    if v_conflict_count > 0 then
      raise exception 'This job overlaps with a delivery time you already have scheduled — pick one or the other.';
    end if;
  end if;

  update jobs set driver_id = auth.uid(), status = 'assigned' where id = p_job_id returning * into v_job;

  insert into job_status_events (job_id, status, changed_by) values (p_job_id, 'assigned', auth.uid());

  return v_job;
end;
$$;

grant execute on function claim_job_if_no_conflict(uuid) to authenticated;
