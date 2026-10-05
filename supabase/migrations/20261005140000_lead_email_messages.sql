-- Operator-reviewed branded mailing, drafts and immutable delivery history.
begin;
create table public.lead_email_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete set null,
  proposal_id uuid references public.lead_circuit_proposals(id) on delete set null,
  kind text not null check (kind in ('welcome', 'qualification', 'agency_brief')),
  recipient text not null,
  subject text not null check (length(subject) between 1 and 250),
  body_text text not null check (length(body_text) between 1 and 40000),
  html text not null,
  language text not null default 'fr' check (language in ('fr', 'en')),
  template_version text not null,
  missing_information jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed', 'external')),
  provider_id text,
  error text,
  created_by uuid references public.profiles(id) on delete set null,
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_email_messages_lead_idx on public.lead_email_messages(lead_id, created_at desc);
alter table public.lead_email_messages enable row level security;
create policy lead_email_messages_select on public.lead_email_messages for select to authenticated
  using (public.lead_is_visible_for_rls(lead_id));
create policy lead_email_messages_insert on public.lead_email_messages for insert to authenticated
  with check (created_by = auth.uid() and exists (
    select 1 from public.leads l where l.id = lead_id and l.deleted_at is null and l.referent_id is not null
      and (l.referent_id = auth.uid() or public.is_app_admin())
  ));
create policy lead_email_messages_update on public.lead_email_messages for update to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and l.deleted_at is null and l.referent_id is not null
    and (l.referent_id = auth.uid() or public.is_app_admin())))
  with check (exists (select 1 from public.leads l where l.id = lead_id and l.deleted_at is null and l.referent_id is not null
    and (l.referent_id = auth.uid() or public.is_app_admin())));
grant select, insert, update on public.lead_email_messages to authenticated;

create or replace function public.guard_lead_email_message_history()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.id <> old.id or new.lead_id <> old.lead_id or new.created_at <> old.created_at
    or (new.created_by is distinct from old.created_by and not (
      new.created_by is null and not exists (select 1 from public.profiles where id = old.created_by)
    )) then raise exception 'Email identity and origin are immutable'; end if;
  if old.status <> 'draft' and (
    new.recipient is distinct from old.recipient or new.subject is distinct from old.subject
    or new.body_text is distinct from old.body_text or new.html is distinct from old.html
    or new.language is distinct from old.language or new.template_version is distinct from old.template_version
    or new.missing_information is distinct from old.missing_information or new.kind is distinct from old.kind
    or (new.agency_id is distinct from old.agency_id and not (new.agency_id is null and not exists (select 1 from public.agencies where id = old.agency_id)))
    or (new.proposal_id is distinct from old.proposal_id and not (new.proposal_id is null and not exists (select 1 from public.lead_circuit_proposals where id = old.proposal_id)))
  ) then raise exception 'Dispatched email content is immutable; create a new draft'; end if;
  if old.status in ('sent', 'external', 'failed') and (
    new.status is distinct from old.status or new.provider_id is distinct from old.provider_id
    or new.sent_at is distinct from old.sent_at or new.sent_by is distinct from old.sent_by
    or new.error is distinct from old.error
  ) then raise exception 'Finalized email delivery history is immutable'; end if;
  if (old.status = 'draft' and new.status not in ('draft','sending','external'))
    or (old.status = 'sending' and new.status not in ('sending','sent','failed')) then
    raise exception 'Invalid email delivery transition';
  end if;
  return new;
end;
$$;
create trigger lead_email_message_history_guard before update on public.lead_email_messages
  for each row execute function public.guard_lead_email_message_history();

-- Save mail history, audit and pipeline indicators together after delivery.
create or replace function public.finalize_lead_email_message(message_id uuid, delivery text, provider_message_id text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare
  message public.lead_email_messages%rowtype;
  dossier public.leads%rowtype;
  stamp timestamptz := now();
begin
  if auth.uid() is null or delivery not in ('sent', 'external') then
    raise exception 'Invalid mail finalization';
  end if;
  select * into message from public.lead_email_messages where id = message_id for update;
  if not found then raise exception 'Email not found'; end if;
  select * into dossier from public.leads where id = message.lead_id;
  if dossier.deleted_at is not null or dossier.referent_id is null
    or not (dossier.referent_id = auth.uid() or public.is_app_admin()) then
    raise exception 'Only assigned referent or admin may finalize this mail';
  end if;
  if (delivery = 'sent' and message.status <> 'sending')
    or (delivery = 'external' and message.status <> 'draft') then
    raise exception 'This email has already been processed';
  end if;
  if message.kind = 'agency_brief' and not exists (
    select 1 from public.lead_circuit_proposals p where p.id = message.proposal_id
      and p.lead_id = message.lead_id and p.agency_id = message.agency_id
  ) then raise exception 'Agency consultation mismatch'; end if;
  update public.lead_email_messages set status = delivery, sent_at = stamp, sent_by = auth.uid(),
    provider_id = provider_message_id, error = null, updated_at = stamp where id = message.id;
  if message.kind = 'welcome' then
    update public.leads set welcome_email_sent_at = stamp,
      welcome_email_template_used = message.template_version || ':' || delivery,
      status = case when status = 'new' then 'qualification'::public.lead_status else status end
    where id = message.lead_id;
  elsif message.kind = 'agency_brief' then
    update public.lead_circuit_proposals set brief_sent_at = stamp, status = 'awaiting_response'
      where id = message.proposal_id and lead_id = message.lead_id and agency_id = message.agency_id;
  end if;
  insert into public.activities(lead_id, actor_id, kind, detail) values (
    message.lead_id, auth.uid(), case when delivery = 'external' then 'email_sent_externally' else 'email_sent' end,
    message.kind || ' · ' || message.subject || ' · message ' || message.id::text
  );
end;
$$;
revoke all on function public.finalize_lead_email_message(uuid,text,text) from public;
grant execute on function public.finalize_lead_email_message(uuid,text,text) to authenticated;
commit;
