-- Transactional traveler notifications: capture public status transitions at
-- the database boundary, including SQL workflows and concurrent CRM actions.
-- This migration intentionally does not backfill existing leads or send mail.
begin;

create table public.project_status_email_outbox (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  previous_status text,
  status text not null,
  state text not null default 'pending'
    check (state in ('pending', 'sending', 'sent', 'failed', 'unknown', 'skipped')),
  recipient text not null check (length(recipient) between 3 and 254),
  mail_payload jsonb check (mail_payload is null or jsonb_typeof(mail_payload) = 'object'),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  error_code text
);

comment on column public.project_status_email_outbox.previous_status is
  'Previous raw CRM status; enqueue compares its traveler-visible stage with status.';
comment on column public.project_status_email_outbox.status is
  'Raw CRM status captured at transition time, not a live lookup of the lead status.';
comment on column public.project_status_email_outbox.mail_payload is
  'Rendered email frozen by the service after claim, before its first provider call; reuse unchanged for retries.';
comment on column public.project_status_email_outbox.state is
  'Only sent/skipped are terminal. Unknown and exhausted failed rows require explicit review and block later events for the lead.';

create index project_status_email_outbox_due_idx
  on public.project_status_email_outbox (next_attempt_at, created_at, id)
  where state in ('pending', 'failed') and attempts < 3;
create index project_status_email_outbox_lead_order_idx
  on public.project_status_email_outbox (lead_id, created_at, id)
  where state in ('pending', 'sending', 'failed', 'unknown');
create index project_status_email_outbox_sending_idx
  on public.project_status_email_outbox (claimed_at)
  where state = 'sending';

-- Payloads contain traveler contact details. No browser role needs access yet;
-- a future history UI must add a narrowly scoped SELECT policy explicitly.
alter table public.project_status_email_outbox enable row level security;
revoke all on table public.project_status_email_outbox from public, anon, authenticated;
grant select, insert, update, delete on table public.project_status_email_outbox to service_role;

create function public.touch_project_status_email_outbox()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  if new.state = 'failed' and old.state is distinct from 'failed' then
    -- Known failures may retry after 1 and 2 minutes. Attempt 3 is exhausted;
    -- its next_attempt_at is informational and claim will never select it.
    new.next_attempt_at := new.updated_at + case
      when new.attempts <= 1 then interval '1 minute'
      when new.attempts = 2 then interval '2 minutes'
      else interval '4 minutes'
    end;
  end if;
  return new;
end;
$$;
revoke all on function public.touch_project_status_email_outbox() from public, anon, authenticated, service_role;

create trigger trg_touch_project_status_email_outbox
  before update on public.project_status_email_outbox
  for each row execute function public.touch_project_status_email_outbox();

create function public.enqueue_project_status_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_stage text;
  next_stage text;
  trame jsonb;
  mailbox text;
begin
  previous_stage := case old.status::text
    when 'new' then 'recue'
    when 'qualification' then 'precision'
    when 'refinement' then 'precision'
    when 'agency_assignment' then 'preparation'
    when 'co_construction' then 'preparation'
    when 'quote' then 'proposition'
    when 'negotiation' then 'discussion'
    when 'won' then 'acceptee'
    when 'lost' then 'cloturee'
  end;
  next_stage := case new.status::text
    when 'new' then 'recue'
    when 'qualification' then 'precision'
    when 'refinement' then 'precision'
    when 'agency_assignment' then 'preparation'
    when 'co_construction' then 'preparation'
    when 'quote' then 'proposition'
    when 'negotiation' then 'discussion'
    when 'won' then 'acceptee'
    when 'lost' then 'cloturee'
  end;
  if new.deleted_at is not null or next_stage is null
    or previous_stage is not distinct from next_stage then
    return new;
  end if;

  -- Match the versioned website request and its explicit consent. Legacy
  -- intakes, malformed JSON and a string "true" must not activate email.
  trame := new.intake_payload -> 'trame';
  if not coalesce(
    jsonb_typeof(trame) = 'object'
    and trame -> 'version' = '1'::jsonb
    and trame ->> 'type' = 'demande-projet-voyage'
    and jsonb_typeof(trame -> 'ou') = 'object'
    and jsonb_typeof(trame -> 'quand') = 'object'
    and jsonb_typeof(trame -> 'voyageurs') = 'object'
    and jsonb_typeof(trame -> 'envies') = 'object'
    and jsonb_typeof(trame -> 'contact') = 'object'
    and jsonb_typeof(trame -> 'accord') = 'object'
    and trame -> 'accord' -> 'accepte' = 'true'::jsonb,
    false
  ) then
    return new;
  end if;

  -- Snapshot one plain mailbox. Reject recipient lists, header/control
  -- characters and the reserved QA example.invalid domain (and subdomains).
  mailbox := btrim(new.email);
  if mailbox is null or length(mailbox) > 254
    or mailbox !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or new.email ~ '[[:cntrl:],;<>]'
    or lower(split_part(mailbox, '@', 2)) ~ '(^|\.)example\.invalid\.?$' then
    return new;
  end if;

  insert into public.project_status_email_outbox
    (lead_id, previous_status, status, recipient)
  values (new.id, old.status::text, new.status::text, mailbox);
  return new;
end;
$$;
revoke all on function public.enqueue_project_status_email() from public, anon, authenticated, service_role;

create trigger trg_enqueue_project_status_email
  after update of status on public.leads
  for each row
  when (old.status is distinct from new.status)
  execute function public.enqueue_project_status_email();

create function public.claim_project_status_emails(batch_size integer default 10)
returns setof public.project_status_email_outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  stamp timestamptz := clock_timestamp();
  batch_limit integer := least(greatest(coalesce(batch_size, 10), 0), 10);
begin
  -- A missing acknowledgement is not a failure safe to retry. Move stale
  -- claims to manual review, never back to pending, even if payload is null.
  with stale as (
    select q.id
    from public.project_status_email_outbox q
    where q.state = 'sending'
      and q.claimed_at < stamp - interval '10 minutes'
    for update of q skip locked
  )
  update public.project_status_email_outbox q
    set state = 'unknown', error_code = 'dispatch_confirmation_timeout'
    from stale
    where q.id = stale.id;

  return query
  with candidates as (
    select q.id
    from public.project_status_email_outbox q
    where q.state in ('pending', 'failed')
      and q.attempts < 3
      and q.next_attempt_at <= stamp
      and not exists (
        select 1
        from public.project_status_email_outbox earlier
        where earlier.lead_id = q.lead_id
          and earlier.state in ('pending', 'sending', 'failed', 'unknown')
          and (earlier.created_at, earlier.id) < (q.created_at, q.id)
      )
    order by q.created_at, q.id
    limit batch_limit
    for update of q skip locked
  ), claimed as (
    update public.project_status_email_outbox q
      set state = 'sending', attempts = q.attempts + 1,
        claimed_at = stamp, error_code = null
      from candidates
      where q.id = candidates.id
      returning q.*
  )
  select claimed.* from claimed order by claimed.created_at, claimed.id;
end;
$$;
revoke all on function public.claim_project_status_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_project_status_emails(integer) to service_role;

commit;
