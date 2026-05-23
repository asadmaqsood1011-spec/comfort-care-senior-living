-- Care Ops: incidents (creates from scratch if missing, FK constraints added conditionally)

create table if not exists public.incidents (
  id bigserial primary key,
  resident_id bigint,
  resident_name text default '',
  community text default '',
  type text default 'Other',
  description text not null,
  severity text default 'Low',
  staff_name text default '',
  incident_at timestamptz default now(),
  follow_up_required boolean default false,
  follow_up_notes text default '',
  follow_up_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.incidents
  add column if not exists location_id uuid,
  add column if not exists reporter_user_id uuid,
  add column if not exists status text default 'open',
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='incidents_status_check') then
    alter table public.incidents
      add constraint incidents_status_check check (status in ('open','reviewing','closed'));
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='locations') then
    if not exists (select 1 from pg_constraint where conname='incidents_location_fk') then
      alter table public.incidents
        add constraint incidents_location_fk foreign key (location_id) references public.locations(id);
    end if;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    if not exists (select 1 from pg_constraint where conname='incidents_reporter_fk') then
      alter table public.incidents
        add constraint incidents_reporter_fk foreign key (reporter_user_id) references public.profiles(id);
    end if;
    if not exists (select 1 from pg_constraint where conname='incidents_closed_by_fk') then
      alter table public.incidents
        add constraint incidents_closed_by_fk foreign key (closed_by) references public.profiles(id);
    end if;
  end if;
end$$;

create index if not exists incidents_location_idx on public.incidents(location_id);
create index if not exists incidents_status_idx on public.incidents(status);
create index if not exists incidents_resident_idx on public.incidents(resident_id);

alter table public.incidents enable row level security;

drop policy if exists "Service role full access to incidents" on public.incidents;
create policy "Service role full access to incidents" on public.incidents
  for all to service_role using (true) with check (true);

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='user_location_access') then
    drop policy if exists "Staff read incidents at their locations" on public.incidents;
    create policy "Staff read incidents at their locations" on public.incidents
      for select using (
        location_id is null or location_id in (
          select location_id from public.user_location_access where user_id = auth.uid()
        )
      );

    drop policy if exists "Staff write incidents at their locations" on public.incidents;
    create policy "Staff write incidents at their locations" on public.incidents
      for insert with check (
        location_id in (
          select location_id from public.user_location_access where user_id = auth.uid()
        )
      );

    drop policy if exists "Staff update incidents at their locations" on public.incidents;
    create policy "Staff update incidents at their locations" on public.incidents
      for update using (
        location_id in (
          select location_id from public.user_location_access where user_id = auth.uid()
        )
      );
  end if;
end$$;
