-- Demo seed — Hamid Bencheikh (lead actif, stade Devis envoyé, pipeline)
-- Idempotent : ON CONFLICT DO NOTHING
-- UUIDs fixes :
-- lead     : b2c3d4e5-0001-4000-8000-000000000001
-- proposal : b2c3d4e5-0011-4000-8000-000000000011
-- quote    : b2c3d4e5-0021-4000-8000-000000000021
-- Réutilise l'agence SaharaExp : a1b2c3d4-0003-4000-8000-000000000003

insert into public.leads (
  id, traveler_name, email, phone, whatsapp_phone_number,
  status, source, trip_summary, travel_style, travelers,
  budget, trip_dates, qualification_summary, internal_notes,
  priority, retained_agency_id, reference,
  preferred_channel, preferred_channel_detected_at,
  welcome_email_sent_at, welcome_email_template_used,
  generated_brief, brief_generated_at,
  qualification_blocks, qualification_notes, destination_main,
  created_at, updated_at
) values (
  'b2c3d4e5-0001-4000-8000-000000000001',
  'Hamid Bencheikh',
  'hamid.bencheikh@gmail.com',
  '+33 6 77 88 99 00',
  '+33677889900',
  'quote',
  'whatsapp',
  'Circuit 10 jours Alger → Constantine → Annaba. Famille 4 personnes, style culturel-histoire.',
  'Culturel & Patrimoine',
  '4 personnes (famille, 2 enfants)',
  '6 000 € – 7 500 €',
  'Juillet 2026, semaines 28-29',
  'Famille franco-algérienne, retour aux sources. Enfants 8 et 12 ans. Veut visiter Constantine et les ruines romaines de Timgad.',
  'Devis envoyé le 19 avril. En attente de retour sous 5 jours.',
  'high',
  'a1b2c3d4-0003-4000-8000-000000000003',
  'DA-2026-0051',
  'whatsapp',
  '2026-04-11 10:30:00+00',
  '2026-04-10 16:00:00+00',
  'ai_double_cta',
  E'# Brief Agence — DA-2026-0051 — Hamid Bencheikh\n\n## Profil voyageurs\n- 4 personnes (2 adultes + 2 enfants 8 et 12 ans)\n- Style : Culturel & Patrimoine\n- Budget : 6 000 – 7 500 € (hors vols)\n\n## Dates\n- Juillet 2026, semaines 28-29\n- Durée : 10 jours\n\n## Destinations\nAlger → Sétif → Timgad → Constantine → Annaba\n\n## Résumé\nVoyage familial culturel. Famille franco-algérienne, retour aux sources. Sites romains + villes historiques Est algérien.\n\n## Qualification\n- Hébergement : Hôtel 3★ adapté famille\n- Transport : Véhicule familial avec chauffeur\n- Repas : Petits-déjeuners inclus minimum\n\n## Notes opérateur\nPère parle arabe. Enfants veulent voir le pont suspendu de Sidi Mcid. Rythme modéré.',
  '2026-04-12 09:00:00+00',
  '{"motivations": {"selections": ["culture", "histoire", "famille"], "notes": "Retour aux sources famille franco-algérienne"}, "accommodation": {"selections": ["hotel_3plus"], "notes": "Adapté famille avec enfants"}, "transport": {"selections": ["vehicule_prive_chauffeur"], "notes": "Véhicule familial 7 places"}, "budget": {"selections": ["mid_range"], "notes": "6 000–7 500 € hors vols"}, "pace": {"selections": ["moderate"], "notes": "Rythme adapté enfants"}, "special_requirements": {"selections": [], "notes": "Enfants 8 et 12 ans. Pont Sidi Mcid obligatoire."}}',
  'Famille franco-algérienne, retour aux sources. Enfants veulent voir le pont Sidi Mcid. Rythme modéré.',
  'Est Algérien — Constantine, Annaba',
  '2026-04-09 14:00:00+00',
  '2026-04-19 11:00:00+00'
) on conflict (id) do nothing;

insert into public.lead_circuit_proposals (
  id, lead_id, agency_id, title, circuit_outline, status, version,
  brief_sent_at, agency_proposal_price, agency_proposal_duration_days,
  agency_proposal_summary, proposal_received_at,
  created_at, updated_at
) values (
  'b2c3d4e5-0011-4000-8000-000000000011',
  'b2c3d4e5-0001-4000-8000-000000000001',
  'a1b2c3d4-0003-4000-8000-000000000003',
  'Circuit Est Algérien 10 jours — Famille',
  'Alger → Sétif → Timgad → Constantine → Annaba',
  'approved',
  1,
  '2026-04-13 08:00:00+00',
  6400,
  10,
  'Circuit familial 10 jours, Est algérien. Alger (2 nuits) → Sétif/Djémila (1 nuit) → Timgad/Batna (2 nuits) → Constantine (3 nuits) → Annaba (2 nuits). Inclus : véhicule familial 7 places + chauffeur, hôtels 3★, petits-déjeuners, guide francophone, entrées tous sites. Adapté enfants.',
  '2026-04-15 14:00:00+00',
  '2026-04-12 10:00:00+00',
  '2026-04-15 14:00:00+00'
) on conflict (id) do nothing;

