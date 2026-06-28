-- Fase 3: Supabase Storage para fotos (pañal, duda, álbum) + foto opcional en dudas.
--
-- Bucket PRIVADO (datos sensibles de salud, PRD §10): nunca público, se sirve
-- siempre vía signed URLs generadas server-side.
insert into storage.buckets (id, name, public)
values ('baby-media', 'baby-media', false)
on conflict (id) do nothing;

-- Autorización por path. Cada objeto se guarda como:
--   families/{familyId}/{kind}/{uuid}.{ext}
-- storage.foldername(name) devuelve los segmentos de carpeta (sin el archivo),
-- 1-indexado: [1]=families, [2]={familyId}, [3]={kind}. Gateamos por membresía
-- de familia leyendo el familyId del path con la misma función que el resto de
-- las tablas (public.is_family_member).

drop policy if exists "Family members read baby-media" on storage.objects;
create policy "Family members read baby-media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'baby-media'
  and public.is_family_member((storage.foldername(name))[2]::uuid)
);

drop policy if exists "Family members insert baby-media" on storage.objects;
create policy "Family members insert baby-media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'baby-media'
  and public.is_family_member((storage.foldername(name))[2]::uuid)
);

drop policy if exists "Family members update baby-media" on storage.objects;
create policy "Family members update baby-media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'baby-media'
  and public.is_family_member((storage.foldername(name))[2]::uuid)
);

drop policy if exists "Family members delete baby-media" on storage.objects;
create policy "Family members delete baby-media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'baby-media'
  and public.is_family_member((storage.foldername(name))[2]::uuid)
);

-- Foto opcional en dudas (pañal ya tiene photo_url en su tabla).
alter table public.questions add column if not exists photo_url text;
