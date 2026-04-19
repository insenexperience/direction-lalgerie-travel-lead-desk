-- Libellés opérateurs : full_name souvent vide si l’utilisateur a été créé sans métadonnée.
-- On stocke l’email Auth sur le profil et on remplit un libellé de secours à partir de l’email.

alter table public.profiles
  add column if not exists email text not null default '';

update public.profiles p
set email = coalesce(nullif(trim(u.email), ''), p.email)
from auth.users u
where u.id = p.id;

update public.profiles p
set full_name = coalesce(
    nullif(trim(p.full_name), ''),
    split_part(nullif(trim(p.email), ''), '@', 1),
    ''
  )
where trim(p.full_name) = ''
  and trim(p.email) <> '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := coalesce(new.email, '');
  v_full text := coalesce(nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''), '');
begin
  if v_full = '' and v_email <> '' then
    v_full := split_part(v_email, '@', 1);
  end if;

  insert into public.profiles (id, full_name, role, email)
  values (new.id, v_full, 'lead_referent', v_email);
  return new;
end;
$$;
