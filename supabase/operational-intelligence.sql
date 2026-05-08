-- Operational Intelligence CRM migration
-- Run after production-v2.sql. Safe to run multiple times.

create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  location_id uuid not null references public.locations(id) on delete cascade,
  event_type text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'active' check (status in ('active', 'acknowledged', 'resolved')),
  title text not null,
  description text not null default '',
  recommendation text not null default '',
  entity_type text not null default 'location',
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists operational_events_location_status_idx on public.operational_events(location_id, status, detected_at desc);
create index if not exists operational_events_type_idx on public.operational_events(event_type);
create index if not exists operational_events_entity_idx on public.operational_events(entity_type, entity_id);
create index if not exists operational_events_severity_idx on public.operational_events(severity);

alter table public.operational_events
  add column if not exists confidence text default 'medium' check (confidence in ('high', 'medium', 'low')),
  add column if not exists urgency text default 'watch' check (urgency in ('now', 'soon', 'watch', 'healthy')),
  add column if not exists reason text default '',
  add column if not exists time_context text default '',
  add column if not exists escalation_context text default '',
  add column if not exists recommended_action_type text default 'view_details',
  add column if not exists resolved_signal text default '';

create table if not exists public.operational_event_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  scanned_location_ids uuid[] not null default '{}',
  events_detected integer not null default 0,
  events_resolved integer not null default 0,
  errors text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists operational_event_runs_started_idx on public.operational_event_runs(started_at desc);

create table if not exists public.intelligence_rules (
  id uuid primary key default gen_random_uuid(),
  event_type text not null unique,
  enabled boolean not null default true,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  threshold_hours integer,
  cooldown_hours integer not null default 24,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.intelligence_rules(event_type, severity, threshold_hours, cooldown_hours, settings) values
  ('follow_up_overdue', 'medium', 0, 4, '{"description":"Open follow-up due before now"}'),
  ('lead_stale', 'medium', 168, 24, '{"stale_days":7}'),
  ('high_intent_lead_uncontacted', 'high', 2, 4, '{"min_score":70}'),
  ('tour_no_show_risk', 'medium', 24, 4, '{"tour_window_hours":24}'),
  ('inactive_pipeline_segment', 'medium', 168, 24, '{"inactive_days":7}'),
  ('response_time_decline', 'medium', null, 24, '{"min_hours":4,"decline_ratio":1.25}'),
  ('recovery_opportunity_detected', 'medium', 168, 24, '{"min_score":35}'),
  ('occupancy_warning', 'medium', null, 24, '{"target_occupancy":0.85}'),
  ('conversion_drop_detected', 'medium', null, 24, '{"drop":0.1}'),
  ('pipeline_shortfall_risk', 'medium', null, 24, '{"min_hot_or_tours":1}')
on conflict (event_type) do update set
  severity = excluded.severity,
  threshold_hours = excluded.threshold_hours,
  cooldown_hours = excluded.cooldown_hours,
  settings = public.intelligence_rules.settings || excluded.settings,
  updated_at = now();

create table if not exists public.occupancy_snapshots (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  occupied_count integer not null default 0,
  capacity integer not null default 0,
  snapshot_date date not null default current_date,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists occupancy_snapshots_location_date_idx on public.occupancy_snapshots(location_id, snapshot_date desc);

create table if not exists public.ai_summary_cache (
  cache_key text primary key,
  scope_type text not null,
  scope_id text,
  input_hash text not null,
  provider text not null default 'deterministic',
  model text not null default 'fallback',
  summary text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_summary_cache_scope_idx on public.ai_summary_cache(scope_type, scope_id);
create index if not exists ai_summary_cache_expires_idx on public.ai_summary_cache(expires_at);

alter table public.operational_events enable row level security;
alter table public.operational_event_runs enable row level security;
alter table public.intelligence_rules enable row level security;
alter table public.occupancy_snapshots enable row level security;
alter table public.ai_summary_cache enable row level security;

drop policy if exists "Service role full access operational events" on public.operational_events;
create policy "Service role full access operational events"
  on public.operational_events for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Authenticated read operational events by location" on public.operational_events;
create policy "Authenticated read operational events by location"
  on public.operational_events for select
  to authenticated
  using (public.can_access_location(location_id));

drop policy if exists "Managers update operational event status" on public.operational_events;
create policy "Managers update operational event status"
  on public.operational_events for update
  to authenticated
  using (public.can_access_location(location_id))
  with check (public.can_access_location(location_id));

drop policy if exists "Service role full access operational event runs" on public.operational_event_runs;
create policy "Service role full access operational event runs"
  on public.operational_event_runs for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Admins read operational event runs" on public.operational_event_runs;
create policy "Admins read operational event runs"
  on public.operational_event_runs for select
  to authenticated
  using (public.auth_user_role() in ('super_admin', 'regional_manager'));

drop policy if exists "Service role full access intelligence rules" on public.intelligence_rules;
create policy "Service role full access intelligence rules"
  on public.intelligence_rules for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Admins read intelligence rules" on public.intelligence_rules;
create policy "Admins read intelligence rules"
  on public.intelligence_rules for select
  to authenticated
  using (public.auth_user_role() in ('super_admin', 'regional_manager', 'location_admin'));

drop policy if exists "Service role full access occupancy snapshots" on public.occupancy_snapshots;
create policy "Service role full access occupancy snapshots"
  on public.occupancy_snapshots for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Authenticated read occupancy snapshots by location" on public.occupancy_snapshots;
create policy "Authenticated read occupancy snapshots by location"
  on public.occupancy_snapshots for select
  to authenticated
  using (public.can_access_location(location_id));

drop policy if exists "Managers manage occupancy snapshots by location" on public.occupancy_snapshots;
create policy "Managers manage occupancy snapshots by location"
  on public.occupancy_snapshots for all
  to authenticated
  using (public.can_access_location(location_id) and public.auth_user_role() in ('super_admin', 'regional_manager', 'location_admin'))
  with check (public.can_access_location(location_id) and public.auth_user_role() in ('super_admin', 'regional_manager', 'location_admin'));

drop policy if exists "Service role full access ai summary cache" on public.ai_summary_cache;
create policy "Service role full access ai summary cache"
  on public.ai_summary_cache for all
  to service_role
  using (true)
  with check (true);
