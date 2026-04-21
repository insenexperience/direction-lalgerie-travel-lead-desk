-- MVP Manual Flow v5 — new columns on leads + expanded proposal statuses

-- ── leads: new columns ──────────────────────────────────────────────────────
alter table public.leads
  add column if not exists preferred_channel         text check (preferred_channel in ('whatsapp', 'email')),
  add column if not exists preferred_channel_detected_at timestamptz,
  add column if not exists welcome_email_sent_at     timestamptz,
  add column if not exists welcome_email_template_used text,
  add column if not exists generated_brief           text,
  add column if not exists brief_generated_at        timestamptz,
  add column if not exists brief_edited_at           timestamptz;

-- ── co_construction_proposal_status: add new values ─────────────────────────
-- Postgres enums only support adding values, never removing.
alter type public.co_construction_proposal_status add value if not exists 'pending_send'      before 'awaiting_agency';
alter type public.co_construction_proposal_status add value if not exists 'awaiting_response' before 'submitted';
alter type public.co_construction_proposal_status add value if not exists 'declined'          after  'approved';
alter type public.co_construction_proposal_status add value if not exists 'expired'           after  'declined';

-- ── lead_circuit_proposals: new columns ─────────────────────────────────────
alter table public.lead_circuit_proposals
  add column if not exists brief_sent_at                 timestamptz,
  add column if not exists agency_proposal_price         numeric,
  add column if not exists agency_proposal_duration_days integer,
  add column if not exists agency_proposal_summary       text,
  add column if not exists agency_proposal_pdf_path      text,
  add column if not exists proposal_received_at          timestamptz,
  add column if not exists proposal_declined_at          timestamptz;
