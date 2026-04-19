-- À exécuter manuellement dans le SQL Editor si tu veux repartir de zéro (destructif).
-- Ordre respectant les clés étrangères.

truncate table public.lead_snapshots restart identity cascade;
truncate table public.activities restart identity cascade;
truncate table public.lead_circuit_proposals restart identity cascade;
truncate table public.quotes restart identity cascade;
truncate table public.consultations restart identity cascade;
truncate table public.leads restart identity cascade;
truncate table public.agencies restart identity cascade;
