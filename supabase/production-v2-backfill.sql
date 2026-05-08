-- Comfort Care Production v2 backfill.
-- Run after production-v2.sql and after creating Supabase Auth users/profiles.

create or replace function public.ccsl_normalize_phone(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(value, ''), '\D', '', 'g')
$$;

insert into public.leads_v2 (
  location_id,
  full_name,
  phone,
  email,
  normalized_phone,
  normalized_email,
  care_type,
  source,
  status,
  relationship_to_resident,
  move_timeline,
  payment_type,
  current_situation,
  preferred_contact_method,
  best_contact_time,
  priority_tags,
  notes_summary,
  created_at,
  updated_at,
  created_by
)
select
  loc.id,
  coalesce(l.name, l.full_name, 'Unknown'),
  coalesce(l.phone, ''),
  nullif(lower(coalesce(l.email, '')), ''),
  public.ccsl_normalize_phone(l.phone),
  nullif(lower(coalesce(l.email, '')), ''),
  coalesce(l.care_type, 'Not sure yet'),
  coalesce(l.source, 'Website'),
  case lower(coalesce(l.status, 'new'))
    when 'new' then 'new'::public.lead_status_v2
    when 'contacted' then 'contacted'::public.lead_status_v2
    when 'tour scheduled' then 'tour_scheduled'::public.lead_status_v2
    when 'tour completed' then 'contacted'::public.lead_status_v2
    when 'decision pending' then 'contacted'::public.lead_status_v2
    when 'moved in' then 'move_in'::public.lead_status_v2
    when 'closed' then 'archived'::public.lead_status_v2
    else 'new'::public.lead_status_v2
  end,
  coalesce(l.relationship_to_resident, ''),
  coalesce(l.move_timeline, ''),
  coalesce(l.payment_type, ''),
  coalesce(l.current_situation, ''),
  coalesce(l.preferred_contact_method, ''),
  coalesce(l.best_contact_time, ''),
  string_to_array(coalesce(l.priority_tags, ''), ', '),
  coalesce(l.notes, l.message, ''),
  coalesce(l.created_at, now()),
  coalesce(l.updated_at, l.created_at, now()),
  null
from public.leads l
join public.locations loc
  on lower(loc.name) = lower(coalesce(l.location, l.preferred_community, ''))
where not exists (
  select 1
  from public.leads_v2 v2
  where v2.normalized_phone = public.ccsl_normalize_phone(l.phone)
    and v2.created_at = l.created_at
);

insert into public.tours (
  location_id,
  lead_id,
  scheduled_at,
  status,
  notes,
  created_at,
  updated_at,
  created_by
)
select
  l2.location_id,
  l2.id,
  old.tour_scheduled_at,
  'scheduled',
  'Backfilled from v1 lead tour_scheduled_at',
  coalesce(old.tour_scheduled_at, now()),
  coalesce(old.updated_at, old.tour_scheduled_at, now()),
  null
from public.leads old
join public.leads_v2 l2
  on l2.normalized_phone = public.ccsl_normalize_phone(old.phone)
  and l2.created_at = old.created_at
where old.tour_scheduled_at is not null
  and not exists (
    select 1 from public.tours t
    where t.lead_id = l2.id and t.scheduled_at = old.tour_scheduled_at
  );

insert into public.follow_ups (
  location_id,
  lead_id,
  due_at,
  status,
  note,
  created_at,
  updated_at,
  created_by
)
select
  l2.location_id,
  l2.id,
  old.follow_up_at,
  'open',
  coalesce(old.follow_up_note, ''),
  coalesce(old.follow_up_at, now()),
  coalesce(old.updated_at, old.follow_up_at, now()),
  null
from public.leads old
join public.leads_v2 l2
  on l2.normalized_phone = public.ccsl_normalize_phone(old.phone)
  and l2.created_at = old.created_at
where old.follow_up_at is not null
  and not exists (
    select 1 from public.follow_ups f
    where f.lead_id = l2.id and f.due_at = old.follow_up_at
  );

insert into public.activity_logs (
  location_id,
  actor_id,
  entity_type,
  entity_id,
  action,
  metadata,
  created_at,
  updated_at,
  created_by
)
select
  l2.location_id,
  null,
  'lead',
  l2.id,
  coalesce(e.event_type, 'activity'),
  jsonb_build_object('detail', coalesce(e.detail, ''), 'legacy_lead_id', e.lead_id),
  coalesce(e.created_at, now()),
  coalesce(e.created_at, now()),
  null
from public.lead_events e
join public.leads old on old.id = e.lead_id
join public.leads_v2 l2
  on l2.normalized_phone = public.ccsl_normalize_phone(old.phone)
  and l2.created_at = old.created_at
where e.lead_id <> 0
  and not exists (
    select 1 from public.activity_logs a
    where a.entity_type = 'lead'
      and a.entity_id = l2.id
      and a.action = coalesce(e.event_type, 'activity')
      and a.created_at = e.created_at
  );

insert into public.email_history (
  location_id,
  lead_id,
  recipient_email,
  subject,
  body,
  status,
  provider,
  sent_at,
  created_at,
  updated_at,
  created_by
)
select
  l2.location_id,
  l2.id,
  eo.recipient_email,
  eo.subject,
  eo.body,
  eo.status,
  'legacy',
  eo.created_at,
  eo.created_at,
  coalesce(eo.updated_at, eo.created_at),
  null
from public.email_outreach eo
left join public.leads old on old.id = eo.lead_id
left join public.leads_v2 l2
  on l2.normalized_phone = public.ccsl_normalize_phone(old.phone)
  and l2.created_at = old.created_at
where l2.id is not null
  and not exists (
    select 1 from public.email_history h
    where h.lead_id = l2.id
      and h.subject = eo.subject
      and h.created_at = eo.created_at
  );

-- Data quality checks to run after backfill:
select 'leads_without_location' as check_name, count(*) from public.leads_v2 where location_id is null;
select 'duplicate_phone_groups' as check_name, count(*) from (
  select normalized_phone from public.leads_v2 where normalized_phone <> '' group by normalized_phone having count(*) > 1
) d;
select 'activity_without_entity' as check_name, count(*) from public.activity_logs where entity_id is null;
select 'documents_without_location' as check_name, count(*) from public.documents where location_id is null;
