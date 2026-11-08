begin;

create table public.desk_gmail_sync (
  id boolean primary key default true check (id),
  history_id text not null check (history_id ~ '^[0-9]+$'),
  synced_at timestamptz not null default now(),
  last_error text check (last_error in ('history_expired', 'sync_failed'))
);
alter table public.desk_gmail_sync enable row level security;
revoke all on public.desk_gmail_sync from public, anon, authenticated;
grant select on public.desk_gmail_sync to authenticated;
grant select, insert, update, delete on public.desk_gmail_sync to service_role;
create policy desk_gmail_sync_admin on public.desk_gmail_sync
  for select to authenticated using (public.is_app_admin());

create table public.desk_gmail_messages (
  gmail_id text primary key check (gmail_id ~ '^[a-fA-F0-9]+$'),
  gmail_thread_id text not null check (gmail_thread_id ~ '^[a-fA-F0-9]+$'),
  lead_id uuid not null references public.leads(id) on delete cascade,
  sender text not null,
  subject text not null check (char_length(subject) <= 500),
  received_at timestamptz not null,
  kind text not null check (kind in ('agency_proposal', 'agency_reply', 'traveler_reply')),
  excerpt text not null check (char_length(excerpt) <= 4000),
  attachments text[] not null default '{}' check (cardinality(attachments) <= 12)
);
create index desk_gmail_messages_lead_received_idx on public.desk_gmail_messages (lead_id, received_at desc);
alter table public.desk_gmail_messages enable row level security;
revoke all on public.desk_gmail_messages from public, anon, authenticated;
grant select on public.desk_gmail_messages to authenticated;
grant select, insert, delete on public.desk_gmail_messages to service_role;
create policy desk_gmail_messages_referent_or_admin on public.desk_gmail_messages
  for select to authenticated using (exists (
    select 1 from public.leads l
    where l.id = lead_id and l.deleted_at is null
      and (l.referent_id = auth.uid() or public.is_app_admin())
  ));

-- A project reference is only a routing hint. Also require an address already
-- known to that project, and reject multiple projects or correspondent roles.
create function public.match_desk_gmail_reply(p_reference text, p_sender text, p_received_at timestamptz)
returns table (lead_id uuid, correspondent text)
language sql stable set search_path = public as $$
  with candidates as (
    select l.id, l.email
    from public.leads l
    where l.deleted_at is null and l.closed_at is null
      and l.status not in ('won', 'lost')
      and l.created_at <= p_received_at
      and upper(coalesce(nullif(trim(l.reference), ''), 'DA-' || left(l.id::text, 8))) = p_reference
  ), roles as (
    select c.id, 'traveler'::text as role
    from candidates c where lower(trim(c.email)) = p_sender
    union
    select c.id, 'agency'::text
    from candidates c where exists (
      select 1 from public.lead_email_messages m
      where m.lead_id = c.id and m.kind in ('agency_feasibility', 'agency_brief')
        and m.status in ('sent', 'external') and m.sent_at <= p_received_at
        and lower(trim(m.recipient)) = p_sender
    ) or exists (
      select 1 from public.lead_circuit_proposals p
      join public.agencies a on a.id = p.agency_id
      where p.lead_id = c.id and p.brief_sent_at <= p_received_at
        and lower(trim(a.email)) = p_sender
    )
  )
  select r.id, r.role from roles r
  where (select count(*) from candidates) = 1 and (select count(*) from roles) = 1;
$$;
revoke all on function public.match_desk_gmail_reply(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.match_desk_gmail_reply(text, text, timestamptz) to service_role;

commit;
