create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  code text not null unique,
  role text not null check (role in ('parent', 'caregiver', 'viewer')),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by_user_id uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  check (
    (used_by_user_id is null and used_at is null)
    or (used_by_user_id is not null and used_at is not null)
  )
);

create index if not exists family_invites_family_id_idx on public.family_invites(family_id);
create index if not exists family_invites_code_idx on public.family_invites(code);

create or replace function public.create_family_invite(
  p_family_id uuid,
  p_role text
)
returns table (invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
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
        role,
        created_by_user_id,
        expires_at
      )
      values (
        p_family_id,
        new_code,
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

revoke all on function public.create_family_invite(uuid, text) from public;
grant execute on function public.create_family_invite(uuid, text) to authenticated;

create or replace function public.join_family_with_invite(p_code text)
returns table (joined_family_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
  invite_record public.family_invites%rowtype;
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

alter table public.family_invites enable row level security;

drop policy if exists "Members can read family invites" on public.family_invites;
create policy "Members can read family invites"
on public.family_invites for select
using (public.is_family_member(family_id));
