-- ParkSRM transactional booking layer.
-- Apply after 0001_initial_schema.sql. All wallet mutations happen inside DB transactions.
create extension if not exists btree_gist;

-- A profile is created only after Supabase Auth has verified the institutional email.
drop policy if exists "profile owner can insert own profile" on public.profiles;
create policy "profile owner can insert own profile"
  on public.profiles for insert to authenticated
  with check (
    auth.uid() = id
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and lower(email) like '%@srmist.edu.in'
  );

create or replace function public.initialize_profile_wallet()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.wallets(user_id, available_credits, held_credits)
  values (new.id, 100, 0)
  on conflict (user_id) do nothing;

  insert into public.credit_ledger(
    user_id, entry_type, available_delta, held_delta, note, idempotency_key
  )
  values (
    new.id, 'initial_credit', 100, 0, 'Initial demo allocation', 'initial:' || new.id::text
  )
  on conflict (idempotency_key) do nothing;

  return new;
end;
$$;

drop trigger if exists profiles_initialize_wallet on public.profiles;
create trigger profiles_initialize_wallet
after insert on public.profiles
for each row execute function public.initialize_profile_wallet();

-- Checks a requested local campus-time interval against timetable rows.
-- Separate sessions are joined when the gap is <= 180 minutes.
create or replace function public.user_has_eligible_timetable_window(
  p_user_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_start_local timestamp;
  v_end_local timestamp;
  v_window_start time;
  v_window_end time;
  v_row record;
begin
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    return false;
  end if;

  v_start_local := p_starts_at at time zone 'Asia/Kolkata';
  v_end_local := p_ends_at at time zone 'Asia/Kolkata';
  if v_start_local::date <> v_end_local::date then
    return false;
  end if;

  for v_row in
    select starts_at, ends_at
    from public.timetable_sessions
    where user_id = p_user_id
      and day_of_week = extract(isodow from v_start_local)::smallint
    order by starts_at
  loop
    if v_window_start is null then
      v_window_start := v_row.starts_at;
      v_window_end := v_row.ends_at;
    elsif v_row.starts_at - v_window_end <= interval '180 minutes' then
      v_window_end := greatest(v_window_end, v_row.ends_at);
    else
      if v_start_local::time >= v_window_start
         and v_end_local::time <= v_window_end then
        return true;
      end if;
      v_window_start := v_row.starts_at;
      v_window_end := v_row.ends_at;
    end if;
  end loop;

  return v_window_start is not null
    and v_start_local::time >= v_window_start
    and v_end_local::time <= v_window_end;
end;
$$;

-- One call creates a physical slot reservation and moves 25 credits to held.
-- The wallet row lock serializes same-user requests; slot row locks plus the
-- exclusion constraint prevent overlapping allocations to the same physical slot.
create or replace function public.create_parking_reservation(
  p_zone_id uuid,
  p_vehicle_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.wallets%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_slot_id uuid;
  v_slot_code text;
  v_reservation public.reservations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if coalesce(length(trim(p_idempotency_key)), 0) < 12 then
    raise exception 'A unique idempotency key (at least 12 characters) is required';
  end if;
  if p_starts_at <= now() then
    raise exception 'Reservation start must be in the future';
  end if;
  if not public.user_has_eligible_timetable_window(v_user_id, p_starts_at, p_ends_at) then
    raise exception 'Requested time is outside your timetable-linked parking window';
  end if;

  select * into v_wallet
  from public.wallets
  where user_id = v_user_id
  for update;
  if not found then
    raise exception 'Wallet not found. Complete profile setup first.';
  end if;

  -- Idempotent retry: never charge twice for the same client request.
  select * into v_reservation
  from public.reservations
  where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'reservation_id', v_reservation.id,
      'slot_id', v_reservation.slot_id,
      'starts_at', v_reservation.starts_at,
      'ends_at', v_reservation.ends_at,
      'status', v_reservation.status,
      'available_credits', v_wallet.available_credits,
      'held_credits', v_wallet.held_credits,
      'idempotent_replay', true
    );
  end if;

  if v_wallet.available_credits < 25 then
    raise exception 'Insufficient available credits';
  end if;

  select * into v_vehicle
  from public.vehicles
  where id = p_vehicle_id and user_id = v_user_id;
  if not found then
    raise exception 'Vehicle does not belong to the signed-in user';
  end if;

  select s.id, s.slot_code into v_slot_id, v_slot_code
  from public.parking_slots s
  join public.parking_zones z on z.id = s.zone_id
  where s.zone_id = p_zone_id
    and s.active = true
    and z.active = true
    and s.vehicle_type = v_vehicle.vehicle_type
    and not exists (
      select 1
      from public.reservations r
      where r.slot_id = s.id
        and r.status in ('held','confirmed','checked_in')
        and tstzrange(r.starts_at, r.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    )
  order by s.slot_code
  for update of s skip locked
  limit 1;

  if v_slot_id is null then
    raise exception 'No compatible physical slot is available for this window';
  end if;

  insert into public.reservations(
    user_id, vehicle_id, slot_id, starts_at, ends_at, status, idempotency_key
  )
  values (
    v_user_id, p_vehicle_id, v_slot_id, p_starts_at, p_ends_at, 'held', p_idempotency_key
  )
  returning * into v_reservation;

  update public.wallets
  set available_credits = available_credits - 25,
      held_credits = held_credits + 25,
      updated_at = now()
  where user_id = v_user_id
  returning * into v_wallet;

  insert into public.credit_ledger(
    user_id, reservation_id, entry_type, available_delta, held_delta, note, idempotency_key
  )
  values (
    v_user_id, v_reservation.id, 'hold', -25, 25,
    '25 credits held for parking reservation', 'hold:' || p_idempotency_key
  );

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    v_user_id, 'reservation.created', 'reservation', v_reservation.id::text,
    jsonb_build_object('slot_code', v_slot_code, 'credits_held', 25)
  );

  return jsonb_build_object(
    'reservation_id', v_reservation.id,
    'slot_id', v_slot_id,
    'slot_code', v_slot_code,
    'starts_at', v_reservation.starts_at,
    'ends_at', v_reservation.ends_at,
    'grace_ends_at', v_reservation.grace_ends_at,
    'status', v_reservation.status,
    'available_credits', v_wallet.available_credits,
    'held_credits', v_wallet.held_credits,
    'idempotent_replay', false
  );
end;
$$;

create or replace function public.check_in_parking_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_res public.reservations%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_res from public.reservations
  where id = p_reservation_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Reservation not found'; end if;
  if v_res.status = 'checked_in' then
    return jsonb_build_object('reservation_id', v_res.id, 'status', v_res.status, 'idempotent_replay', true);
  end if;
  if v_res.status not in ('held','confirmed') then raise exception 'Reservation is not check-in eligible'; end if;
  if now() < v_res.starts_at - interval '15 minutes' or now() > v_res.grace_ends_at then
    raise exception 'Check-in is outside the allowed arrival window';
  end if;

  update public.reservations set status = 'checked_in', checked_in_at = now()
  where id = v_res.id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id)
  values (v_user_id, 'reservation.checked_in', 'reservation', v_res.id::text);
  return jsonb_build_object('reservation_id', v_res.id, 'status', 'checked_in', 'idempotent_replay', false);
