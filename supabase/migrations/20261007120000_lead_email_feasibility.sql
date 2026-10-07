-- A preliminary, unpriced agency study is a message, not a priced consultation.
begin;

alter table public.lead_email_messages drop constraint lead_email_messages_kind_check;
alter table public.lead_email_messages add constraint lead_email_messages_kind_check
  check (kind in ('welcome', 'qualification', 'agency_feasibility', 'agency_brief'));
alter table public.lead_email_messages add constraint lead_email_feasibility_no_proposal_check
  check (kind <> 'agency_feasibility' or proposal_id is null);

-- Require a real, non-suspended agency, including authenticated table writes.
-- Keep ON DELETE SET NULL working for previously stored mail history. A deleted
-- agency can never be used for a new dispatch or finalization.
create or replace function public.guard_lead_email_feasibility()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.kind <> 'agency_feasibility' then return new; end if;
  if new.proposal_id is not null then
    raise exception 'Feasibility study cannot be linked to a priced consultation';
  end if;
  if tg_op = 'UPDATE' then
    if old.kind = 'agency_feasibility' and old.agency_id is not null
      and new.agency_id is null and new.status is not distinct from old.status
      and not exists (select 1 from public.agencies where id = old.agency_id) then
      return new;
    end if;
  end if;
  if new.agency_id is null or not exists (
    select 1 from public.agencies where id = new.agency_id and status <> 'suspended'
  ) then raise exception 'Feasibility study requires an available agency'; end if;
  return new;
end;
$$;
create trigger lead_email_feasibility_guard before insert or update on public.lead_email_messages
  for each row execute function public.guard_lead_email_feasibility();

-- Preserve the reviewed mail's concurrency, audit and existing clocks. Study
-- delivery only records the email; it never changes the lead or a proposal.
create or replace function public.finalize_lead_email_message(message_id uuid, delivery text, provider_message_id text default null, expected_updated_at timestamptz default null)
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
  if expected_updated_at is not null and message.updated_at is distinct from expected_updated_at then
    raise exception 'Email changed since review; reload the draft';
  end if;
  select * into dossier from public.leads where id = message.lead_id;
  if dossier.deleted_at is not null or dossier.referent_id is null
    or not (dossier.referent_id = auth.uid() or public.is_app_admin()) then
    raise exception 'Only assigned referent or admin may finalize this mail';
  end if;
  if (delivery = 'sent' and message.status <> 'sending')
    or (delivery = 'external' and message.status <> 'draft') then
    raise exception 'This email has already been processed';
  end if;
  if message.kind = 'agency_feasibility' and (
    message.proposal_id is not null or message.agency_id is null or not exists (
      select 1 from public.agencies a where a.id = message.agency_id and a.status <> 'suspended'
    )
  ) then raise exception 'Feasibility study requires an available agency and no priced consultation'; end if;
  if message.kind = 'agency_brief' and not exists (
    select 1 from public.lead_circuit_proposals p where p.id = message.proposal_id
      and p.lead_id = message.lead_id and p.agency_id = message.agency_id
  ) then raise exception 'Agency consultation mismatch'; end if;
  update public.lead_email_messages set status = delivery, sent_at = stamp, sent_by = auth.uid(),
    provider_id = provider_message_id, error = null, updated_at = stamp where id = message.id;
  if message.kind = 'welcome' then
    update public.leads set welcome_email_sent_at = coalesce(welcome_email_sent_at, stamp),
      welcome_email_template_used = message.template_version || ':' || delivery,
      status = case when status = 'new' then 'qualification'::public.lead_status else status end
    where id = message.lead_id;
  elsif message.kind = 'qualification' then
    update public.leads set status = case when status = 'new' then 'qualification'::public.lead_status else status end where id = message.lead_id;
  elsif message.kind = 'agency_brief' then
    update public.lead_circuit_proposals set brief_sent_at = stamp, status = 'awaiting_response'
      where id = message.proposal_id and lead_id = message.lead_id and agency_id = message.agency_id
        and brief_sent_at is null and status = 'pending_send';
  end if;
  insert into public.activities(lead_id, actor_id, kind, detail, payload) values (
    message.lead_id, auth.uid(), case when delivery = 'external' then 'email_sent_externally' else 'email_sent' end,
    message.kind || ' · ' || message.subject || ' · message ' || message.id::text,
    jsonb_build_object('k', 'out', 's', message.subject, 'b', message.body_text, 'email_kind', message.kind, 'email_id', message.id, 'delivery', delivery)
  );
end;
$$;
revoke all on function public.finalize_lead_email_message(uuid,text,text,timestamptz) from public;
grant execute on function public.finalize_lead_email_message(uuid,text,text,timestamptz) to authenticated;

commit;
