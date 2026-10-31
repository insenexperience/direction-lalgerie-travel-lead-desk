-- Reject concurrent edits between operator review and dispatch/finalization.
begin;
drop function public.finalize_lead_email_message(uuid,text,text);
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
revoke all on function public.finalize_lead_email_message(uuid,text,text,timestamptz) from public;
grant execute on function public.finalize_lead_email_message(uuid,text,text,timestamptz) to authenticated;

commit;
