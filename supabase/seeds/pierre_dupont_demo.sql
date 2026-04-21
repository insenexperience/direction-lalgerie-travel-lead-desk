-- Demo seed — Pierre Dupont (voyage Algérie du Nord + Sahara, J-30 = 2026-03-22)
-- Idempotent : ON CONFLICT DO NOTHING sur toutes les tables.
-- Usage : psql $DATABASE_URL -f supabase/seeds/pierre_dupont_demo.sql

-- ── UUIDs fixes ──────────────────────────────────────────────────────────────
-- lead           : a1b2c3d4-0001-4000-8000-000000000001
-- agency_nord    : a1b2c3d4-0002-4000-8000-000000000002
-- agency_sahara  : a1b2c3d4-0003-4000-8000-000000000003
-- agency_refused : a1b2c3d4-0004-4000-8000-000000000004
-- proposal_nord  : a1b2c3d4-0011-4000-8000-000000000011
-- proposal_sah   : a1b2c3d4-0012-4000-8000-000000000012
-- proposal_ref   : a1b2c3d4-0013-4000-8000-000000000013
-- quote          : a1b2c3d4-0021-4000-8000-000000000021
-- contact        : a1b2c3d4-0031-4000-8000-000000000031
-- activities     : a1b2c3d4-00A1...00AF + 00B1...00B4

-- ── Agences demo ─────────────────────────────────────────────────────────────

insert into public.agencies (
  id, legal_name, trade_name, type, country, city,
  destinations, languages, segments, status, email, phone
) values
  (
    'a1b2c3d4-0002-4000-8000-000000000002',
    'Circuits Algérie Nord SARL',
    'AlgérieNord Tours',
    'dmc',
    'Algeria',
    'Alger',
    'Alger, Tipasa, Bejaia, Tlemcen, Constantine',
    'Français, Arabe, Anglais',
    'Familles, Couples, Culturel',
    'active',
    'contact@algerie-nord.dz',
    '+213 21 00 00 01'
  ),
  (
    'a1b2c3d4-0003-4000-8000-000000000003',
    'Sahara Expeditions SPA',
    'SaharaExp',
    'tour_operator',
    'Algeria',
    'Ghardaïa',
    'Ghardaïa, Tamanrasset, Timimoun, Djanet',
    'Français, Arabe',
    'Aventure, Trekking, 4x4',
    'active',
    'info@sahara-exp.dz',
    '+213 29 00 00 02'
  ),
  (
    'a1b2c3d4-0004-4000-8000-000000000004',
    'Voyage Atlas DZ',
    'AtlasDZ',
    'travel_agency',
    'Algeria',
    'Oran',
    'Oran, Tlemcen',
    'Français',
    'Culturel, Gastronomie',
    'active',
    'info@atlas-dz.dz',
    '+213 41 00 00 03'
  )
on conflict (id) do nothing;

-- ── Lead principal ────────────────────────────────────────────────────────────

