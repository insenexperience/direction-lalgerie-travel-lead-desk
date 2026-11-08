create table public.desk_assistant_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  tested_at timestamptz,
  check (not enabled or tested_at is not null)
);

insert into public.desk_assistant_settings (id) values (true);

alter table public.desk_assistant_settings enable row level security;
revoke all on public.desk_assistant_settings from anon, authenticated;
grant select, update (enabled, tested_at) on public.desk_assistant_settings to authenticated;

create policy desk_assistant_read on public.desk_assistant_settings
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'lead_referent')));

create policy desk_assistant_manage on public.desk_assistant_settings
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());
