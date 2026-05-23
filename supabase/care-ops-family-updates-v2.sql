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
