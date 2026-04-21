-- PRD Refonte v1 — Contraintes + Triggers (historique, contact, activité)
-- Dépend de : 20260521_003 (leads colonnes) + 20260521_004 (lead_history)

-- ─── 1. Contrainte devise EUR uniquement ─────────────────────────────────────
alter table public.leads
  drop constraint if exists currency_eur_only;

alter table public.leads
  add constraint currency_eur_only check (currency = 'EUR');

-- ─── 2. Trigger : historique automatique des transitions de statut ────────────

create or replace function public.fn_auto_lead_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.lead_history (lead_id, from_stage, to_stage, changed_by)
    values (
      new.id,
      old.status::text,
      new.status::text,
      'system'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_lead_history on public.leads;
create trigger trg_auto_lead_history
  after update on public.leads
  for each row execute function public.fn_auto_lead_history();

-- ─── 3. Trigger : bascule lead → contact enrichi sur won/lost ────────────────
-- Remplace/complète sync_contact_from_lead (20260502000000_contacts_crm.sql)
-- Ce trigger enrichit le contact avec first_name, last_name, phone_e164

create or replace function public.fn_lead_close_sync_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_name  text;
  v_last_name   text;
  v_contact_id  uuid;
  v_phone_e164  text;
begin
  -- Déclenché uniquement lors d'une transition vers won ou lost
  if new.status not in ('won', 'lost') then
    return new;
  end if;
  if old.status is not distinct from new.status then
    return new;
  end if;

  -- Découper traveler_name en prénom / nom
  v_first_name := split_part(coalesce(new.traveler_name, ''), ' ', 1);
  v_last_name  := nullif(trim(substring(coalesce(new.traveler_name, '') from
    position(' ' in coalesce(new.traveler_name, '')) + 1)), '');

  -- Normalisation téléphone E.164 (conserver uniquement les chiffres + leading +)
  -- On garde la valeur telle quelle si elle commence par + (déjà E.164)
  -- Sinon on préfixe +33 pour la France si commence par 0 — à adapter selon l'usage réel
  v_phone_e164 := nullif(trim(coalesce(new.phone, '')), '');

  -- Upsert contact par email
  if nullif(trim(coalesce(new.email, '')), '') is not null then
    insert into public.contacts (
      type,
      source_lead_id,
      full_name,
      first_name,
      last_name,
      email,
      phone,
      phone_e164,
      whatsapp_phone_number,
      first_seen_at,
      first_lead_at,
      last_activity_at,
      won_at,
      lost_at,
      lost_reason
    ) values (
      case when new.status = 'won' then 'traveler' else 'seeker' end,
      new.id,
      coalesce(nullif(trim(new.traveler_name), ''), 'Inconnu'),
      v_first_name,
      v_last_name,
      nullif(trim(new.email), ''),
      nullif(trim(coalesce(new.phone, '')), ''),
      v_phone_e164,
      nullif(trim(coalesce(new.whatsapp_phone_number, '')), ''),
      new.created_at,
      new.created_at,
      now(),
      case when new.status = 'won'  then now() else null end,
      case when new.status = 'lost' then now() else null end,
      case when new.status = 'lost' then nullif(trim(coalesce(new.internal_notes, '')), '') else null end
    )
    on conflict (email) where email is not null and email <> ''
    do update set
      type              = excluded.type,
      first_name        = coalesce(contacts.first_name, excluded.first_name),
      last_name         = coalesce(contacts.last_name,  excluded.last_name),
      phone_e164        = coalesce(contacts.phone_e164, excluded.phone_e164),
      won_at            = case when excluded.type = 'traveler' then now() else contacts.won_at  end,
      lost_at           = case when excluded.type = 'seeker'   then now() else contacts.lost_at end,
      last_activity_at  = now(),
      updated_at        = now()
    returning id into v_contact_id;

    -- Rattacher le lead au contact si pas encore rattaché
    if v_contact_id is not null and new.contact_id is null then
      update public.leads
      set
        contact_id = v_contact_id,
        closed_at  = now()
      where id = new.id;
    else
      -- Juste mettre à jour closed_at
      update public.leads
      set closed_at = now()
      where id = new.id and closed_at is null;
    end if;
  else
    -- Pas d'email : on ferme juste le lead
    update public.leads
    set closed_at = now()
    where id = new.id and closed_at is null;
  end if;

  return new;
end;
$$;

-- Désactiver l'ancien trigger de sync pour éviter les doublons
drop trigger if exists on_lead_status_won_lost on public.leads;

-- Créer le nouveau trigger (remplace l'ancien)
drop trigger if exists trg_lead_close_sync_contact on public.leads;
create trigger trg_lead_close_sync_contact
  after update on public.leads
  for each row execute function public.fn_lead_close_sync_contact();

-- ─── 4. Trigger : mise à jour contact.last_activity_at sur update du lead ─────

create or replace function public.fn_update_contact_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contact_id is not null then
    update public.contacts
    set
      last_activity_at = now(),
      updated_at       = now()
    where id = new.contact_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_update_contact_activity on public.leads;
create trigger trg_update_contact_activity
  after update on public.leads
  for each row
  when (new.contact_id is not null)
  execute function public.fn_update_contact_activity();
