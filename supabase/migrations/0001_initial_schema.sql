-- ParkSRM initial schema. Apply only to a new Supabase project after review.
create extension if not exists pgcrypto;

create type public.user_role as enum ('student','faculty','researcher');
create type public.vehicle_type as enum ('two-wheeler','four-wheeler');
create type public.reservation_status as enum ('held','confirmed','checked_in','completed','late','cancelled','expired');
create type public.ledger_type as enum ('initial_credit','hold','release','forfeit','adjustment');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique check (lower(email) like '%@srmist.edu.in'),
  role public.user_role not null,
  department text not null,
  batch text,
  registration_id text,
  designation text,
  research_centre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  registration_number text not null unique,
  vehicle_type public.vehicle_type not null,
  make_model text,
  created_at timestamptz not null default now()
);

create table public.timetable_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check(day_of_week between 1 and 6),
  starts_at time not null,
  ends_at time not null,
  course text not null,
  location text,
  source text not null default 'user_import' check(source in ('user_import','manual','institutional')),
  created_at timestamptz not null default now(),
  check(ends_at > starts_at)
);

create table public.parking_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area_description text,
  capacity_two_wheeler integer not null default 0 check(capacity_two_wheeler >= 0),
  capacity_four_wheeler integer not null default 0 check(capacity_four_wheeler >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.parking_slots (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.parking_zones(id),
  slot_code text not null,
  vehicle_type public.vehicle_type not null,
  active boolean not null default true,
  unique(zone_id,slot_code)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  vehicle_id uuid not null references public.vehicles(id),
  slot_id uuid not null references public.parking_slots(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  grace_ends_at timestamptz generated always as (ends_at + interval '10 minutes') stored,
  status public.reservation_status not null default 'confirmed',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  unique(user_id,idempotency_key),
  check(ends_at > starts_at)
);

-- Prevent two live reservations from overlapping on the same physical slot.
create extension if not exists btree_gist;
alter table public.reservations add constraint reservations_no_slot_overlap
  exclude using gist (slot_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
  where (status in ('held','confirmed','checked_in'));

create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  available_credits integer not null default 100 check(available_credits >= 0),
  held_credits integer not null default 0 check(held_credits >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  reservation_id uuid references public.reservations(id),
  entry_type public.ledger_type not null,
  available_delta integer not null,
  held_delta integer not null,
  note text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table public.penalties (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id),
  user_id uuid not null references public.profiles(id),
  penalty_credits integer not null default 25 check(penalty_credits >= 0),
  reason text not null,
  disputed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Profile creation is intentionally handled by a trusted onboarding flow.
-- Do not expose wallet/ledger/reservation mutations directly to clients.

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.timetable_sessions enable row level security;
alter table public.parking_zones enable row level security;
alter table public.parking_slots enable row level security;
alter table public.reservations enable row level security;
alter table public.wallets enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.penalties enable row level security;
alter table public.audit_logs enable row level security;

create policy "profile owner can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "profile owner can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "owner manages own vehicles" on public.vehicles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner manages own timetable" on public.timetable_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "authenticated users read active zones" on public.parking_zones for select to authenticated using (active = true);
create policy "authenticated users read active slots" on public.parking_slots for select to authenticated using (active = true);
create policy "owner reads own reservations" on public.reservations for select using (auth.uid() = user_id);
create policy "owner reads own wallet" on public.wallets for select using (auth.uid() = user_id);
create policy "owner reads own ledger" on public.credit_ledger for select using (auth.uid() = user_id);
create policy "owner reads own penalties" on public.penalties for select using (auth.uid() = user_id);

-- No client-side INSERT/UPDATE/DELETE policies are provided for reservations,
-- wallets, ledger, penalties, or audit logs. Use trusted Edge Functions/RPCs.
