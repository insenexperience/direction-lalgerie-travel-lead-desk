-- No real lead, provider call or lasting fixture; all changes roll back.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';
set local plpgsql.check_asserts = on;
do $$ begin
  assert not exists(select 1 from auth.users where id::text like '8da31b00-%'), 'Fixture collision';
  assert not exists(select 1 from public.leads where id::text like '8da31b00-%'), 'Fixture collision';
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('8da31b00-0000-4000-8000-000000000001','contact-admin@example.invalid','{}'),
 ('8da31b00-0000-4000-8000-000000000002','contact-ref@example.invalid','{}'),
 ('8da31b00-0000-4000-8000-000000000003','contact-other@example.invalid','{}');
update public.profiles set role='admin' where id='8da31b00-0000-4000-8000-000000000001';
insert into public.leads(id,traveler_name,email,status,referent_id) values
 ('8da31b00-0000-4000-8000-000000000011','TEST premier contact','contact-test@example.invalid','new','8da31b00-0000-4000-8000-000000000002'),
 ('8da31b00-0000-4000-8000-000000000012','TEST autre dossier','contact-other-lead@example.invalid','new','8da31b00-0000-4000-8000-000000000003'),
 ('8da31b00-0000-4000-8000-000000000013','TEST clôture','contact-closed@example.invalid','new','8da31b00-0000-4000-8000-000000000002');
insert into public.lead_email_messages(id,lead_id,kind,recipient,subject,body_text,html,template_version,created_by) values(
 '8da31b00-0000-4000-8000-000000000021','8da31b00-0000-4000-8000-000000000013','welcome','contact-closed@example.invalid','TEST','Message test.','<p>Test</p>','test','8da31b00-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','8da31b00-0000-4000-8000-000000000002',true);
do $$
declare
  fixture uuid := '8da31b00-0000-4000-8000-000000000011';
  actual_date timestamptz := '2026-10-28T09:30:00Z';
  stamp timestamptz;
  n integer;
begin
  assert not has_function_privilege('anon','public.record_lead_external_exchange(uuid,text,text,timestamptz,boolean,timestamptz)','execute'), 'Anonymous access denied';
  select updated_at into stamp from public.leads where id=fixture;
  perform public.record_lead_external_exchange(fixture,'whatsapp','Premier échange, projet encore à compléter.',actual_date,true,stamp);
  assert (select status='new' and generated_brief is null from public.leads where id=fixture), 'Contact must not qualify the project';
  assert exists(select 1 from public.activities where lead_id=fixture and kind='first_response' and actor_id=auth.uid()
    and (payload->>'occurred_at')::timestamptz=actual_date and payload->>'channel'='whatsapp'), 'Real contact date and actor retained';
  assert not exists(select 1 from public.lead_email_messages where lead_id=fixture), 'No fake email';
  assert not exists(select 1 from public.lead_circuit_proposals where lead_id=fixture), 'No fake agency consultation';
  select updated_at into stamp from public.leads where id=fixture;
  perform public.record_lead_external_exchange(fixture,'telephone','Échange complémentaire.',actual_date+interval '1 hour',true,stamp);
  assert (select count(*)=1 from public.activities where lead_id=fixture and kind='first_response'), 'First response unique in the cycle';
  assert (select count(*)=1 from public.activities where lead_id=fixture and kind='external_exchange'), 'Later exchange recorded separately';
  select count(*) into n from public.activities where lead_id=fixture;
  begin
    perform public.record_lead_external_exchange(fixture,'whatsapp','Stale version.',actual_date,false,stamp-interval '1 second');
    raise exception 'TEST: stale accepted';
  exception when raise_exception then if sqlerrm='TEST: stale accepted' then raise; end if; end;
  begin
    perform public.record_lead_external_exchange(fixture,'whatsapp','Future contact.',clock_timestamp()+interval '1 day',false,stamp);
    raise exception 'TEST: future accepted';
  exception when raise_exception then if sqlerrm='TEST: future accepted' then raise; end if; end;
  begin
    perform public.record_lead_external_exchange('8da31b00-0000-4000-8000-000000000012','email','Another referent.',actual_date,false,stamp);
    raise exception 'TEST: other referent accepted';
  exception when raise_exception then if sqlerrm='TEST: other referent accepted' then raise; end if; end;
  assert (select count(*)=n from public.activities where lead_id=fixture), 'Refusals leave no activity';
  insert into public.activities(lead_id,actor_id,kind,detail,created_at) values(fixture,auth.uid(),'lead_reset','TEST reset',clock_timestamp());
  perform public.record_lead_external_exchange(fixture,'whatsapp','Nouveau cycle.',actual_date,true,stamp);
  assert (select count(*)=2 from public.activities where lead_id=fixture and kind='first_response'), 'New processing cycle has its own first contact';
  update public.leads set status='lost' where id='8da31b00-0000-4000-8000-000000000013';
  begin
    update public.lead_email_messages set status='sending' where id='8da31b00-0000-4000-8000-000000000021';
    raise exception 'TEST: closed dispatch accepted';
  exception when raise_exception then if sqlerrm='TEST: closed dispatch accepted' then raise; end if; end;
  select updated_at into stamp from public.lead_email_messages where id='8da31b00-0000-4000-8000-000000000021';
  begin
    perform public.finalize_lead_email_message('8da31b00-0000-4000-8000-000000000021','external',null,stamp);
    raise exception 'TEST: closed external declaration accepted';
  exception when raise_exception then if sqlerrm='TEST: closed external declaration accepted' then raise; end if; end;
  assert (select status='draft' from public.lead_email_messages where id='8da31b00-0000-4000-8000-000000000021'), 'Closed file keeps unsent draft';
end $$;
reset role;
do $$ begin
  assert not exists(select 1 from public.project_status_email_outbox where lead_id::text like '8da31b00-%'), 'Contact alone must not enqueue a status email';
end $$;
rollback;
