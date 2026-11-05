-- Atomically replace a user's timetable with an imported/manual schedule.
create or replace function public.replace_user_timetable(p_sessions jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item record;
  v_count integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if jsonb_typeof(p_sessions) <> 'array' then raise exception 'Sessions must be a JSON array'; end if;
  if jsonb_array_length(p_sessions) > 300 then raise exception 'At most 300 sessions can be imported'; end if;

  delete from public.timetable_sessions where user_id = v_user_id;

  for v_item in
    select * from jsonb_to_recordset(p_sessions) as x(
      day_of_week integer,
      starts_at time,
      ends_at time,
      course text,
      location text
    )
  loop
    if v_item.day_of_week < 1 or v_item.day_of_week > 6 then
      raise exception 'Day of week must be between 1 (Monday) and 6 (Saturday)';
    end if;
    if v_item.starts_at is null or v_item.ends_at is null or v_item.ends_at <= v_item.starts_at then
      raise exception 'Each timetable session must have a valid start and end time';
    end if;
    if coalesce(length(trim(v_item.course)),0) = 0 then
      raise exception 'Course title cannot be empty';
    end if;

    insert into public.timetable_sessions(user_id,day_of_week,starts_at,ends_at,course,location,source)
    values (v_user_id,v_item.day_of_week,v_item.starts_at,v_item.ends_at,trim(v_item.course),nullif(trim(v_item.location),''),'user_import');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.replace_user_timetable(jsonb) from public, anon;
grant execute on function public.replace_user_timetable(jsonb) to authenticated;
