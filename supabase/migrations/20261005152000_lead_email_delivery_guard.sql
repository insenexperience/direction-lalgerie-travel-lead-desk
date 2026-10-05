-- One provider dispatch per lead/template/agency at a time, including uncertain deliveries.
begin;
create unique index lead_email_messages_one_dispatch_idx on public.lead_email_messages
  (lead_id, kind, (coalesce(agency_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  where status = 'sending';
drop policy lead_email_messages_insert on public.lead_email_messages;
create policy lead_email_messages_insert on public.lead_email_messages for insert to authenticated
  with check (created_by = auth.uid() and status = 'draft' and sent_at is null and sent_by is null and provider_id is null
    and exists (select 1 from public.leads l where l.id = lead_id and l.deleted_at is null and l.referent_id is not null
      and (l.referent_id = auth.uid() or public.is_app_admin())));
commit;