insert into public.leads (
  id,
  traveler_name,
  email,
  phone,
  whatsapp_phone_number,
  status,
  source,
  trip_summary,
  travel_style,
  travelers,
  budget,
  trip_dates,
  qualification_summary,
  internal_notes,
  priority,
  retained_agency_id,
  reference,
  preferred_channel,
  preferred_channel_detected_at,
  welcome_email_sent_at,
  welcome_email_template_used,
  generated_brief,
  brief_generated_at,
  qualification_blocks,
  qualification_notes,
  destination_main,
  created_at,
  updated_at
) values (
  'a1b2c3d4-0001-4000-8000-000000000001',
  'Pierre Dupont',
  'pierre.dupont@example.com',
  '+33 6 12 34 56 78',
  '+33612345678',
  'won',
  'web_form',
  'Circuit 12 jours Alger → Tipasa → Ghardaïa → Tamanrasset. Couple, budget ~5 000 €, style aventure-culturel.',
  'Aventure & Culturel',
  '2 adultes (couple)',
  '4 500 € – 5 500 €',
  'Avril 2026, flexible ±3 jours',
  'Voyageur très motivé, a déjà visité le Maroc. Souhaite un guide local parlant français. Pas de contraintes alimentaires.',
  'RAS — bon dossier, proposition SaharaExp retenue après arbitrage.',
  'normal',
  'a1b2c3d4-0003-4000-8000-000000000003',
  'DA-2026-0042',
  'whatsapp',
  '2026-03-23 09:15:00+00',
  '2026-03-22 14:30:00+00',
  'ai_double_cta',
  E'# Brief Agence — DA-2026-0042 — Pierre Dupont\n\n## Profil voyageurs\n- 2 adultes (couple)\n- Style : Aventure & Culturel\n- Budget : 4 500 € – 5 500 € (hors vols)\n\n## Dates\n- Avril 2026, flexible ±3 jours\n- Durée souhaitée : 12 jours\n\n## Destinations\nAlger → Tipasa → Ghardaïa → Tamanrasset\n\n## Résumé du voyage souhaité\nCircuit combinant patrimoine antique (Tipasa, Djemila), architecture mozabite et grand Sahara. Guide francophone obligatoire.\n\n## Qualification détaillée\n- Hébergement : Hôtel 3★+ + campement Sahara 1 nuit\n- Transport : 4x4 avec chauffeur pour la partie désert\n- Repas : Inclus depuis Ghardaïa\n\n## Notes opérateur\nVoyageur a déjà voyagé au Maroc, niveau d''exigence modéré-élevé. Pas de contraintes alimentaires.\n\n## Question à l''agence\nPouvez-vous proposer une option camping sous les étoiles à Tamanrasset ?',
  '2026-03-25 10:00:00+00',
  '{"motivations": {"selections": ["culture", "aventure"], "notes": "A voyagé au Maroc — niveau exigence modéré-élevé"}, "accommodation": {"selections": ["hotel_3plus", "riad_maison_hotes"], "notes": "1 nuit campement Sahara souhaité"}, "transport": {"selections": ["4x4_chauffeur"], "notes": ""}, "budget": {"selections": ["mid_range"], "notes": "4 500–5 500 € hors vols"}, "pace": {"selections": ["moderate"], "notes": ""}, "special_requirements": {"selections": [], "notes": "Guide francophone obligatoire. Pas de contraintes alimentaires."}}',
  'Voyageur très motivé. Guide francophone obligatoire. Intéressé par option camping étoiles à Tamanrasset.',
  'Algérie du Nord + Sahara',
  '2026-03-22 12:00:00+00',
  '2026-04-05 16:00:00+00'
)
on conflict (id) do nothing;

-- ── Propositions agences ──────────────────────────────────────────────────────

insert into public.lead_circuit_proposals (
  id, lead_id, agency_id, title, circuit_outline, status, version,
  brief_sent_at, agency_proposal_price, agency_proposal_duration_days,
  agency_proposal_summary, proposal_received_at,
  created_at, updated_at
) values
  -- AlgérieNord Tours — proposition reçue mais non retenue
  (
    'a1b2c3d4-0011-4000-8000-000000000011',
    'a1b2c3d4-0001-4000-8000-000000000001',
    'a1b2c3d4-0002-4000-8000-000000000002',
    'Circuit Nord Algérie 10 jours',
    'Alger → Tipasa → Djemila → Constantine → Bejaia',
    'submitted',
    1,
    '2026-03-26 08:00:00+00',
    4800,
    10,
    E'Circuit culturel 10 jours axé sur le patrimoine romain et berbère. Alger (2 nuits) → Tipasa (1 nuit) → Djemila (1 nuit) → Constantine (2 nuits) → Bejaia (2 nuits). Hôtels 3★, guide francophone inclus, transport privé. Option nuit chez l''habitant possible à Bejaia.\n\nPoints forts : groupe limité 2 pax, guide spécialisé archéologie, prix transport Alger↔Bejaia inclus.',
    '2026-03-28 15:30:00+00',
    '2026-03-25 09:00:00+00',
    '2026-03-28 15:30:00+00'
  ),
  -- SaharaExp — proposition retenue (approved)
  (
    'a1b2c3d4-0012-4000-8000-000000000012',
    'a1b2c3d4-0001-4000-8000-000000000001',
    'a1b2c3d4-0003-4000-8000-000000000003',
    'Grand Circuit Sahara 12 jours',
    'Alger → Tipasa → Ghardaïa → Tamanrasset',
    'approved',
    1,
    '2026-03-26 08:30:00+00',
    5200,
    12,
    E'Circuit complet 12 jours combinant patrimoine du Nord et grand Sahara. Alger (2 nuits) → Tipasa (1 nuit) → Ghardaïa (2 nuits, architecture mozabite) → Tamanrasset (4 nuits, excursions Hoggar + Assekrem).\n\nInclus : vols intérieurs Alger↔Ghardaïa et Tamanrasset↔Alger, 4x4 avec chauffeur guide pour tout le désert, 1 nuit campement étoilé à Tamanrasset, tous repas depuis Ghardaïa, hôtels 3★ dans les villes.\n\nOption retenue par DA : ajouter visite Tipasa en matinée J2 + ajustement campement nuit J9.',
    '2026-03-29 11:00:00+00',
    '2026-03-25 09:30:00+00',
    '2026-03-29 11:00:00+00'
  ),
  -- AtlasDZ — refus
  (
    'a1b2c3d4-0013-4000-8000-000000000013',
    'a1b2c3d4-0001-4000-8000-000000000001',
    'a1b2c3d4-0004-4000-8000-000000000004',
    'Proposition circuit Ouest',
    '',
    'declined',
    1,
    '2026-03-26 09:00:00+00',
    null,
    null,
    null,
    null,
    '2026-03-25 10:00:00+00',
    '2026-03-27 14:00:00+00'
  )
