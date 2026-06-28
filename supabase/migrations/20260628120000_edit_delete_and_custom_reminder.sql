-- Edición/borrado de registros del timeline + recordatorios de tiempo libre.
--
-- Contexto: hasta acá las tablas de eventos solo permitían SELECT e INSERT, así
-- que aunque el frontend mandara un update/delete, RLS lo rechazaba. Y los
-- recordatorios estaban limitados a presets (2h/2h30/3h). Esta migración:
--   1) permite reminder_option = 'custom' (alarma con hora exacta arbitraria),
--   2) agrega políticas UPDATE/DELETE para que la familia edite y borre.

-- 1) Permitir reminder_option = 'custom'.
--    La constraint original es inline y Postgres la nombró
--    feeding_events_reminder_option_check.
alter table public.feeding_events
  drop constraint if exists feeding_events_reminder_option_check;

alter table public.feeding_events
  add constraint feeding_events_reminder_option_check
  check (
    reminder_option is null
    or reminder_option in ('2h', '2h30', '3h', 'none', 'custom')
  );

-- 2) Políticas de edición y borrado.
--    Mismo criterio que las de insert: cualquier miembro de la familia puede
--    operar sobre los eventos de su familia.

-- diaper_events
drop policy if exists "Members can update diaper events" on public.diaper_events;
create policy "Members can update diaper events"
on public.diaper_events for update
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

drop policy if exists "Members can delete diaper events" on public.diaper_events;
create policy "Members can delete diaper events"
on public.diaper_events for delete
using (public.is_family_member(family_id));

-- feeding_events
drop policy if exists "Members can update feeding events" on public.feeding_events;
create policy "Members can update feeding events"
on public.feeding_events for update
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

drop policy if exists "Members can delete feeding events" on public.feeding_events;
create policy "Members can delete feeding events"
on public.feeding_events for delete
using (public.is_family_member(family_id));

-- questions (ya tenía update para marcar respondida; falta delete)
drop policy if exists "Members can delete questions" on public.questions;
create policy "Members can delete questions"
on public.questions for delete
using (public.is_family_member(family_id));

-- reminders (necesario para sincronizar/borrar alarmas al editar o borrar una toma)
drop policy if exists "Members can update reminders" on public.reminders;
create policy "Members can update reminders"
on public.reminders for update
using (public.is_family_member(family_id))
with check (public.is_family_member(family_id));

drop policy if exists "Members can delete reminders" on public.reminders;
create policy "Members can delete reminders"
on public.reminders for delete
using (public.is_family_member(family_id));
