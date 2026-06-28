create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('parent', 'caregiver', 'viewer')),
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  code text not null unique,
  invited_email text not null,
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

create table if not exists public.babies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  birth_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.diaper_events (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  event_time timestamptz not null,
  diaper_type text not null check (diaper_type in ('pee', 'poop', 'pee_poop', 'dry')),
  comment text,
  photo_url text,
  abnormal_flag boolean not null default false,
  source text not null check (source in ('manual', 'voice')),
  transcript text
);

create table if not exists public.feeding_events (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  started_at timestamptz not null,
  ended_at timestamptz,
  left_breast_used boolean,
  right_breast_used boolean,
  left_breast_minutes integer check (left_breast_minutes is null or left_breast_minutes >= 0),
  right_breast_minutes integer check (right_breast_minutes is null or right_breast_minutes >= 0),
  notes text,
  reminder_option text check (reminder_option is null or reminder_option in ('2h', '2h30', '3h', 'none', 'custom')),
  reminder_at timestamptz,
  source text not null check (source in ('manual', 'voice')),
  transcript text
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  text text not null,
  category text not null check (
    category in (
      'feeding',
      'diaper',
      'sleep',
      'weight',
      'skin',
      'umbilical_cord',
      'medication',
      'other'
    )
  ),
  professional text not null check (
    professional in (
      'pediatrician',
      'neonatologist',
      'lactation_consultant',
      'other'
    )
  ),
  status text not null check (status in ('pending', 'answered')),
  priority text not null check (priority in ('normal', 'next_visit', 'urgent')),
  answer text,
  source text not null check (source in ('manual', 'voice')),
  transcript text
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  related_event_type text not null check (related_event_type in ('feeding', 'sleep', 'other')),
  related_event_id uuid,
  remind_at timestamptz not null,
  status text not null check (status in ('scheduled', 'sent', 'cancelled', 'failed')),
  channel text not null check (channel in ('web_push', 'native_local', 'none'))
);

create table if not exists public.voice_parse_logs (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  transcript text not null,
  detected_intent text not null,
  confidence numeric,
  accepted boolean not null default false,
  discarded boolean not null default false,
  corrected boolean not null default false,
  error text
);

create index if not exists babies_family_id_idx on public.babies(family_id);
create index if not exists family_invites_family_id_idx on public.family_invites(family_id);
create index if not exists family_invites_code_idx on public.family_invites(code);
create index if not exists family_invites_invited_email_idx on public.family_invites(invited_email);
create index if not exists diaper_events_baby_time_idx on public.diaper_events(baby_id, event_time desc);
create index if not exists feeding_events_baby_started_idx on public.feeding_events(baby_id, started_at desc);
create index if not exists questions_baby_status_idx on public.questions(baby_id, status, created_at desc);
create index if not exists reminders_baby_status_time_idx on public.reminders(baby_id, status, remind_at asc);

create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = target_family_id
      and user_id = auth.uid()
  );
$$;

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

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.babies enable row level security;
alter table public.diaper_events enable row level security;
alter table public.feeding_events enable row level security;
alter table public.questions enable row level security;
alter table public.reminders enable row level security;
alter table public.voice_parse_logs enable row level security;

drop policy if exists "Members can read family" on public.families;
create policy "Members can read family"
on public.families for select
using (public.is_family_member(id));

drop policy if exists "Members can read family members" on public.family_members;
create policy "Members can read family members"
on public.family_members for select
using (public.is_family_member(family_id));

drop policy if exists "Members can read family invites" on public.family_invites;
create policy "Members can read family invites"
on public.family_invites for select
using (public.is_family_member(family_id));

drop policy if exists "Members can read babies" on public.babies;
create policy "Members can read babies"
on public.babies for select
using (public.is_family_member(family_id));

drop policy if exists "Members can read diaper events" on public.diaper_events;
create policy "Members can read diaper events"
on public.diaper_events for select
using (public.is_family_member(family_id));

drop policy if exists "Members can insert diaper events" on public.diaper_events;
create policy "Members can insert diaper events"
on public.diaper_events for insert
with check (public.is_family_member(family_id) and created_by_user_id = auth.uid());

drop policy if exists "Members can read feeding events" on public.feeding_events;
create policy "Members can read feeding events"
on public.feeding_events for select
using (public.is_family_member(family_id));

drop policy if exists "Members can insert feeding events" on public.feeding_events;
create policy "Members can insert feeding events"
on public.feeding_events for insert
with check (public.is_family_member(family_id) and created_by_user_id = auth.uid());

drop policy if exists "Members can update diaper events" on public.diaper_events;
create policy "Members can update diaper events"
on public.diaper_events for update
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

drop policy if exists "Members can delete diaper events" on public.diaper_events;
create policy "Members can delete diaper events"
on public.diaper_events for delete
using (public.is_family_member(family_id));

drop policy if exists "Members can update feeding events" on public.feeding_events;
create policy "Members can update feeding events"
on public.feeding_events for update
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

drop policy if exists "Members can delete feeding events" on public.feeding_events;
create policy "Members can delete feeding events"
on public.feeding_events for delete
using (public.is_family_member(family_id));

drop policy if exists "Members can read questions" on public.questions;
create policy "Members can read questions"
on public.questions for select
using (public.is_family_member(family_id));

drop policy if exists "Members can insert questions" on public.questions;
create policy "Members can insert questions"
on public.questions for insert
with check (public.is_family_member(family_id) and created_by_user_id = auth.uid());

drop policy if exists "Members can update questions" on public.questions;
create policy "Members can update questions"
on public.questions for update
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

drop policy if exists "Members can delete questions" on public.questions;
create policy "Members can delete questions"
on public.questions for delete
using (public.is_family_member(family_id));

drop policy if exists "Members can read reminders" on public.reminders;
create policy "Members can read reminders"
on public.reminders for select
using (public.is_family_member(family_id));

drop policy if exists "Members can insert reminders" on public.reminders;
create policy "Members can insert reminders"
on public.reminders for insert
with check (public.is_family_member(family_id) and created_by_user_id = auth.uid());

drop policy if exists "Members can update reminders" on public.reminders;
create policy "Members can update reminders"
on public.reminders for update
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

drop policy if exists "Members can delete reminders" on public.reminders;
create policy "Members can delete reminders"
on public.reminders for delete
using (public.is_family_member(family_id));

drop policy if exists "Members can read voice parse logs" on public.voice_parse_logs;
create policy "Members can read voice parse logs"
on public.voice_parse_logs for select
using (public.is_family_member(family_id));

drop policy if exists "Members can insert voice parse logs" on public.voice_parse_logs;
create policy "Members can insert voice parse logs"
on public.voice_parse_logs for insert
with check (public.is_family_member(family_id) and user_id = auth.uid());
