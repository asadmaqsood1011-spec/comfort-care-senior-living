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
-- Care Ops: family updates piggyback on communication_messages (safe if table missing)

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'communication_messages') then
    -- relax direction CHECK constraint
    if exists (select 1 from pg_constraint where conname = 'communication_messages_direction_check') then
      alter table public.communication_messages drop constraint communication_messages_direction_check;
    end if;
    alter table public.communication_messages
      add constraint communication_messages_direction_check
      check (direction in ('inbound','outbound','outbound_family','outbound_lead','outbound_staff'));

    -- add sent_by if missing
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'communication_messages' and column_name = 'sent_by') then
      alter table public.communication_messages add column sent_by uuid;
    end if;

    create index if not exists comm_msg_resident_idx on public.communication_messages(resident_id);
    create index if not exists comm_msg_direction_idx on public.communication_messages(direction);
  else
    -- Create a minimal communication_messages table so family updates work end-to-end
    create table public.communication_messages (
      id uuid primary key default gen_random_uuid(),
      organization_id text not null default 'comfort-care',
      location_id uuid,
      lead_id uuid,
      resident_id uuid,
      direction text not null default 'inbound'
        check (direction in ('inbound','outbound','outbound_family','outbound_lead','outbound_staff')),
      channel text not null default 'email'
        check (channel in ('email','phone','sms','web','note')),
      provider text not null default 'gmail',
      provider_message_id text,
      from_email text default '',
      to_email text default '',
      subject text default '',
      body text default '',
      status text not null default 'received'
        check (status in ('received','read','replied','archived','sent','failed')),
      assigned_to uuid,
      received_at timestamptz,
      sent_at timestamptz,
      sent_by uuid,
      metadata jsonb not null default '{}',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index comm_msg_resident_idx on public.communication_messages(resident_id);
    create index comm_msg_direction_idx on public.communication_messages(direction);

    alter table public.communication_messages enable row level security;
    create policy "Service role full access to comm_msg" on public.communication_messages
      for all to service_role using (true) with check (true);
  end if;
end$$;
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