end;
$$;

-- On-time checkout releases the exact held credits. Late checkout forfeits them.
-- The reservation row lock makes retries safe and prevents duplicate ledger entries.
create or replace function public.checkout_parking_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_res public.reservations%rowtype;
  v_wallet public.wallets%rowtype;
  v_late boolean;
  v_status public.reservation_status;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_res from public.reservations
  where id = p_reservation_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Reservation not found'; end if;

  if v_res.status in ('completed','late','cancelled','expired') then
    select * into v_wallet from public.wallets where user_id = v_user_id;
    return jsonb_build_object('reservation_id', v_res.id, 'status', v_res.status,
      'available_credits', v_wallet.available_credits, 'held_credits', v_wallet.held_credits,
      'idempotent_replay', true);
  end if;
  if v_res.status <> 'checked_in' then
    raise exception 'Check-in must be recorded before checkout';
  end if;

  select * into v_wallet from public.wallets where user_id = v_user_id for update;
  v_late := clock_timestamp() > v_res.grace_ends_at;
  v_status := case when v_late then 'late'::public.reservation_status else 'completed'::public.reservation_status end;

  update public.wallets
  set available_credits = available_credits + case when v_late then 0 else 25 end,
      held_credits = greatest(0, held_credits - 25),
      updated_at = now()
  where user_id = v_user_id
  returning * into v_wallet;

  update public.reservations
  set status = v_status, checked_out_at = now()
  where id = v_res.id;

  insert into public.credit_ledger(
    user_id, reservation_id, entry_type, available_delta, held_delta, note, idempotency_key
  )
  values (
    v_user_id, v_res.id,
    case when v_late then 'forfeit'::public.ledger_type else 'release'::public.ledger_type end,
    case when v_late then 0 else 25 end, -25,
    case when v_late then 'Late checkout: held credits forfeited' else 'On-time checkout: held credits released' end,
    'checkout:' || v_res.id::text
  )
  on conflict (idempotency_key) do nothing;

  if v_late then
    insert into public.penalties(reservation_id, user_id, penalty_credits, reason)
    values (v_res.id, v_user_id, 25, 'Vehicle retrieved after the 10-minute grace period')
    on conflict (reservation_id) do nothing;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id)
  values (v_user_id, case when v_late then 'reservation.late_checkout' else 'reservation.completed' end,
    'reservation', v_res.id::text);

  return jsonb_build_object('reservation_id', v_res.id, 'status', v_status,
    'available_credits', v_wallet.available_credits, 'held_credits', v_wallet.held_credits,
    'idempotent_replay', false);
