-- Fase 4: álbum del bebé. Fotos con fecha (taken_at) para agrupar por semana.
create table if not exists public.baby_photos (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  taken_at timestamptz not null default now(),
  photo_url text not null,
  note text,
  source text not null default 'manual' check (source in ('manual', 'voice'))
);

create index if not exists baby_photos_baby_taken_idx
  on public.baby_photos(baby_id, taken_at desc);

alter table public.baby_photos enable row level security;

drop policy if exists "Members can read baby photos" on public.baby_photos;
create policy "Members can read baby photos"
on public.baby_photos for select
using (public.is_family_member(family_id));

drop policy if exists "Members can insert baby photos" on public.baby_photos;
create policy "Members can insert baby photos"
on public.baby_photos for insert
with check (public.is_family_member(family_id) and created_by_user_id = auth.uid());

drop policy if exists "Members can update baby photos" on public.baby_photos;
create policy "Members can update baby photos"
on public.baby_photos for update
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

drop policy if exists "Members can delete baby photos" on public.baby_photos;
create policy "Members can delete baby photos"
on public.baby_photos for delete
using (public.is_family_member(family_id));
