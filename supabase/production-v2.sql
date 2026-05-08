-- Comfort Care Production v2: multi-location operations CRM.
-- Run in Supabase SQL Editor after reviewing location names and seed users.
-- This migration is additive and does not remove the existing demo/v1 tables.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('super_admin', 'regional_manager', 'location_admin', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status_v2 as enum ('new', 'contacted', 'tour_scheduled', 'move_in', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('todo', 'in_progress', 'done', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.follow_up_status as enum ('open', 'completed', 'missed', 'archived');
exception when duplicate_object then null; end $$;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  address text default '',
  city text default '',
  state text default 'MI',
  phone text default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  role public.user_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.user_location_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  access_level public.user_role not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (user_id, location_id)
);

create table if not exists public.leads_v2 (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  full_name text not null,
  phone text not null,
  email text,
  normalized_phone text not null,
  normalized_email text,
  care_type text not null default 'Not sure yet',
  source text not null default 'Website',
  status public.lead_status_v2 not null default 'new',
  relationship_to_resident text default '',
  move_timeline text default '',
  payment_type text default '',
  current_situation text default '',
  preferred_contact_method text default '',
  best_contact_time text default '',
  priority_tags text[] not null default '{}',
  lead_score integer not null default 0,
  lead_temperature text not null default 'cold',
  duplicate_of uuid references public.leads_v2(id),
  duplicate_reason text default '',
  notes_summary text default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.residents_v2 (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  lead_id uuid references public.leads_v2(id) on delete set null,
  full_name text not null,
  room_number text default '',
  care_level text default 'Assisted Living',
  move_in_date date,
  status text not null default 'active',
  emergency_contact_name text default '',
  emergency_contact_phone text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  lead_id uuid not null references public.leads_v2(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled',
  notes text default '',
  calendar_provider text default '',
  calendar_event_id text default '',
  completed_at timestamptz,
  no_show_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  lead_id uuid references public.leads_v2(id) on delete cascade,
  resident_id uuid references public.residents_v2(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz not null,
  status public.follow_up_status not null default 'open',
  note text default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (lead_id is not null or resident_id is not null)
);

create table if not exists public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  lead_id uuid references public.leads_v2(id) on delete set null,
  resident_id uuid references public.residents_v2(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  task_type text default 'Other',
  status public.task_status not null default 'todo',
  due_at timestamptz,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  entity_type text not null,
  entity_id uuid not null,
  body text not null,
  visibility text not null default 'internal',
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  entity_type text not null default 'location',
  entity_id uuid,
  bucket text not null default 'operations-documents',
  storage_path text not null,
  file_name text not null,
  file_type text default '',
  file_size bigint default 0,
  document_type text default 'Other',
  notes text default '',
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.email_history (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  lead_id uuid references public.leads_v2(id) on delete set null,
  resident_id uuid references public.residents_v2(id) on delete set null,
  recipient_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft',
  provider text default '',
  provider_message_id text default '',
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations(id),
  lead_id uuid references public.leads_v2(id) on delete set null,
  source text not null default 'Website',
  payload jsonb not null default '{}',
  ip_hash text default '',
  user_agent text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_user_location_access_user on public.user_location_access (user_id);
create index if not exists idx_user_location_access_location on public.user_location_access (location_id);
create index if not exists idx_leads_v2_location_created on public.leads_v2 (location_id, created_at desc);
create index if not exists idx_leads_v2_phone_created on public.leads_v2 (normalized_phone, created_at desc);
create index if not exists idx_leads_v2_email on public.leads_v2 (normalized_email);
create index if not exists idx_leads_v2_status on public.leads_v2 (status);
create index if not exists idx_tours_location_scheduled on public.tours (location_id, scheduled_at);
create index if not exists idx_followups_location_due on public.follow_ups (location_id, due_at);
create index if not exists idx_tasks_location_due on public.staff_tasks (location_id, due_at);
create index if not exists idx_notes_entity on public.notes (entity_type, entity_id);
create index if not exists idx_activity_location_created on public.activity_logs (location_id, created_at desc);
create index if not exists idx_activity_entity on public.activity_logs (entity_type, entity_id);
create index if not exists idx_documents_location on public.documents (location_id, created_at desc);
create index if not exists idx_email_history_location on public.email_history (location_id, created_at desc);

create or replace function public.auth_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_user_role() = 'super_admin', false)
$$;

create or replace function public.can_access_location(target_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.user_location_access ula
      join public.profiles p on p.id = ula.user_id
      where ula.user_id = auth.uid()
        and ula.location_id = target_location_id
        and p.active = true
    )
$$;

create or replace function public.is_manager_for_location(target_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.user_location_access ula
      where ula.user_id = auth.uid()
        and ula.location_id = target_location_id
        and ula.access_level in ('regional_manager', 'location_admin')
    )
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'locations','profiles','user_location_access','leads_v2','residents_v2','tours',
    'follow_ups','staff_tasks','notes','activity_logs','documents','email_history','intake_submissions'
  ] loop
    execute format('drop trigger if exists touch_%I_updated_at on public.%I', t, t);
    execute format('create trigger touch_%I_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

insert into public.locations (name, slug, city, state)
values
  ('August Haus Comfort Care', 'august-haus-comfort-care', 'Gaylord', 'MI'),
  ('Bavarian Comfort Care', 'bavarian-comfort-care', 'Bridgeport', 'MI'),
  ('Bay City Comfort Care', 'bay-city-comfort-care', 'Bay City', 'MI'),
  ('Big Rapids Fields Comfort Care', 'big-rapids-fields-comfort-care', 'Big Rapids', 'MI'),
  ('Brighton Comfort Care', 'brighton-comfort-care', 'Brighton', 'MI'),
  ('Chesaning Comfort Care', 'chesaning-comfort-care', 'Chesaning', 'MI'),
  ('Livonia Comfort Care', 'livonia-comfort-care', 'Livonia', 'MI'),
  ('Marshall Comfort Care', 'marshall-comfort-care', 'Marshall', 'MI'),
  ('Mount Pleasant Comfort Care', 'mount-pleasant-comfort-care', 'Mount Pleasant', 'MI'),
  ('Reed City Fields Comfort Care', 'reed-city-fields-comfort-care', 'Reed City', 'MI'),
  ('Shelby Comfort Care', 'shelby-comfort-care', 'Shelby Township', 'MI'),
  ('Shields/Saginaw Comfort Care', 'shields-saginaw-comfort-care', 'Saginaw', 'MI'),
  ('Vassar Comfort Care', 'vassar-comfort-care', 'Vassar', 'MI')
on conflict (slug) do update set
  name = excluded.name,
  city = excluded.city,
  state = excluded.state;

alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.user_location_access enable row level security;
alter table public.leads_v2 enable row level security;
alter table public.residents_v2 enable row level security;
alter table public.tours enable row level security;
alter table public.follow_ups enable row level security;
alter table public.staff_tasks enable row level security;
alter table public.notes enable row level security;
alter table public.activity_logs enable row level security;
alter table public.documents enable row level security;
alter table public.email_history enable row level security;
alter table public.intake_submissions enable row level security;

drop policy if exists "Locations readable by assigned users" on public.locations;
create policy "Locations readable by assigned users"
  on public.locations for select
  to authenticated
  using (public.is_super_admin() or public.can_access_location(id));

drop policy if exists "Super admins manage locations" on public.locations;
create policy "Super admins manage locations"
  on public.locations for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Users read own profile or super admin reads all" on public.profiles;
create policy "Users read own profile or super admin reads all"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_super_admin());

drop policy if exists "Super admins manage profiles" on public.profiles;
create policy "Super admins manage profiles"
  on public.profiles for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Users read assigned location access" on public.user_location_access;
create policy "Users read assigned location access"
  on public.user_location_access for select
  to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists "Super admins manage location access" on public.user_location_access;
create policy "Super admins manage location access"
  on public.user_location_access for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Public intake can create leads" on public.leads_v2;
create policy "Public intake can create leads"
  on public.leads_v2 for insert
  to anon
  with check (
    full_name is not null
    and phone is not null
    and source in ('Website', 'Tablet')
    and status = 'new'
  );

drop policy if exists "Authenticated users read location leads" on public.leads_v2;
create policy "Authenticated users read location leads"
  on public.leads_v2 for select
  to authenticated
  using (public.can_access_location(location_id));

drop policy if exists "Staff create location leads" on public.leads_v2;
create policy "Staff create location leads"
  on public.leads_v2 for insert
  to authenticated
  with check (public.can_access_location(location_id));

drop policy if exists "Staff update location leads" on public.leads_v2;
create policy "Staff update location leads"
  on public.leads_v2 for update
  to authenticated
  using (public.can_access_location(location_id))
  with check (public.can_access_location(location_id));

drop policy if exists "Managers delete/archive location leads" on public.leads_v2;
create policy "Managers delete/archive location leads"
  on public.leads_v2 for delete
  to authenticated
  using (public.is_manager_for_location(location_id));

do $$
declare t text;
begin
  foreach t in array array['residents_v2','tours','follow_ups','staff_tasks','notes','activity_logs','documents','email_history'] loop
    execute format('drop policy if exists "Read %s by location" on public.%I', t, t);
    execute format('create policy "Read %s by location" on public.%I for select to authenticated using (public.can_access_location(location_id))', t, t);
    execute format('drop policy if exists "Create %s by location" on public.%I', t, t);
    execute format('create policy "Create %s by location" on public.%I for insert to authenticated with check (public.can_access_location(location_id))', t, t);
    execute format('drop policy if exists "Update %s by location" on public.%I', t, t);
    execute format('create policy "Update %s by location" on public.%I for update to authenticated using (public.can_access_location(location_id)) with check (public.can_access_location(location_id))', t, t);
    execute format('drop policy if exists "Delete %s by managers" on public.%I', t, t);
    execute format('create policy "Delete %s by managers" on public.%I for delete to authenticated using (public.is_manager_for_location(location_id))', t, t);
  end loop;
end $$;

drop policy if exists "Public intake submissions insert" on public.intake_submissions;
create policy "Public intake submissions insert"
  on public.intake_submissions for insert
  to anon
  with check (source in ('Website', 'Tablet'));

drop policy if exists "Authenticated users read intake submissions by location" on public.intake_submissions;
create policy "Authenticated users read intake submissions by location"
  on public.intake_submissions for select
  to authenticated
  using (public.can_access_location(location_id));

insert into storage.buckets (id, name, public)
values ('operations-documents', 'operations-documents', false)
on conflict (id) do nothing;

drop policy if exists "Read operations documents by location" on storage.objects;
create policy "Read operations documents by location"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'operations-documents'
    and exists (
      select 1
      from public.documents d
      where d.bucket = bucket_id
        and d.storage_path = name
        and public.can_access_location(d.location_id)
    )
  );

drop policy if exists "Upload operations documents by location folder" on storage.objects;
create policy "Upload operations documents by location folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'operations-documents'
    and public.can_access_location((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Update operations documents by location folder" on storage.objects;
create policy "Update operations documents by location folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'operations-documents'
    and public.can_access_location((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'operations-documents'
    and public.can_access_location((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Delete operations documents by managers" on storage.objects;
create policy "Delete operations documents by managers"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'operations-documents'
    and public.is_manager_for_location((storage.foldername(name))[1]::uuid)
  );
