create or replace function public.create_initial_family(
  p_family_name text,
  p_baby_name text,
  p_baby_birth_date date
)
returns table (family_id uuid, baby_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_family_id uuid;
  new_baby_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if exists (
    select 1
    from public.family_members
    where user_id = current_user_id
  ) then
    raise exception 'user_already_has_family';
  end if;

  if nullif(trim(p_baby_name), '') is null then
    raise exception 'baby_name_required';
  end if;

  insert into public.families (name)
  values (nullif(trim(p_family_name), ''))
  returning id into new_family_id;

  insert into public.family_members (family_id, user_id, role)
  values (new_family_id, current_user_id, 'parent');

  insert into public.babies (family_id, name, birth_date)
  values (new_family_id, trim(p_baby_name), p_baby_birth_date)
  returning id into new_baby_id;

  return query select new_family_id, new_baby_id;
end;
$$;

revoke all on function public.create_initial_family(text, text, date) from public;
grant execute on function public.create_initial_family(text, text, date) to authenticated;
