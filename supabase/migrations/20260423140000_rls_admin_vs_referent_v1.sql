-- RLS v1 : admin (profiles.role = 'admin') = accès complet.
-- Référent lead : lecture / écriture sur les leads « pool » (referent_id is null) + ses dossiers assignés.
-- Assignation d’un autre opérateur DA : autorisée depuis le pool si le nouveau referent_id pointe vers un profil lead_referent ou admin.
-- Tables liées (consultations, quotes, …) : même périmètre que le lead parent.
--
-- Après push : donner le rôle admin à au moins un compte (update profiles set role = 'admin' where id = '…').

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role = 'admin'
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.lead_is_visible_for_rls(lead_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leads l
    where l.id = lead_uuid
      and (
        public.is_app_admin()
        or l.referent_id is null
        or l.referent_id = auth.uid()
      )
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

revoke all on function public.lead_is_visible_for_rls(uuid) from public;
grant execute on function public.lead_is_visible_for_rls(uuid) to authenticated;

-- Anciennes policies permissives
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "agencies_all_authenticated" on public.agencies;
drop policy if exists "leads_all_authenticated" on public.leads;
drop policy if exists "leads_select_pool_all_authenticated" on public.leads;
drop policy if exists "consultations_all_authenticated" on public.consultations;
drop policy if exists "quotes_all_authenticated" on public.quotes;
drop policy if exists "activities_all_authenticated" on public.activities;
drop policy if exists "lead_snapshots_all_authenticated" on public.lead_snapshots;
drop policy if exists "lead_circuit_proposals_all_authenticated" on public.lead_circuit_proposals;

-- profiles
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- agencies : catalogue lisible par tous les connectés ; écriture réservée aux admins
create policy "agencies_select_authenticated"
  on public.agencies for select
  to authenticated
  using (true);

create policy "agencies_insert_admin"
  on public.agencies for insert
  to authenticated
  with check (public.is_app_admin());

create policy "agencies_update_admin"
  on public.agencies for update
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "agencies_delete_admin"
  on public.agencies for delete
  to authenticated
  using (public.is_app_admin());

-- leads
create policy "leads_select_referent_or_admin"
  on public.leads for select
  to authenticated
  using (
    public.is_app_admin()
    or referent_id is null
    or referent_id = auth.uid()
  );

create policy "leads_insert_authenticated"
  on public.leads for insert
  to authenticated
  with check (true);

create policy "leads_update_admin"
  on public.leads for update
  to authenticated
  using (public.is_app_admin())
  with check (true);

create policy "leads_update_referent"
  on public.leads for update
  to authenticated
  using (
    not public.is_app_admin()
    and (referent_id is null or referent_id = auth.uid())
  )
  with check (
    not public.is_app_admin()
    and (
      referent_id is null
      or exists (
        select 1
        from public.profiles p
        where p.id = referent_id
          and p.role in ('lead_referent', 'admin')
      )
    )
  );

create policy "leads_delete_admin"
  on public.leads for delete
  to authenticated
  using (public.is_app_admin());

-- consultations
create policy "consultations_select"
  on public.consultations for select
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id));

create policy "consultations_insert"
  on public.consultations for insert
  to authenticated
  with check (public.lead_is_visible_for_rls(lead_id));

create policy "consultations_update"
  on public.consultations for update
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id))
  with check (public.lead_is_visible_for_rls(lead_id));

create policy "consultations_delete"
  on public.consultations for delete
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id));

-- quotes
create policy "quotes_select"
  on public.quotes for select
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id));

create policy "quotes_insert"
  on public.quotes for insert
  to authenticated
  with check (public.lead_is_visible_for_rls(lead_id));

create policy "quotes_update"
  on public.quotes for update
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id))
  with check (public.lead_is_visible_for_rls(lead_id));

create policy "quotes_delete"
  on public.quotes for delete
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id));

-- activities
create policy "activities_select"
  on public.activities for select
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id));

create policy "activities_insert"
  on public.activities for insert
  to authenticated
  with check (public.lead_is_visible_for_rls(lead_id));

create policy "activities_update"
  on public.activities for update
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id))
  with check (public.lead_is_visible_for_rls(lead_id));

create policy "activities_delete"
  on public.activities for delete
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id));

-- lead_snapshots
create policy "lead_snapshots_select"
  on public.lead_snapshots for select
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id));

create policy "lead_snapshots_insert"
  on public.lead_snapshots for insert
  to authenticated
  with check (public.lead_is_visible_for_rls(lead_id));

create policy "lead_snapshots_update"
  on public.lead_snapshots for update
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id))
  with check (public.lead_is_visible_for_rls(lead_id));

create policy "lead_snapshots_delete"
  on public.lead_snapshots for delete
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id));

-- lead_circuit_proposals (si la table existe déjà)
create policy "lead_circuit_proposals_select"
  on public.lead_circuit_proposals for select
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id));

create policy "lead_circuit_proposals_insert"
  on public.lead_circuit_proposals for insert
  to authenticated
  with check (public.lead_is_visible_for_rls(lead_id));

create policy "lead_circuit_proposals_update"
  on public.lead_circuit_proposals for update
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id))
  with check (public.lead_is_visible_for_rls(lead_id));

create policy "lead_circuit_proposals_delete"
  on public.lead_circuit_proposals for delete
  to authenticated
  using (public.lead_is_visible_for_rls(lead_id));
