begin;

-- A confirmed edit and its journal entry share one transaction and the operator's RLS scope.
create function public.apply_desk_assistant_edit(
  p_lead_id uuid,
  p_expected_updated_at timestamptz,
  p_action text,
  p_changes jsonb
)
returns boolean language plpgsql security invoker set search_path = public as $$
declare
  actor uuid := auth.uid();
  dossier public.leads%rowtype;
  edited public.leads%rowtype;
  facts jsonb;
  currency_code text;
  min_amount numeric;
  max_amount numeric;
  allowed text[];
  detail text;
  summary text;
begin
  if actor is null or not exists (
    select 1 from public.profiles where id = actor and role in ('admin', 'lead_referent')
  ) or not exists (select 1 from public.desk_assistant_settings where id and enabled) then
    return false;
  end if;

  allowed := case p_action
    when 'note' then array['internal_notes']
    when 'priority' then array['priority']
    when 'budget' then array['budget','budget_min','budget_max','budget_unit','currency','intake_payload','ai_qualification_payload']
    when 'qualification' then array['budget','budget_min','budget_max','budget_unit','currency','intake_payload','ai_qualification_payload',
      'travel_period','trip_dates','travel_start_date','travel_end_date','travelers','travelers_adults','travelers_children']
  end;
  if allowed is null or p_expected_updated_at is null or jsonb_typeof(p_changes) is distinct from 'object' or p_changes = '{}'::jsonb then
    return false;
  end if;
  if exists (select 1 from jsonb_object_keys(p_changes) as field(name) where not (field.name = any(allowed))) then
    return false;
  end if;
  if (p_changes ? 'intake_payload' and jsonb_typeof(p_changes->'intake_payload') <> 'object')
     or (p_changes ? 'ai_qualification_payload' and jsonb_typeof(p_changes->'ai_qualification_payload') <> 'object') then
    return false;
  end if;

  select * into dossier from public.leads where id = p_lead_id for update;
  if not found or dossier.updated_at is distinct from p_expected_updated_at
     or dossier.deleted_at is not null or dossier.closed_at is not null or dossier.status in ('won', 'lost')
     or dossier.referent_id is null or (dossier.referent_id <> actor and not public.is_app_admin()) then
    return false;
  end if;

  edited := jsonb_populate_record(dossier, p_changes);
  if p_action = 'note' then
    if jsonb_typeof(p_changes->'internal_notes') <> 'string' or length(btrim(edited.internal_notes)) not between 1 and 2000 then
      return false;
    end if;
    edited.internal_notes := concat_ws(E'\n\n', nullif(rtrim(dossier.internal_notes, E' \t\r\n'), ''), btrim(edited.internal_notes));
    detail := 'DA Sales · Note interne ajoutée';
    summary := 'Proposition validée par un opérateur.';
  elsif p_action = 'priority' then
    if edited.priority is null or edited.priority not in ('normal', 'high') then return false; end if;
    detail := 'DA Sales · Priorité modifiée';
    summary := case when edited.priority = 'high' then 'Priorité haute' else 'Priorité normale' end;
  elsif p_action = 'budget' then
    if not (p_changes ?& array['budget','budget_min','budget_max','budget_unit','currency','intake_payload'])
       or edited.budget is null or length(btrim(edited.budget)) not between 1 and 120
       or edited.budget_unit is null or edited.budget_unit not in ('per_person', 'total') or edited.currency is distinct from 'EUR' then
      return false;
    end if;
    facts := edited.intake_payload->'qualification_facts';
    currency_code := facts->>'currency';
    if jsonb_typeof(facts) is distinct from 'object'
       or currency_code is null or currency_code !~ '^[A-Z]{3}$'
       or facts->>'budget_unit' is distinct from edited.budget_unit
       or facts->>'budget_confirmed_by' is distinct from actor::text
       or not (facts ?& array['budget_min','budget_max','budget_includes_flights'])
       or jsonb_typeof(facts->'budget_min') not in ('null', 'number')
       or jsonb_typeof(facts->'budget_max') not in ('null', 'number')
       or jsonb_typeof(facts->'budget_includes_flights') not in ('null', 'boolean') then
      return false;
    end if;
    min_amount := (facts->>'budget_min')::numeric;
    max_amount := (facts->>'budget_max')::numeric;
    if (min_amount is null and max_amount is null) or min_amount > max_amount
       or min_amount not between 0.01 and 99999999.99 or max_amount not between 0.01 and 99999999.99
       or round(min_amount, 2) <> min_amount or round(max_amount, 2) <> max_amount
       or edited.budget_min is distinct from (case when currency_code = 'EUR' then min_amount end)
       or edited.budget_max is distinct from (case when currency_code = 'EUR' then max_amount end) then
      return false;
    end if;
    detail := 'DA Sales · Budget enregistré';
    summary := edited.budget;
  else
    detail := 'DA Sales · Qualification enregistrée';
    summary := 'Informations de qualification validées par un opérateur.';
  end if;

  if p_changes ?| array['budget_min','budget_max'] then
    if edited.budget_min <= 0 or edited.budget_max <= 0 or edited.budget_min > edited.budget_max then return false; end if;
  end if;

  if p_action = 'note' then
    update public.leads set internal_notes = edited.internal_notes where id = dossier.id;
  elsif p_action = 'priority' then
    update public.leads set priority = edited.priority where id = dossier.id;
  else
    update public.leads set
      budget = edited.budget, budget_min = edited.budget_min, budget_max = edited.budget_max,
      budget_unit = edited.budget_unit, currency = edited.currency,
      intake_payload = edited.intake_payload, ai_qualification_payload = edited.ai_qualification_payload,
      travel_period = edited.travel_period, trip_dates = edited.trip_dates,
      travel_start_date = edited.travel_start_date, travel_end_date = edited.travel_end_date,
      travelers = edited.travelers, travelers_adults = edited.travelers_adults, travelers_children = edited.travelers_children
    where id = dossier.id;
  end if;
  if not found then return false; end if;

  insert into public.activities(lead_id, actor_id, kind, detail, payload)
  values (dossier.id, actor, 'assistant_edit_applied', detail,
    jsonb_build_object('k', 'sys', 's', detail, 'b', summary, 'action', p_action));
  return true;
end;
$$;

revoke all on function public.apply_desk_assistant_edit(uuid,timestamptz,text,jsonb) from public, anon;
grant execute on function public.apply_desk_assistant_edit(uuid,timestamptz,text,jsonb) to authenticated;

commit;
