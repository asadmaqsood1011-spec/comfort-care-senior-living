-- Care Ops: shift handoffs (FK constraints added conditionally)

create table if not exists public.shift_handoffs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  from_user_id uuid not null,
  to_user_id uuid,
  shift_label text not null,
  summary text not null,
  resident_alerts jsonb default '[]'::jsonb,
  pending_tasks jsonb default '[]'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz default now()
);

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='locations') then
    if not exists (select 1 from pg_constraint where conname='shift_handoffs_location_fk') then
      alter table public.shift_handoffs
        add constraint shift_handoffs_location_fk foreign key (location_id) references public.locations(id);
    end if;
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    if not exists (select 1 from pg_constraint where conname='shift_handoffs_from_user_fk') then
      alter table public.shift_handoffs
        add constraint shift_handoffs_from_user_fk foreign key (from_user_id) references public.profiles(id);
    end if;
    if not exists (select 1 from pg_constraint where conname='shift_handoffs_to_user_fk') then
      alter table public.shift_handoffs
        add constraint shift_handoffs_to_user_fk foreign key (to_user_id) references public.profiles(id);
    end if;
    if not exists (select 1 from pg_constraint where conname='shift_handoffs_ack_by_fk') then
      alter table public.shift_handoffs
        add constraint shift_handoffs_ack_by_fk foreign key (acknowledged_by) references public.profiles(id);
    end if;
  end if;
end$$;

create index if not exists shift_handoffs_location_idx on public.shift_handoffs(location_id);
create index if not exists shift_handoffs_to_user_idx on public.shift_handoffs(to_user_id);
create index if not exists shift_handoffs_unack_idx on public.shift_handoffs(acknowledged_at)
  where acknowledged_at is null;

alter table public.shift_handoffs enable row level security;

drop policy if exists "Service role full access to handoffs" on public.shift_handoffs;
create policy "Service role full access to handoffs" on public.shift_handoffs
  for all to service_role using (true) with check (true);

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='user_location_access') then
    drop policy if exists "Staff read handoffs at their locations" on public.shift_handoffs;
    create policy "Staff read handoffs at their locations" on public.shift_handoffs
      for select using (
        location_id in (select location_id from public.user_location_access where user_id = auth.uid())
      );

    drop policy if exists "Staff write handoffs at their locations" on public.shift_handoffs;
    create policy "Staff write handoffs at their locations" on public.shift_handoffs
      for insert with check (
        location_id in (select location_id from public.user_location_access where user_id = auth.uid())
      );

    drop policy if exists "Recipient or author can update handoff" on public.shift_handoffs;
    create policy "Recipient or author can update handoff" on public.shift_handoffs
      for update using (
        auth.uid() = from_user_id or auth.uid() = to_user_id or
        location_id in (select location_id from public.user_location_access where user_id = auth.uid())
      );
  end if;
end$$;
