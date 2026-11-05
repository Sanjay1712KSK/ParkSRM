-- Availability snapshot for a requested window; it never mutates inventory.
create or replace function public.get_zone_availability(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_vehicle_type public.vehicle_type
)
returns table (
  zone_id uuid,
  zone_name text,
  area_description text,
  total_slots integer,
  available_slots integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'A valid parking time window is required';
  end if;

  return query
    select z.id, z.name, z.area_description,
      count(s.id)::integer as total_slots,
      count(s.id) filter (where not exists (
        select 1 from public.reservations r
        where r.slot_id = s.id
          and r.status in ('held','confirmed','checked_in')
          and tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
      ))::integer as available_slots
    from public.parking_zones z
    left join public.parking_slots s
      on s.zone_id = z.id and s.active = true and s.vehicle_type = p_vehicle_type
    where z.active = true
    group by z.id, z.name, z.area_description
    order by z.name;
end;
$$;

revoke all on function public.get_zone_availability(timestamptz,timestamptz,public.vehicle_type) from public, anon;
grant execute on function public.get_zone_availability(timestamptz,timestamptz,public.vehicle_type) to authenticated;