on conflict (id) do nothing;

-- ── Devis DA voyageur ─────────────────────────────────────────────────────────

insert into public.quotes (
  id, lead_id, kind, status, workflow_status, summary, is_traveler_visible,
  items,
  created_at, updated_at
) values (
  'a1b2c3d4-0021-4000-8000-000000000021',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'da_traveler',
  'sent',
  'won',
  'Devis circuit Algérie 12 jours — Pierre & Marie Dupont',
  true,
  '[
    {"label": "Hébergement 11 nuits (hôtels 3★ + 1 nuit campement)", "quantity": 1, "unit_price": 1980, "category": "lodging"},
    {"label": "Guide francophone 12 jours", "quantity": 1, "unit_price": 840, "category": "guide"},
    {"label": "Transport 4x4 chauffeur (Ghardaïa → Tamanrasset)", "quantity": 1, "unit_price": 720, "category": "transport"},
    {"label": "Vols intérieurs (Alger↔Ghardaïa + Tamanrasset↔Alger)", "quantity": 2, "unit_price": 380, "category": "flights"},
    {"label": "Repas inclus (depuis Ghardaïa, 8 jours)", "quantity": 1, "unit_price": 560, "category": "meals"},
    {"label": "Frais DA & coordination", "quantity": 1, "unit_price": 320, "category": "fees"}
  ]',
  '2026-04-01 10:00:00+00',
  '2026-04-05 16:00:00+00'
)
on conflict (id) do nothing;

-- ── Contact voyageur ──────────────────────────────────────────────────────────

insert into public.contacts (
  id,
  type,
  source_lead_id,
  full_name,
  email,
  phone,
  whatsapp_phone_number,
  first_seen_at,
  won_at,
  last_interaction_at,
  tags,
  created_at,
  updated_at
) values (
  'a1b2c3d4-0031-4000-8000-000000000031',
  'traveler',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'Pierre Dupont',
  'pierre.dupont@example.com',
  '+33 6 12 34 56 78',
  '+33612345678',
  '2026-03-22 12:00:00+00',
  '2026-04-05 16:00:00+00',
  '2026-04-05 16:00:00+00',
  array['whatsapp', 'sahara', 'couple', 'won-2026'],
  '2026-04-05 16:00:00+00',
  '2026-04-05 16:00:00+00'
)
on conflict (id) do nothing;

-- ── Activités (15 entrées) ────────────────────────────────────────────────────

