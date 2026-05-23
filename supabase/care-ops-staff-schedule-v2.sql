-- Care Ops: staff scheduling (FK constraints added conditionally)

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  user_id uuid not null,
  role text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text default 'scheduled',
  notes text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='staff_shifts_status_check') then
    alter table public.staff_shifts
      add constraint staff_shifts_status_check
      check (status in ('scheduled','published','swapped','cancelled','completed','no_show'));
  end if;
  if not exists (select 1 from pg_constraint where conname='staff_shifts_time_check') then
    alter table public.staff_shifts
      add constraint staff_shifts_time_check check (ends_at > starts_at);
  end if;
end$$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='locations') then
    if not exists (select 1 from pg_constraint where conname='staff_shifts_location_fk') then
      alter table public.staff_shifts
        add constraint staff_shifts_location_fk foreign key (location_id) references public.locations(id);
    end if;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    if not exists (select 1 from pg_constraint where conname='staff_shifts_user_fk') then
      alter table public.staff_shifts
        add constraint staff_shifts_user_fk foreign key (user_id) references public.profiles(id);
    end if;
    if not exists (select 1 from pg_constraint where conname='staff_shifts_created_by_fk') then
      alter table public.staff_shifts
        add constraint staff_shifts_created_by_fk foreign key (created_by) references public.profiles(id);
    end if;
  end if;
end$$;

create index if not exists staff_shifts_location_starts_idx
  on public.staff_shifts(location_id, starts_at);
create index if not exists staff_shifts_user_starts_idx
  on public.staff_shifts(user_id, starts_at);

create table if not exists public.shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.staff_shifts(id) on delete cascade,
  requested_by uuid not null,
  offered_to uuid,
  reason text,
  status text default 'open',
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='shift_swap_requests_status_check') then
    alter table public.shift_swap_requests
      add constraint shift_swap_requests_status_check
      check (status in ('open','accepted','declined','cancelled'));
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    if not exists (select 1 from pg_constraint where conname='shift_swap_requested_by_fk') then
      alter table public.shift_swap_requests
        add constraint shift_swap_requested_by_fk foreign key (requested_by) references public.profiles(id);
    end if;
    if not exists (select 1 from pg_constraint where conname='shift_swap_offered_to_fk') then
      alter table public.shift_swap_requests
        add constraint shift_swap_offered_to_fk foreign key (offered_to) references public.profiles(id);
    end if;
    if not exists (select 1 from pg_constraint where conname='shift_swap_resolved_by_fk') then
      alter table public.shift_swap_requests
        add constraint shift_swap_resolved_by_fk foreign key (resolved_by) references public.profiles(id);
    end if;
  end if;
end$$;

alter table public.staff_shifts enable row level security;
alter table public.shift_swap_requests enable row level security;

drop policy if exists "Service role full access to shifts" on public.staff_shifts;
create policy "Service role full access to shifts" on public.staff_shifts
  for all to service_role using (true) with check (true);

drop policy if exists "Service role full access to swaps" on public.shift_swap_requests;
create policy "Service role full access to swaps" on public.shift_swap_requests
  for all to service_role using (true) with check (true);

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='user_location_access') then
    drop policy if exists "Staff read shifts at their locations" on public.staff_shifts;
    create policy "Staff read shifts at their locations" on public.staff_shifts
      for select using (
        location_id in (select location_id from public.user_location_access where user_id = auth.uid())
      );

    drop policy if exists "Staff manage shifts at their locations" on public.staff_shifts;
    create policy "Staff manage shifts at their locations" on public.staff_shifts
      for all using (
        location_id in (select location_id from public.user_location_access where user_id = auth.uid())
      ) with check (
        location_id in (select location_id from public.user_location_access where user_id = auth.uid())
      );

    drop policy if exists "Staff manage their swap requests" on public.shift_swap_requests;
    create policy "Staff manage their swap requests" on public.shift_swap_requests
      for all using (
        requested_by = auth.uid() or offered_to = auth.uid() or
        exists (
          select 1 from public.staff_shifts s
          where s.id = shift_id and s.location_id in (
            select location_id from public.user_location_access where user_id = auth.uid()
          )
        )
      );
  end if;
end$$;
