# Alarmas (PWA + Web Push + Alexa) — Setup y pruebas

Qué se construyó (v0, opción B): los recordatorios de toma ahora **suenan**.
Un scheduler en Supabase (`pg_cron`) llama cada minuto a `/api/reminders/dispatch`,
que despacha cada recordatorio vencido a dos canales:
- **Web Push** → notificación en el iPhone (con la PWA instalada), aunque la app esté cerrada.
- **Alexa** → anuncio por voz en el Echo (vía Voice Monkey).

> ⚠️ Pasos que requieren tu mano (tus cuentas / tu deploy). Hacelos en orden.

---

## 1. Dependencias

**Ninguna que instalar.** El envío de Web Push está implementado con `node:crypto`
(built-in de Node), sin la librería `web-push`. No hay `npm install` que correr para
esto — ni local ni en Vercel. (Decisión tomada porque la red de MeLi bloqueaba el
registro público; ver `src/lib/push.ts`.)

---

## 2. Variables de entorno

Agregá esto al `.env.local` (dev) y a las env vars de tu deploy (Vercel):

```
# Cliente admin (saltea RLS) — la service role key está en Supabase → Settings → API
SUPABASE_SERVICE_ROLE_KEY=...

# Secreto que comparten el cron y el endpoint (inventá uno largo y random)
CRON_SECRET=...

# Claves VAPID para Web Push — los valores REALES están en .env.local (gitignoreado).
# ⚠️ NUNCA pegues la privada en un archivo versionado.
VAPID_PUBLIC_KEY=<ver .env.local>
VAPID_PRIVATE_KEY=<ver .env.local — secreto, no commitear>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<misma que VAPID_PUBLIC_KEY>
VAPID_SUBJECT=mailto:tu-email@ejemplo.com

# Alexa (paso 5). Si no las ponés, el canal Alexa queda apagado sin romper nada.
VOICEMONKEY_TOKEN=...
VOICEMONKEY_DEVICE=...
```

> `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PUBLIC_KEY` son **la misma** clave: la
> pública la usa tanto el cliente (al suscribirse) como el server (al enviar).
> La privada NUNCA va con prefijo `NEXT_PUBLIC_` (eso la expondría al navegador).

---

## 3. Aplicar las migraciones de Supabase

```bash
cd "Baby's Project"
npx supabase db push   # aplica push_subscriptions + reminders_cron
```

Después, **una sola vez**, creá los 2 secrets en Vault (en el SQL Editor de Supabase),
reemplazando la URL por la de tu deploy y el secreto por el mismo `CRON_SECRET` de arriba:

```sql
select vault.create_secret('https://TU-APP.vercel.app/api/reminders/dispatch', 'dispatch_url');
select vault.create_secret('EL-MISMO-CRON_SECRET', 'cron_secret');
```

Verificá que el cron quedó agendado:

```sql
select jobname, schedule, active from cron.job where jobname = 'dispatch-reminders';
```

---

## 4. Deploy + instalar la PWA en el iPhone

1. Deploy a Vercel con todas las env vars.
2. En el iPhone, abrí la URL **en Safari** → Compartir → **Agregar a inicio**.
   (En iOS, instalarla es obligatorio para que funcione Web Push.)
3. Abrí la app desde el ícono → en la pantalla "Hoy" aparece **"Activar avisos en
   este dispositivo"** → Activar → aceptá el permiso.

---

## 5. Conectar Alexa (Voice Monkey)

1. Creá cuenta en https://voicemonkey.io y activá su skill en tu app de Alexa.
2. Vinculá tu Echo siguiendo su flujo (te crea una rutina puente).
3. Copiá tu **token** y el **nombre del device** → ponelos en `VOICEMONKEY_TOKEN`
   y `VOICEMONKEY_DEVICE` (paso 2) y re-deployá.

---

## 6. Probar end-to-end

1. **Scheduler**: registrá una toma con recordatorio corto (o insertá un reminder
   con `remind_at = now() + interval '2 min'`). En ≤ 1 min, el status del reminder
   debería pasar a `sent` (mirá la tabla `reminders` o los logs de la función en Vercel).
2. **Push**: cerrá la app → debería llegar la notificación al iPhone.
3. **Alexa**: el Echo debería anunciar "Recordatorio: es hora de la próxima toma de …".

### Si algo falla
- **No pasa a `sent`**: revisá que el cron exista (paso 3), que los secrets de Vault
  estén bien, y los logs de `net.http_post` (`select * from net._http_response order by created desc limit 5;`).
- **`sent` pero no llega push**: revisá `CRON_SECRET`, las VAPID, y que haya filas en
  `push_subscriptions`. En iOS, el push solo va con la PWA instalada.
- **No habla Alexa**: revisá token/device de Voice Monkey y que el Echo esté online.
  (Es best-effort: si falla, no rompe el push.)

---

## Micrófono (M0, diferido)
Se decidió **no** tocar código del micrófono todavía: al instalar la PWA, el permiso
suele persistir solo. Si después de instalarla sigue pidiéndolo cada vez, avisá y
hacemos el fix chico (detectar estado con la Permissions API + reusar el stream).
