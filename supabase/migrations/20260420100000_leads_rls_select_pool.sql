-- Pool DA : tout compte authentifié doit pouvoir LIRE tous les leads (y compris sans référent),
-- pour assigner un opérateur. Les politiques PERMISSIVE sont combinées en OU avec les autres
-- politiques SELECT existantes : cette politique neutralise une règle du type
-- « referent_id = auth.uid() » qui cachait les lignes en attente d’assignation.
--
-- À appliquer sur le projet Supabase lié à l’app (`supabase db push` ou SQL Editor).

drop policy if exists "leads_select_pool_all_authenticated" on public.leads;

create policy "leads_select_pool_all_authenticated"
  on public.leads
  for select
  to authenticated
  using (true);
