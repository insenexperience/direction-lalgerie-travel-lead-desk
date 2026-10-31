-- Synthetic fixtures, statuses and notification rows roll back together.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';
set local plpgsql.check_asserts = on;

do $$ begin
  assert not exists(select 1 from auth.users where id::text like '8da31a00-%'), 'Fixture user collision';
  assert not exists(select 1 from public.leads where id::text like '8da31a00-%'), 'Fixture lead collision';
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
  ('8da31a00-0000-4000-8000-000000000001','manual-stage-admin@example.invalid','{}'),
  ('8da31a00-0000-4000-8000-000000000002','manual-stage-ref@example.invalid','{}'),
  ('8da31a00-0000-4000-8000-000000000003','manual-stage-other@example.invalid','{}');
update public.profiles set role = 'admin' where id = '8da31a00-0000-4000-8000-000000000001';
insert into public.leads(id,traveler_name,email,status,referent_id) values
  ('8da31a00-0000-4000-8000-000000000011','TEST manuel transaction','manual-stage-test@example.invalid','new','8da31a00-0000-4000-8000-000000000002'),
  ('8da31a00-0000-4000-8000-000000000012','TEST autre référent','manual-stage-other-lead@example.invalid','new','8da31a00-0000-4000-8000-000000000003'),
  ('8da31a00-0000-4000-8000-000000000013','TEST dossier libre','manual-stage-free@example.invalid','new','8da31a00-0000-4000-8000-000000000002');
update public.leads set referent_id = null where id = '8da31a00-0000-4000-8000-000000000013';

set local role authenticated;
select set_config('request.jwt.claim.sub','8da31a00-0000-4000-8000-000000000002',true);
do $$
declare
  fixture uuid := '8da31a00-0000-4000-8000-000000000011';
  stamp timestamptz;
  c integer;
  value text;
begin
  assert not has_function_privilege('anon','public.advance_lead_manual_stage(uuid,text,text,text,timestamptz,boolean)','execute'), 'Anonymous RPC access';
  select updated_at into stamp from public.leads where id = fixture;
  perform public.advance_lead_manual_stage(fixture,'recu','whatsapp','Qualification faite sur WhatsApp.',stamp,true);
  assert (select status = 'qualification' from public.leads where id = fixture), 'Raw qualification status';
  assert (select count(*) = 1 from public.activities where lead_id = fixture and kind = 'first_response'), 'First response recorded once';
  select updated_at into stamp from public.leads where id = fixture;
  perform public.advance_lead_manual_stage(fixture,'envoye','whatsapp','Brief envoyé hors du desk.',stamp,true);
  assert (select status = 'agency_assignment' from public.leads where id = fixture), 'Raw agency status';
  assert (select count(*) = 1 from public.activities where lead_id = fixture and kind = 'first_response'), 'First response unchanged';
  assert not exists(select 1 from public.lead_email_messages where lead_id = fixture), 'No fake email';
  assert not exists(select 1 from public.lead_circuit_proposals where lead_id = fixture), 'No fake consultation';
  assert not exists(select 1 from public.quotes where lead_id = fixture), 'No fake quote';
  assert exists(select 1 from public.activities where lead_id = fixture and kind = 'manual_stage_advanced'
    and actor_id = auth.uid() and payload ->> 'stage' = 'envoye' and payload ->> 'channel' = 'whatsapp'), 'Attributed audit trail';

  select count(*) into c from public.activities where lead_id = fixture;
  foreach value in array array['recu','brief_pret','envoye','clos','__proto__'] loop
    begin
      perform public.advance_lead_manual_stage(fixture,value,'whatsapp','Invalid progress.',stamp,false);
      raise exception 'TEST: invalid stage accepted';
    exception when raise_exception then
      if sqlerrm = 'TEST: invalid stage accepted' then raise; end if;
    end;
  end loop;
  begin
    perform public.advance_lead_manual_stage(fixture,'proposition','whatsapp','Stale file.',stamp - interval '1 second',false);
    raise exception 'TEST: stale version accepted';
  exception when raise_exception then
    if sqlerrm = 'TEST: stale version accepted' then raise; end if;
  end;
  begin
    perform public.advance_lead_manual_stage(fixture,'proposition','whatsapp',' ',stamp,false);
    raise exception 'TEST: blank note accepted';
  exception when raise_exception then
    if sqlerrm = 'TEST: blank note accepted' then raise; end if;
  end;
  assert (select count(*) = c from public.activities where lead_id = fixture), 'Refused declarations leave no audit row';
  assert (select status = 'agency_assignment' from public.leads where id = fixture), 'Refused declarations leave status unchanged';

  -- Same raw status in a new processing cycle must not revive old declarations.
  insert into public.activities(lead_id,actor_id,kind,detail,created_at)
    values(fixture,auth.uid(),'lead_reset','TEST new cycle',clock_timestamp());
  perform public.advance_lead_manual_stage(fixture,'envoye','whatsapp','Nouvel envoi après remise à zéro.',stamp,true);
  assert (select count(*) = 2 from public.activities where lead_id = fixture and kind = 'first_response'), 'New cycle can declare its own first response';

  begin
    perform public.advance_lead_manual_stage('8da31a00-0000-4000-8000-000000000012','envoye','whatsapp','Other referent.',stamp,false);
    raise exception 'TEST: other referent accepted';
  exception when raise_exception then
    if sqlerrm = 'TEST: other referent accepted' then raise; end if;
  end;
  select updated_at into stamp from public.leads where id = '8da31a00-0000-4000-8000-000000000013';
  perform public.advance_lead_manual_stage('8da31a00-0000-4000-8000-000000000013','proposee','telephone','Proposition expliquée par téléphone.',stamp,false);
  assert (select referent_id = auth.uid() and status = 'quote' from public.leads where id = '8da31a00-0000-4000-8000-000000000013'), 'Free file claimed atomically';
end $$;

select set_config('request.jwt.claim.sub','8da31a00-0000-4000-8000-000000000001',true);
do $$ declare stamp timestamptz; begin
  select updated_at into stamp from public.leads where id = '8da31a00-0000-4000-8000-000000000012';
  perform public.advance_lead_manual_stage('8da31a00-0000-4000-8000-000000000012','proposition','email','Traitement par administrateur.',stamp,false);
  assert (select status = 'co_construction' and referent_id = '8da31a00-0000-4000-8000-000000000003' from public.leads where id = '8da31a00-0000-4000-8000-000000000012'), 'Admin keeps existing referent';
end $$;

rollback;
