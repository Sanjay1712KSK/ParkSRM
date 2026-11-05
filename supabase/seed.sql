-- Illustrative, non-authoritative zone inventory for ParkSRM demos.
-- The numbers must be replaced with a campus-approved slot survey before use.
insert into public.parking_zones(id,name,area_description,capacity_two_wheeler,capacity_four_wheeler,active)
values
('00000000-0000-4000-8000-000000000001','North Campus','Near Tech Park',80,40,true),
('00000000-0000-4000-8000-000000000002','Main Block','Academic Block entrance',85,0,true),
('00000000-0000-4000-8000-000000000003','Library Zone','Central Library',40,20,true),
('00000000-0000-4000-8000-000000000004','Hostel Connector','Near campus connector',100,0,true)
on conflict (id) do update set name=excluded.name, area_description=excluded.area_description,
  capacity_two_wheeler=excluded.capacity_two_wheeler,
  capacity_four_wheeler=excluded.capacity_four_wheeler, active=excluded.active;

insert into public.parking_slots(zone_id,slot_code,vehicle_type,active)
select z.id,
  case when seq.n <= z.capacity_two_wheeler
    then case z.name when 'North Campus' then 'N-2W-' when 'Main Block' then 'M-2W-' when 'Library Zone' then 'L-2W-' else 'H-2W-' end
    else case z.name when 'North Campus' then 'N-4W-' else 'L-4W-' end
  end || lpad(case when seq.n <= z.capacity_two_wheeler then seq.n::text else (seq.n-z.capacity_two_wheeler)::text end,3,'0'),
  case when seq.n <= z.capacity_two_wheeler then 'two-wheeler'::public.vehicle_type else 'four-wheeler'::public.vehicle_type end,
  true
from public.parking_zones z
cross join lateral generate_series(1,z.capacity_two_wheeler+z.capacity_four_wheeler) as seq(n)
where z.id in (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004'
)
on conflict (zone_id,slot_code) do update set active=true, vehicle_type=excluded.vehicle_type;
