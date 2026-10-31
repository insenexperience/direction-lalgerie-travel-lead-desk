-- First contact is a separate fact from qualification or pipeline progression.
begin;
create function public.record_lead_external_exchange(
  p_lead_id uuid, p_channel text, p_note text, p_occurred_at timestamptz,
  p_first_response boolean, p_expected_updated_at timestamptz
)
returns void language plpgsql security invoker set search_path = public as $$
declare
  dossier public.leads%rowtype;
  cycle_start timestamptz;
  first_contact boolean;
  stamp timestamptz := clock_timestamp();
  channel_label text;
  title text;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id = auth.uid() and role in ('admin','lead_referent')) then
    raise exception 'Session expirée ou accès non autorisé.';
  end if;
  if p_channel is null or p_channel not in ('whatsapp','email','telephone','autre')
    or p_note is null or length(btrim(p_note)) = 0 or length(p_note) > 2000
    or p_first_response is null or p_occurred_at is null or not isfinite(p_occurred_at)
    or p_occurred_at > stamp + interval '1 minute' or p_expected_updated_at is null then
    raise exception 'Vérifiez le canal, la date réelle et le résumé de l’échange.';
  end if;
  select * into dossier from public.leads where id = p_lead_id for update;
  if not found or dossier.deleted_at is not null or dossier.status in ('won','lost') then raise exception 'Dossier introuvable, archivé ou clos.'; end if;
  if dossier.referent_id is not null and dossier.referent_id <> auth.uid() and not public.is_app_admin() then
    raise exception 'Seul le référent assigné ou un administrateur peut enregistrer cet échange.';
  end if;
  if dossier.updated_at is distinct from p_expected_updated_at then raise exception 'La fiche a changé. Rechargez-la avant d’enregistrer l’échange.'; end if;
  select coalesce(max(created_at), '-infinity'::timestamptz) into cycle_start from public.activities where lead_id = p_lead_id and kind = 'lead_reset';
  first_contact := p_first_response and dossier.welcome_email_sent_at is null and not exists(
    select 1 from public.activities where lead_id = p_lead_id and created_at > cycle_start and (
      kind in ('first_response','traveler_link_sent')
      or (kind in ('email_sent','email_sent_externally') and payload ->> 'email_kind' in ('welcome','qualification'))
    )
  );
  -- Touch/claim the file to make repeated submissions and concurrent tabs conflict.
  -- status is intentionally absent: no qualification claim or status notification.
  update public.leads set referent_id = coalesce(referent_id, auth.uid()),
    referent_assigned_at = case when referent_id is null then stamp else referent_assigned_at end
    where id = p_lead_id;
  channel_label := case p_channel when 'whatsapp' then 'WhatsApp' when 'email' then 'E-mail' when 'telephone' then 'Téléphone' else 'Autre' end;
  title := case when first_contact then 'Premier échange enregistré · ' else 'Échange enregistré · ' end || channel_label;
  insert into public.activities(lead_id,actor_id,kind,detail,payload,created_at) values (
    p_lead_id,auth.uid(),case when first_contact then 'first_response' else 'external_exchange' end,title,
    jsonb_build_object('k','sys','s',title,'b',btrim(p_note),'channel',p_channel,'occurred_at',p_occurred_at,'first_response',first_contact,'external',true),stamp
  );
end;
$$;
revoke all on function public.record_lead_external_exchange(uuid,text,text,timestamptz,boolean,timestamptz) from public,anon;
grant execute on function public.record_lead_external_exchange(uuid,text,text,timestamptz,boolean,timestamptz) to authenticated;

-- Stop new preparation/dispatch/external declarations on a closed file, even
-- for direct RPC calls from a stale tab. A provider-confirmed sent/failed result
-- may still be finalized so an in-flight delivery keeps its truthful audit.
create function public.guard_open_lead_workflow_email()
returns trigger language plpgsql security invoker set search_path = public as $$
declare open_lead uuid;
begin
  if new.status in ('draft','sending','external') then
    select id into open_lead from public.leads where id=new.lead_id
      and deleted_at is null and status not in ('won','lost') for share;
    if not found then raise exception 'Ce dossier est clos ou archivé. Aucun nouvel envoi de traitement n’est autorisé.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_open_lead_workflow_email() from public,anon,authenticated,service_role;
create trigger guard_open_lead_workflow_email
  before insert or update on public.lead_email_messages
  for each row execute function public.guard_open_lead_workflow_email();
commit;
