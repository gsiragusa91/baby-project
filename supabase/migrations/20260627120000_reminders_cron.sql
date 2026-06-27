-- ============================================================================
-- Scheduler de recordatorios (M1)
--
-- Idea: Postgres puede ejecutar tareas en el tiempo (pg_cron) y hacer requests
-- HTTP salientes (pg_net). Combinándolos, cada minuto Postgres llama al endpoint
-- /api/reminders/dispatch de la app, que despacha los recordatorios vencidos.
--
-- La URL del endpoint y el secreto del cron NO se hardcodean acá (cambian por
-- entorno y el secreto no debe vivir en git). Se leen de Supabase Vault.
--
-- ⚠️ ANTES de que esto funcione, hay que crear los 2 secrets en Vault (una vez):
--
--   select vault.create_secret('https://TU-APP.vercel.app/api/reminders/dispatch', 'dispatch_url');
--   select vault.create_secret('UN-SECRETO-LARGO-Y-RANDOM',                         'cron_secret');
--
--   (el mismo 'cron_secret' tiene que estar en la env var CRON_SECRET de la app)
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Si ya existía el job (por re-correr la migración), lo sacamos para no duplicar.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'dispatch-reminders') then
    perform cron.unschedule('dispatch-reminders');
  end if;
end $$;

-- Cada minuto: POST al endpoint con el secreto en el header.
-- pg_net es asíncrono: encola el request y sigue; no bloquea la transacción.
select cron.schedule(
  'dispatch-reminders',
  '* * * * *',
  $cron$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'dispatch_url'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'cron_secret'
        )
      ),
      body := '{}'::jsonb
    );
  $cron$
);
