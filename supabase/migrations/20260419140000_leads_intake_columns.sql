-- Champs alignés sur le payload du formulaire « da-voyage » (EmailJS / site public).

alter table public.leads
  add column if not exists submission_id text,
  add column if not exists intake_payload jsonb,
  add column if not exists page_origin text;

create unique index if not exists leads_submission_id_unique
  on public.leads (submission_id)
  where submission_id is not null;
