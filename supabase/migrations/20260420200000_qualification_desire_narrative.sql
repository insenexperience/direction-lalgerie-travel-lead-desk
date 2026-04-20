-- Qualification v2 : narrative envies + colonnes manquantes + données démo

-- Nouvelles colonnes leads
alter table public.leads
  add column if not exists travel_desire_narrative text;

alter table public.leads
  add column if not exists destination_main text;

alter table public.leads
  add column if not exists qualification_notes text;

-- Index utile
create index if not exists leads_qual_status_pending_idx
  on public.leads (qualification_validation_status)
  where qualification_validation_status = 'pending';

-- ─── Agence de démo : Sahara Explorers ────────────────────────────────────

insert into public.agencies (
  id, legal_name, email, phone, status, type,
  internal_notes,
  circuits_data, ai_capabilities_summary,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000a01',
  'Sahara Explorers',
  'contact@sahara-explorers.dz',
  '+213 770 123 456',
  'active',
  'tour_operator',
  'Opérateur référence Grand Sud. Circuits clé en main bivouac + 4x4. SLA 48h. Fort sur les familles avec enfants.',
  '[
    {
      "id": "circuit-001",
      "name": "Bivouac Hoggar — 7 jours",
      "duration_days": 7,
      "min_pax": 2, "max_pax": 10,
      "price_per_person_eur": 1450,
      "highlights": ["Assekrem au lever du soleil","Bivouac sous les étoiles","Village Touareg"],
      "style": ["aventure","nature","authenticité"],
      "family_friendly": true
    },
    {
      "id": "circuit-002",
      "name": "Tassili Peintures rupestres — 5 jours",
      "duration_days": 5,
      "min_pax": 2, "max_pax": 8,
      "price_per_person_eur": 1100,
      "highlights": ["Art rupestre Néolithique","Forêt de pierre","Campement traditionnel"],
      "style": ["culturel","nature","mystère"],
      "family_friendly": false
    }
  ]'::jsonb,
  'Spécialisée désert, disponible 7j/7 via WhatsApp. Circuits modulables selon budget. Forte valeur ajoutée familles.',
  now() - interval '30 days',
  now() - interval '2 days'
) on conflict (id) do nothing;

-- ─── Lead de démo : Karim Benali ──────────────────────────────────────────

insert into public.leads (
  id, traveler_name, email, phone,
  status, intake_channel, source,
  trip_summary, destination_main,
  travel_style, travelers, budget, trip_dates,
  travel_desire_narrative,
  conversation_transcript,
  ai_qualification_payload,
  ai_qualification_confidence,
  qualification_validation_status,
  manual_takeover,
  intake_payload,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000001001',
  'Karim Benali',
  'karim.benali@gmail.com',
  '+33 6 12 34 56 78',
  'qualification',
  'web_form',
  'Site vitrine',
  'Voyage en famille dans le Grand Sud algérien — désert, bivouac, authenticité. Enfants de 9 et 13 ans.',
  'Grand Sud — Hoggar / Tassili',
  'aventure douce',
  '4 personnes (2 adultes + 2 enfants 9 et 13 ans)',
  '3000–4500 EUR total',
  'Été 2026 — juillet ou août, 10 à 14 jours',
  null,
  '[
    {"role":"user","content":"Bonjour, nous sommes une famille de 4 (2 enfants de 9 et 13 ans) et on rêve de faire un vrai voyage dans le désert algérien cet été. On veut quelque chose d''authentique, pas un hôtel club."},
    {"role":"assistant","content":"Bonjour Karim ! Le Grand Sud algérien est une destination magnifique. Quelques questions : vous préférez le Hoggar (Tamanrasset) ou le Tassili n''Ajjer (Djanet) ? Budget en tête ?"},
    {"role":"user","content":"On ne sait pas trop la différence honnêtement. Le plus beau des deux ! Budget autour de 3000-4000 euros pour nous 4. On veut absolument dormir sous les étoiles au moins une nuit."},
    {"role":"assistant","content":"Le Hoggar sera probablement votre meilleure option avec des enfants — accès plus simple, Assekrem au lever du soleil inoubliable. Le bivouac est tout à fait faisable. Juillet ou août ?"},
    {"role":"user","content":"Juillet de préférence, 2e ou 3e semaine. Et on aimerait aussi voir des peintures rupestres si possible, les enfants adorent l''histoire."}
  ]'::jsonb,
  '{
    "destination": "Hoggar / Tamanrasset",
    "dates": "Juillet 2026, 2e ou 3e semaine",
    "duration_days": "10-14",
    "group": "4 personnes (2A + 2E 9,13 ans)",
    "budget_eur": "3000-4500",
    "style": ["aventure douce","authenticité","nature"],
    "must_haves": ["bivouac étoiles","peintures rupestres","accessible enfants"],
    "flexibility": "haute sur les dates, faible sur le bivouac"
  }'::jsonb,
  0.87,
  'pending',
  false,
  '{"form_id":"demo-001","page":"/voyage-desertique","submitted_at":"2026-04-19T14:32:00Z"}'::jsonb,
  now() - interval '1 day',
  now() - interval '1 hour'
) on conflict (id) do nothing;
