-- Keep operator changes in the project timeline, in the same transaction as the edit.
create function public.log_desk_project_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  operator_id uuid := auth.uid();
begin
  if operator_id is null or not exists (select 1 from public.profiles where id = operator_id) then
    return new;
  end if;

  insert into public.activities (lead_id, actor_id, kind)
  select new.id, operator_id, event.kind
  from (values
    ('assistant_qualification_saved',
      new.intake_payload -> 'da_sales_qualification' is not null
      and (new.intake_payload -> 'da_sales_qualification') is distinct from (old.intake_payload -> 'da_sales_qualification')),
    ('trame_updated',
      (new.ai_qualification_payload -> 'trame_v3') is distinct from (old.ai_qualification_payload -> 'trame_v3')
      and (new.intake_payload -> 'da_sales_qualification') is not distinct from (old.intake_payload -> 'da_sales_qualification')),
    ('internal_note_updated', new.internal_notes is distinct from old.internal_notes),
    ('priority_changed', new.priority is distinct from old.priority),
    ('brief_generated', new.brief_generated_at is not null and new.brief_generated_at is distinct from old.brief_generated_at),
    ('brief_edited', new.generated_brief is distinct from old.generated_brief
      and new.brief_generated_at is not distinct from old.brief_generated_at and new.generated_brief is not null),
    ('referent_changed', new.referent_id is distinct from old.referent_id),
    ('qualification_link_issued', new.public_token is not null and new.public_token is distinct from old.public_token)
  ) as event(kind, changed)
  where event.changed;
  return new;
end;
$$;

revoke all on function public.log_desk_project_activity() from public, anon, authenticated, service_role;

create trigger leads_desk_project_activity
after update of intake_payload, ai_qualification_payload, internal_notes, priority, brief_generated_at,
  generated_brief, referent_id, public_token on public.leads
for each row execute function public.log_desk_project_activity();
