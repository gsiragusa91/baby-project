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
  reminder_option text check (reminder_option is null or reminder_option in ('2h', '2h30', '3h', 'none')),
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

alter table public.families enable row level security;
alter table public.family_members enable row level security;
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

drop policy if exists "Members can read reminders" on public.reminders;
create policy "Members can read reminders"
on public.reminders for select
using (public.is_family_member(family_id));

drop policy if exists "Members can insert reminders" on public.reminders;
create policy "Members can insert reminders"
on public.reminders for insert
with check (public.is_family_member(family_id) and created_by_user_id = auth.uid());

drop policy if exists "Members can read voice parse logs" on public.voice_parse_logs;
create policy "Members can read voice parse logs"
on public.voice_parse_logs for select
using (public.is_family_member(family_id));

drop policy if exists "Members can insert voice parse logs" on public.voice_parse_logs;
create policy "Members can insert voice parse logs"
on public.voice_parse_logs for insert
with check (public.is_family_member(family_id) and user_id = auth.uid());
