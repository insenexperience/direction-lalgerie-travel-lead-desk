-- Suivi devis (workflow) + lignes structurées pour PDF / écran.

do $migration$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'quote_workflow_status'
  ) then
    create type public.quote_workflow_status as enum (
      'draft',
      'sent',
      'awaiting_response',
      'renegotiation',
      'won',
      'lost',
      'suspended'
    );
  end if;
end
$migration$;

alter table public.quotes
  add column if not exists workflow_status public.quote_workflow_status;

update public.quotes
set workflow_status = 'draft'::public.quote_workflow_status
where workflow_status is null;

alter table public.quotes
  alter column workflow_status set default 'draft'::public.quote_workflow_status;

alter table public.quotes
  alter column workflow_status set not null;

alter table public.quotes
  add column if not exists items jsonb not null default '[]'::jsonb;

alter table public.quotes
  add column if not exists pdf_generated_at timestamptz;