insert into public.activities (id, lead_id, actor_id, kind, detail, created_at)
values
  -- J0 : réception lead
  (
    'a1b2c3d4-00a1-4000-8000-000000000001',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'lead_received',
    'Lead reçu via formulaire web. Source: web_form.',
    '2026-03-22 12:00:00+00'
  ),
  -- J0 : email de bienvenue
  (
    'a1b2c3d4-00a2-4000-8000-000000000002',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'welcome_email_sent',
    'Email de bienvenue envoyé (template: ai_double_cta). Double CTA WhatsApp + email.',
    '2026-03-22 14:30:00+00'
  ),
  -- J1 : détection canal
  (
    'a1b2c3d4-00a3-4000-8000-000000000003',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'preferred_channel_detected',
    'whatsapp',
    '2026-03-23 09:15:00+00'
  ),
  -- J1 : qualification démarrée
  (
    'a1b2c3d4-00a4-4000-8000-000000000004',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'qualification_started',
    'Qualification démarrée via WhatsApp.',
    '2026-03-23 09:20:00+00'
  ),
  -- J3 : qualification complétée
  (
    'a1b2c3d4-00a5-4000-8000-000000000005',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'qualification_completed',
    'Tous les blocs de qualification validés. Style: Aventure & Culturel. Budget: 4 500–5 500 €.',
    '2026-03-25 09:50:00+00'
  ),
  -- J3 : brief généré
  (
    'a1b2c3d4-00a6-4000-8000-000000000006',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'brief_generated',
    'Brief agence généré automatiquement lors du passage en étape Assignation.',
    '2026-03-25 10:00:00+00'
  ),
  -- J4 : 3 agences consultées
  (
    'a1b2c3d4-00a7-4000-8000-000000000007',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'agency_consultation_sent',
    'Agence consultée : AlgérieNord Tours (a1b2c3d4-0002-4000-8000-000000000002)',
    '2026-03-25 10:05:00+00'
  ),
  (
    'a1b2c3d4-00a8-4000-8000-000000000008',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'agency_consultation_sent',
    'Agence consultée : SaharaExp (a1b2c3d4-0003-4000-8000-000000000003)',
    '2026-03-25 10:06:00+00'
  ),
  (
    'a1b2c3d4-00a9-4000-8000-000000000009',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'agency_consultation_sent',
    'Agence consultée : AtlasDZ (a1b2c3d4-0004-4000-8000-000000000004)',
    '2026-03-25 10:07:00+00'
  ),
  -- J5 : refus AtlasDZ
  (
    'a1b2c3d4-00aa-4000-8000-00000000000a',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'agency_proposal_declined',
    'AtlasDZ (a1b2c3d4-0004-4000-8000-000000000004) : refus agence — hors zone de compétence.',
    '2026-03-27 14:00:00+00'
  ),
  -- J6 : proposition AlgérieNord reçue
  (
    'a1b2c3d4-00ab-4000-8000-00000000000b',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'agency_proposal_received',
    'AlgérieNord Tours : proposition reçue. 4 800 € / 10 jours. Circuit Nord uniquement.',
    '2026-03-28 15:30:00+00'
  ),
  -- J7 : proposition SaharaExp reçue
  (
    'a1b2c3d4-00ac-4000-8000-00000000000c',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'agency_proposal_received',
    'SaharaExp : proposition reçue. 5 200 € / 12 jours. Circuit complet Nord + Sahara avec campement.',
    '2026-03-29 11:00:00+00'
  ),
  -- J7 : offre SaharaExp retenue
  (
    'a1b2c3d4-00ad-4000-8000-00000000000d',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'agency_selected',
    'Offre retenue : SaharaExp (a1b2c3d4-0003-4000-8000-000000000003). Meilleur rapport qualité-prix + option campement incluse.',
    '2026-03-29 14:00:00+00'
  ),
  -- J10 : devis envoyé voyageur
  (
    'a1b2c3d4-00ae-4000-8000-00000000000e',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'quote_sent_to_traveler',
    'Devis DA-2026-0042 envoyé par email à pierre.dupont@example.com. Total : 4 800 €.',
    '2026-04-01 10:30:00+00'
  ),
  -- J14 : dossier gagné
  (
    'a1b2c3d4-00af-4000-8000-00000000000f',
    'a1b2c3d4-0001-4000-8000-000000000001',
    null,
    'lead_status_updated',
    'Statut → won. Pierre Dupont a confirmé la réservation et effectué le virement d''acompte.',
    '2026-04-05 16:00:00+00'
  )
on conflict (id) do nothing;