insert into public.quotes (
  id, lead_id, kind, status, workflow_status, summary, is_traveler_visible,
  items, created_at, updated_at
) values (
  'b2c3d4e5-0021-4000-8000-000000000021',
  'b2c3d4e5-0001-4000-8000-000000000001',
  'da_traveler',
  'sent',
  'awaiting_response',
  'Devis circuit Est Algérien 10 jours — Famille Bencheikh (4 pers.)',
  true,
  '[
    {"label": "Hébergement 9 nuits hôtel 3★ (base familiale)", "quantity": 1, "unit_price": 2160, "category": "lodging"},
    {"label": "Véhicule familial avec chauffeur 10 jours", "quantity": 1, "unit_price": 1200, "category": "transport"},
    {"label": "Guide francophone 10 jours", "quantity": 1, "unit_price": 900, "category": "guide"},
    {"label": "Petits-déjeuners (4 pers. × 9 j)", "quantity": 1, "unit_price": 540, "category": "meals"},
    {"label": "Entrées sites (Timgad, Djémila, musées)", "quantity": 4, "unit_price": 80, "category": "activities"},
    {"label": "Frais DA & coordination", "quantity": 1, "unit_price": 280, "category": "fees"}
  ]',
  '2026-04-18 10:00:00+00',
  '2026-04-19 11:00:00+00'
) on conflict (id) do nothing;

insert into public.activities (id, lead_id, actor_id, kind, detail, created_at)
values
  ('b2c3d4e5-00a1-4000-8000-000000000001', 'b2c3d4e5-0001-4000-8000-000000000001', null,
   'lead_received', 'Lead reçu via WhatsApp. Famille Bencheikh, 4 personnes, Est algérien.', '2026-04-09 14:00:00+00'),
  ('b2c3d4e5-00a2-4000-8000-000000000002', 'b2c3d4e5-0001-4000-8000-000000000001', null,
   'welcome_email_sent', 'Email de bienvenue envoyé (template: ai_double_cta).', '2026-04-10 16:00:00+00'),
  ('b2c3d4e5-00a3-4000-8000-000000000003', 'b2c3d4e5-0001-4000-8000-000000000001', null,
   'preferred_channel_detected', 'whatsapp', '2026-04-11 10:30:00+00'),
  ('b2c3d4e5-00a4-4000-8000-000000000004', 'b2c3d4e5-0001-4000-8000-000000000001', null,
   'qualification_completed', 'Qualification complète. Circuit Est algérien, famille franco-algérienne, budget 6–7.5k€.', '2026-04-12 09:00:00+00'),
  ('b2c3d4e5-00a5-4000-8000-000000000005', 'b2c3d4e5-0001-4000-8000-000000000001', null,
   'brief_generated', 'Brief agence généré automatiquement.', '2026-04-12 09:05:00+00'),
  ('b2c3d4e5-00a6-4000-8000-000000000006', 'b2c3d4e5-0001-4000-8000-000000000001', null,
   'agency_consultation_sent', 'Agence consultée : SaharaExp', '2026-04-12 10:00:00+00'),
  ('b2c3d4e5-00a7-4000-8000-000000000007', 'b2c3d4e5-0001-4000-8000-000000000001', null,
   'agency_proposal_received', 'SaharaExp : proposition reçue. 6 400 EUR / 10 jours. Circuit Est Algérien famille.', '2026-04-15 14:00:00+00'),
  ('b2c3d4e5-00a8-4000-8000-000000000008', 'b2c3d4e5-0001-4000-8000-000000000001', null,
   'agency_selected', 'Offre retenue : SaharaExp. Circuit adapté famille.', '2026-04-16 09:00:00+00'),
  ('b2c3d4e5-00a9-4000-8000-000000000009', 'b2c3d4e5-0001-4000-8000-000000000001', null,
   'quote_sent_to_traveler', 'Devis DA-2026-0051 envoyé par WhatsApp et email à Hamid Bencheikh. Total : 5 400 EUR. En attente de confirmation sous 5 jours.', '2026-04-19 11:00:00+00')
on conflict (id) do nothing;
