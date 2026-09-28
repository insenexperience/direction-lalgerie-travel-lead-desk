-- Clôture d'un lead (won / lost) : la fiche contact est retrouvée par e-mail, puis par téléphone, avant d'en créer une.
--
-- Avant : seul l'e-mail servait au rapprochement (on conflict (email)). Un voyageur qui revient avec une autre adresse
-- mais le même téléphone (ou deux voyageurs d'un même foyer) heurtait contacts_phone_unique : l'exception annulait
-- toute la mise à jour du lead, et « Marquer gagné / perdu » échouait.
-- Maintenant : e-mail (sans tenir compte de la casse), puis téléphone, puis le contact déjà né de ce lead ; sinon
-- création. Une création qui se heurte à une fiche apparue entre-temps retombe sur le rapprochement au lieu d'échouer.
-- Le téléphone n'est recopié sur une fiche existante que s'il n'appartient à aucune autre.

create or replace function public.fn_lead_close_sync_contact()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_first_name  text;
  v_last_name   text;
  v_contact_id  uuid;
  v_email       text;
  v_phone       text;
  v_type        text;
begin
  -- Déclenché uniquement lors d'une transition vers won ou lost
  if new.status not in ('won', 'lost') then
    return new;
  end if;
  if old.status is not distinct from new.status then
    return new;
  end if;

  v_email := nullif(trim(coalesce(new.email, '')), '');
  v_phone := nullif(trim(coalesce(new.phone, '')), '');
  v_type  := case when new.status = 'won' then 'traveler' else 'seeker' end;

  -- Pas d'e-mail : on ferme juste le lead (comportement inchangé)
  if v_email is null then
    update public.leads set closed_at = now() where id = new.id and closed_at is null;
    return new;
  end if;

  -- Découper traveler_name en prénom / nom
  v_first_name := split_part(coalesce(new.traveler_name, ''), ' ', 1);
  v_last_name  := nullif(trim(substring(coalesce(new.traveler_name, '') from
    position(' ' in coalesce(new.traveler_name, '')) + 1)), '');

  for essai in 1..2 loop
    select id into v_contact_id from public.contacts
      where email is not null and email <> '' and lower(email) = lower(v_email)
      order by created_at limit 1;
    if v_contact_id is null and v_phone is not null then
      select id into v_contact_id from public.contacts
        where phone = v_phone or phone_e164 = v_phone
        order by created_at limit 1;
    end if;
    if v_contact_id is null then
      select id into v_contact_id from public.contacts where source_lead_id = new.id;
    end if;
    exit when v_contact_id is not null or essai = 2;

    insert into public.contacts (
      type, source_lead_id, full_name, first_name, last_name, email, phone, phone_e164, whatsapp_phone_number,
      first_seen_at, first_lead_at, last_activity_at, won_at, lost_at, lost_reason
    ) values (
      v_type,
      new.id,
      coalesce(nullif(trim(new.traveler_name), ''), 'Inconnu'),
      v_first_name,
      v_last_name,
      v_email,
      v_phone,
      v_phone,
      nullif(trim(coalesce(new.whatsapp_phone_number, '')), ''),
      new.created_at,
      new.created_at,
      now(),
      case when new.status = 'won'  then now() else null end,
      case when new.status = 'lost' then now() else null end,
      case when new.status = 'lost' then nullif(trim(coalesce(new.internal_notes, '')), '') else null end
    )
    on conflict do nothing
    returning id into v_contact_id;
    exit when v_contact_id is not null;
    -- Conflit : une fiche est apparue entre-temps (ou porte déjà ce téléphone) ; second tour de rapprochement.
  end loop;

  if v_contact_id is not null then
    update public.contacts set
      type             = v_type,
      first_name       = coalesce(first_name, v_first_name),
      last_name        = coalesce(last_name, v_last_name),
      phone            = case when nullif(phone, '') is null and v_phone is not null
                                   and not exists (select 1 from public.contacts o where o.phone = v_phone and o.id <> v_contact_id)
                              then v_phone else phone end,
      phone_e164       = case when phone_e164 is null and v_phone is not null
                                   and not exists (select 1 from public.contacts o where o.phone_e164 = v_phone and o.id <> v_contact_id)
                              then v_phone else phone_e164 end,
      won_at           = case when v_type = 'traveler' then now() else won_at end,
      lost_at          = case when v_type = 'seeker' then now() else lost_at end,
      last_activity_at = now(),
      updated_at       = now()
    where id = v_contact_id;
  end if;

  -- Rattacher le lead au contact si pas encore rattaché
  if v_contact_id is not null and new.contact_id is null then
    update public.leads set contact_id = v_contact_id, closed_at = now() where id = new.id;
  else
    update public.leads set closed_at = now() where id = new.id and closed_at is null;
  end if;

  return new;
end;
$function$;
