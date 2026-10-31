-- A declared external step updates the pipeline and its audit trail atomically.
-- No email, consultation or quote is fabricated by this function.
begin;

create function public.advance_lead_manual_stage(
  p_lead_id uuid,
  p_stage text,
  p_channel text,
  p_note text,
  p_expected_updated_at timestamptz,
  p_first_response boolean default false
)
returns void language plpgsql security invoker set search_path = public as $$
declare
  dossier public.leads%rowtype;
  stages text[] := array['a_completer','recu','brief_pret','envoye','proposition','proposee','clos'];
  target_index integer := array_position(stages, p_stage);
  current_index integer;
  declared_index integer;
  next_status public.lead_status;
  stage_label text;
  channel_label text;
  stamp timestamptz := clock_timestamp();
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin','lead_referent')
  ) then raise exception 'Session expirée ou accès non autorisé.'; end if;
  if target_index is null or target_index not between 2 and 6
    or p_channel is null or p_channel not in ('whatsapp','email','telephone','autre')
    or p_note is null or length(btrim(p_note)) = 0 or length(p_note) > 2000
    or p_expected_updated_at is null or p_first_response is null then
    raise exception 'Étape, canal ou note invalide.';
  end if;

  select * into dossier from public.leads where id = p_lead_id for update;
  if not found or dossier.deleted_at is not null then raise exception 'Dossier introuvable ou archivé.'; end if;
  if dossier.referent_id is not null and dossier.referent_id <> auth.uid() and not public.is_app_admin() then
    raise exception 'Seul le référent assigné ou un administrateur peut avancer ce dossier.';
  end if;
  if dossier.updated_at is distinct from p_expected_updated_at then
    raise exception 'Le dossier a été modifié entre-temps. Rechargez la fiche avant de réessayer.';
  end if;

  current_index := case dossier.status
    when 'won' then 7 when 'lost' then 7
    when 'quote' then 6 when 'negotiation' then 6
    when 'co_construction' then 5
    when 'agency_assignment' then case when exists (
      select 1 from public.lead_circuit_proposals where lead_id = p_lead_id and brief_sent_at is not null
    ) then 4 else 3 end
    else 1 end;
  select max(array_position(stages, payload ->> 'stage')) into declared_index
    from public.activities where lead_id = p_lead_id and kind = 'manual_stage_advanced'
      and payload ->> 'db_status' = dossier.status::text
      and payload ->> 'stage' in ('recu','brief_pret','envoye','proposition','proposee');
  if target_index <= greatest(current_index, coalesce(declared_index, 1)) then
    raise exception 'Choisissez une étape suivante. Un dossier clos ne peut plus avancer.';
  end if;

  next_status := case p_stage
    when 'recu' then 'qualification' when 'brief_pret' then 'agency_assignment'
    when 'envoye' then 'agency_assignment' when 'proposition' then 'co_construction'
    when 'proposee' then 'quote' end;
  stage_label := case p_stage
    when 'recu' then 'Reçu' when 'brief_pret' then 'Brief prêt'
    when 'envoye' then 'Envoyé aux agences' when 'proposition' then 'Proposition reçue'
    when 'proposee' then 'Proposée au voyageur' end;
  channel_label := case p_channel when 'whatsapp' then 'WhatsApp' when 'email' then 'E-mail'
    when 'telephone' then 'Téléphone' else 'Autre' end;

  update public.leads set status = next_status,
    referent_id = coalesce(referent_id, auth.uid()),
    referent_assigned_at = case when referent_id is null then stamp else referent_assigned_at end
    where id = p_lead_id;
  insert into public.activities(lead_id, actor_id, kind, detail, payload, created_at) values (
    p_lead_id, auth.uid(), 'manual_stage_advanced', 'Avancement manuel · ' || stage_label || ' · ' || channel_label,
    jsonb_build_object('k','sys','s','Avancement manuel · ' || stage_label || ' · ' || channel_label,
      'b',btrim(p_note),'stage',p_stage,'db_status',next_status::text,'previous_db_status',dossier.status::text,
      'channel',p_channel,'first_response',p_first_response), stamp
  );
  if p_first_response and dossier.welcome_email_sent_at is null and not exists (
    select 1 from public.activities where lead_id = p_lead_id and (
      kind in ('first_response','traveler_link_sent')
      or (kind in ('email_sent','email_sent_externally') and payload ->> 'email_kind' in ('welcome','qualification'))
    )
  ) then
    insert into public.activities(lead_id, actor_id, kind, detail, payload, created_at) values (
      p_lead_id, auth.uid(), 'first_response', 'Première réponse déclarée · ' || channel_label,
      jsonb_build_object('k','sys','s','Première réponse déclarée · ' || channel_label,'b',btrim(p_note),'channel',p_channel,'manual',true), stamp
    );
  end if;
end;
$$;

revoke all on function public.advance_lead_manual_stage(uuid,text,text,text,timestamptz,boolean) from public, anon;
grant execute on function public.advance_lead_manual_stage(uuid,text,text,text,timestamptz,boolean) to authenticated;

commit;