end;
$$;

create or replace function public.cancel_parking_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_res public.reservations%rowtype;
  v_wallet public.wallets%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_res from public.reservations
  where id = p_reservation_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Reservation not found'; end if;
  if v_res.status = 'cancelled' then
    select * into v_wallet from public.wallets where user_id = v_user_id;
    return jsonb_build_object('reservation_id', v_res.id, 'status', 'cancelled',
      'available_credits', v_wallet.available_credits, 'held_credits', v_wallet.held_credits,
      'idempotent_replay', true);
  end if;
  if v_res.status not in ('held','confirmed') or now() >= v_res.starts_at then
    raise exception 'Only future, not-yet-checked-in reservations can be cancelled';
  end if;

  select * into v_wallet from public.wallets where user_id = v_user_id for update;
  update public.wallets
  set available_credits = available_credits + 25,
      held_credits = greatest(0, held_credits - 25),
      updated_at = now()
  where user_id = v_user_id
  returning * into v_wallet;

  update public.reservations set status = 'cancelled' where id = v_res.id;
  insert into public.credit_ledger(
    user_id, reservation_id, entry_type, available_delta, held_delta, note, idempotency_key
  )
  values (
    v_user_id, v_res.id, 'release', 25, -25,
    'Reservation cancelled: credits released', 'cancel:' || v_res.id::text
  )
  on conflict (idempotency_key) do nothing;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id)
  values (v_user_id, 'reservation.cancelled', 'reservation', v_res.id::text);

  return jsonb_build_object('reservation_id', v_res.id, 'status', 'cancelled',
    'available_credits', v_wallet.available_credits, 'held_credits', v_wallet.held_credits,
    'idempotent_replay', false);
end;
$$;

-- Service-role scheduler: invoke from Supabase Cron every minute.
-- This covers abandoned check-ins after the grace deadline.
create or replace function public.expire_overdue_parking_reservations()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_res record;
  v_count integer := 0;
begin
  for v_res in
    select * from public.reservations
    where status = 'checked_in' and grace_ends_at < now()
    order by grace_ends_at
    for update skip locked
    limit 200
  loop
    update public.wallets
    set held_credits = greatest(0, held_credits - 25), updated_at = now()
    where user_id = v_res.user_id;

    update public.reservations set status = 'late', checked_out_at = now()
    where id = v_res.id;

    insert into public.credit_ledger(
      user_id, reservation_id, entry_type, available_delta, held_delta, note, idempotency_key
    )
    values (
      v_res.user_id, v_res.id, 'forfeit', 0, -25,
      'Reservation expired after grace period without checkout', 'expire:' || v_res.id::text
    )
    on conflict (idempotency_key) do nothing;

    insert into public.penalties(reservation_id, user_id, penalty_credits, reason)
    values (v_res.id, v_res.user_id, 25, 'No checkout recorded before grace deadline')
    on conflict (reservation_id) do nothing;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- RPCs are callable by signed-in users only. Expiry is service-role only.
revoke all on function public.initialize_profile_wallet() from public, anon, authenticated;
revoke all on function public.user_has_eligible_timetable_window(uuid,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.create_parking_reservation(uuid,uuid,timestamptz,timestamptz,text) from public, anon;
revoke all on function public.check_in_parking_reservation(uuid) from public, anon;
revoke all on function public.checkout_parking_reservation(uuid) from public, anon;
revoke all on function public.cancel_parking_reservation(uuid) from public, anon;
revoke all on function public.expire_overdue_parking_reservations() from public, anon, authenticated;
grant execute on function public.create_parking_reservation(uuid,uuid,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.check_in_parking_reservation(uuid) to authenticated;
grant execute on function public.checkout_parking_reservation(uuid) to authenticated;
grant execute on function public.cancel_parking_reservation(uuid) to authenticated;
grant execute on function public.expire_overdue_parking_reservations() to service_role;
