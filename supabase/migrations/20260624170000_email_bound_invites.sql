alter table public.family_invites
add column if not exists invited_email text;

create index if not exists family_invites_invited_email_idx
on public.family_invites(invited_email);

create or replace function public.create_family_invite(
  p_family_id uuid,
  p_invited_email text,
  p_role text
)
returns table (invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_email text := lower(trim(p_invited_email));
  normalized_role text := coalesce(nullif(trim(p_role), ''), 'parent');
  new_code text;
  new_expires_at timestamptz := now() + interval '7 days';
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if normalized_role not in ('parent', 'caregiver', 'viewer') then
    raise exception 'invalid_role';
  end if;

  if normalized_email is null or position('@' in normalized_email) <= 1 then
    raise exception 'invalid_email';
  end if;

  if not exists (
    select 1
    from public.family_members
    where family_id = p_family_id
      and user_id = current_user_id
      and role = 'parent'
  ) then
    raise exception 'not_allowed';
  end if;

  loop
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    begin
      insert into public.family_invites (
        family_id,
        code,
        invited_email,
        role,
        created_by_user_id,
        expires_at
      )
      values (
        p_family_id,
        new_code,
        normalized_email,
        normalized_role,
        current_user_id,
        new_expires_at
      );

      return query select new_code, new_expires_at;
      return;
    exception
      when unique_violation then
        -- Try another code.
    end;
  end loop;
end;
$$;

drop function if exists public.create_family_invite(uuid, text);
revoke all on function public.create_family_invite(uuid, text, text) from public;
grant execute on function public.create_family_invite(uuid, text, text) to authenticated;

create or replace function public.get_family_invite_preview(p_code text)
returns table (
  invited_email text,
  invite_expires_at timestamptz,
  is_available boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
begin
  return query
  select
    fi.invited_email,
    fi.expires_at,
    fi.used_at is null and fi.expires_at > now()
  from public.family_invites fi
  where fi.code = normalized_code
  limit 1;
end;
$$;

revoke all on function public.get_family_invite_preview(text) from public;
grant execute on function public.get_family_invite_preview(text) to anon, authenticated;

create or replace function public.join_family_with_invite(p_code text)
returns table (joined_family_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  normalized_code text := upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
  invite_record public.family_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select lower(email)
  into current_email
  from auth.users
  where id = current_user_id;

  if current_email is null then
    raise exception 'user_email_not_found';
  end if;

  if exists (
    select 1
    from public.family_members
    where user_id = current_user_id
  ) then
    raise exception 'user_already_has_family';
  end if;

  select *
  into invite_record
  from public.family_invites
  where code = normalized_code
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invalid_invite';
  end if;

  if invite_record.invited_email is null or lower(invite_record.invited_email) <> current_email then
    raise exception 'email_mismatch';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (invite_record.family_id, current_user_id, invite_record.role);

  update public.family_invites
  set used_by_user_id = current_user_id,
      used_at = now()
  where id = invite_record.id;

  return query select invite_record.family_id;
end;
$$;

revoke all on function public.join_family_with_invite(text) from public;
grant execute on function public.join_family_with_invite(text) to authenticated;
