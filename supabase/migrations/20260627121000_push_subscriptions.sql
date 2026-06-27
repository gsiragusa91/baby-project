-- ============================================================================
-- Suscripciones de Web Push (M2)
--
-- Cuando el navegador acepta notificaciones, genera una "subscription": una URL
-- única (endpoint) + dos claves (p256dh, auth) con las que el servidor cifra y
-- entrega el push. Guardamos una fila por dispositivo/navegador.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_family_idx
  on public.push_subscriptions(family_id);

alter table public.push_subscriptions enable row level security;

-- Mismo criterio que el resto: solo miembros de la familia, y cada uno opera
-- sobre sus propias suscripciones. El dispatcher usa service-role, que igual
-- saltea RLS, así que estas policies son para el flujo del usuario.
drop policy if exists "Members can read push subscriptions" on public.push_subscriptions;
create policy "Members can read push subscriptions"
on public.push_subscriptions for select
using (public.is_family_member(family_id));

drop policy if exists "Members can insert push subscriptions" on public.push_subscriptions;
create policy "Members can insert push subscriptions"
on public.push_subscriptions for insert
with check (public.is_family_member(family_id) and user_id = auth.uid());

drop policy if exists "Members can update push subscriptions" on public.push_subscriptions;
create policy "Members can update push subscriptions"
on public.push_subscriptions for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Members can delete push subscriptions" on public.push_subscriptions;
create policy "Members can delete push subscriptions"
on public.push_subscriptions for delete
using (user_id = auth.uid());
