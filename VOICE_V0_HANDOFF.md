# Voice V0 handoff

Fecha: 2026-06-25

## Estado actual

La v0 de voz esta lista para test manual local.

Flujo implementado:

```text
Grabar audio en Hoy
-> POST /api/voice/parse
-> transcripcion OpenAI
-> extraccion estructurada
-> tarjeta de confirmacion
-> Confirmar
-> guardar en Supabase
-> refrescar Hoy
```

Eventos que se pueden guardar por voz en esta v0:

- Panal -> `diaper_events`
- Lactancia -> `feeding_events`
- Duda -> `questions`

La lactancia por voz tambien crea un row en `reminders` cuando viene `reminderOption`.

## Ambiente local

`.env.local` tiene:

- `NEXT_PUBLIC_SUPABASE_URL`: seteada
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: seteada
- `OPENAI_API_KEY`: seteada
- `BABY_TEST_PARENT_EMAIL`: no seteada
- `BABY_TEST_PARENT_PASSWORD`: no seteada

`npm run check:voice` pasa:

```text
PASS Supabase URL and anon key are reachable.
PASS OpenAI API key is accepted.
WARN BABY_TEST_PARENT_EMAIL/PASSWORD are not set. Browser testing still works, but automated family checks are skipped.
PASS Local voice prerequisites are ready.
```

Servidor local activo al momento de este handoff:

```text
http://localhost:3000
PID: 50778
```

Si se cambia `.env.local`, reiniciar el server:

```bash
kill 50778
npm run dev
```

## Como probar

1. Abrir:

   ```text
   http://localhost:3000
   ```

2. Loguearse con un usuario que tenga familia y bebe.

3. Desde Hoy, tocar `Grabar`.

4. Probar audios cortos:

   ```text
   Panal pis ahora
   ```

   ```text
   Cambio panal recien, pis y caca
   ```

   ```text
   Arranco lactancia ahora, izquierda doce minutos, alarma en dos horas y media
   ```

   ```text
   Duda para la pediatra: es normal que tenga hipo despues de tomar?
   ```

5. Tocar `Detener`.

6. Revisar la tarjeta.

7. Tocar `Confirmar` si la propuesta sirve.

8. Verificar que Hoy refresca timeline y contadores.

## Archivos clave

- `app/api/voice/parse/route.ts`: endpoint de parse de voz. No guarda eventos finales.
- `src/server/openai/voice.ts`: llamadas server-side a OpenAI para transcripcion y extraccion.
- `src/domain/voice.ts`: contrato `VoiceParseResult` y schema de extraccion.
- `src/components/voice-button.tsx`: captura de audio, estados de grabacion/procesamiento/guardado.
- `src/components/voice-confirmation-card.tsx`: tarjeta de confirmacion.
- `src/components/today-client.tsx`: conecta `VoiceButton` al parser real y a confirmacion.
- `app/actions.ts`: `confirmVoiceEventAction(...)` guarda eventos por voz.
- `scripts/check-voice-local.mjs`: valida prerequisitos locales de voz.
- `README.md`: loop de prueba documentado.
- `bitacora.md`: historial de decisiones y avances.

## Decisiones tomadas

- No se guarda audio original.
- `POST /api/voice/parse` no guarda evento final.
- El transcript se guarda solo cuando el usuario confirma el evento.
- No hay edicion en v0: confirmar o descartar.
- `set_reminder` puede detectarse pero todavia no se guarda como evento independiente.
- `voice_parse_logs` existe en DB, pero todavia no se usa para descartes/errores.

## Pendientes recomendados

1. Probar audios reales desde el browser.
2. Si algun audio falla, mirar logs del dev server y ajustar prompt/schema.
3. Implementar edicion antes de confirmar.
4. Definir politica de `voice_parse_logs`:
   - guardar solo confirmados,
   - guardar descartes,
   - guardar errores anonimizados.
5. Decidir UX para `set_reminder` independiente.
6. Agregar `BABY_TEST_PARENT_EMAIL` y `BABY_TEST_PARENT_PASSWORD` en `.env.local` para automatizar checks de familia/bebe.

## Validaciones corridas

```bash
npm run check:voice
```

Resultado: pasa.

Ultima validacion completa previa:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Resultado: pasaban correctamente.

## Nota de git

El repo esta en `main`. Al momento del handoff habia un diff generado en `next-env.d.ts` por Next dev/build:

```diff
-import "./.next/types/routes.d.ts";
+import "./.next/dev/types/routes.d.ts";
```

Es un archivo generado por Next. Si molesta antes de commit, correr `npm run build` suele volver a dejarlo en modo build.
