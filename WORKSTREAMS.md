# Workstreams — trabajo paralelo

Este documento es el mapa para trabajar en varias sesiones en paralelo sin que Claude, Codex o Guido se pisen entre si.

La regla principal: paralelizamos por responsabilidad real, no por copias del proyecto. No crear carpetas tipo `ui-version/`, `backend-version/` o `voice-version/`. Todas las sesiones trabajan sobre el mismo producto, idealmente en ramas distintas.

## Principio de integracion

Antes de empezar una subfeature, cada sesion tiene que saber tres cosas:

1. Que contrato consume.
2. Que contrato produce.
3. Que archivos puede tocar.

Si una sesion necesita cambiar un contrato compartido, debe frenar y proponer el cambio antes de avanzar.

## Contratos compartidos

Los contratos son las piezas que conectan workstreams. Son mas estables que la UI y que la implementacion interna.

Archivos compartidos:

- `src/domain/types.ts`
- `src/domain/schemas.ts`
- `src/domain/voice.ts`
- `src/domain/reminders.ts`
- `supabase/schema.sql`

Reglas:

- No cambiar `supabase/schema.sql` desde una sesion de UI.
- No cambiar tipos compartidos como solucion rapida a un error local.
- Si cambia `src/domain/voice.ts`, revisar las sesiones de audio, parser y confirmacion.
- Si cambia el modelo de DB, revisar backend, resumen de Hoy y parser de voz.

## Workstream 0 — Core contracts

Objetivo: definir los contratos minimos que las demas sesiones usan.

Branch sugerida:

```bash
git switch -c feat/core-contracts
```

Puede tocar:

- `src/domain/types.ts`
- `src/domain/schemas.ts`
- `src/domain/voice.ts`
- `src/domain/reminders.ts`
- `WORKSTREAMS.md`

No deberia tocar:

- UI visual.
- Endpoints concretos.
- Integracion OpenAI.
- SQL salvo que el contrato lo exija.

Entregable:

- Tipos claros.
- Schemas o contratos documentados.
- Ejemplos de payload cuando ayuden a integrar.

## Workstream 1 — UI/UX Hoy

Objetivo: mejorar la experiencia mobile-first de la pantalla principal y formularios manuales.

Branch sugerida:

```bash
git switch -c feat/ui-today
```

Puede tocar:

- `src/components/*`
- `app/globals.css`
- `app/page.tsx` solo si es wiring de UI.

No deberia tocar:

- `supabase/schema.sql`
- `app/actions.ts`
- `app/api/*`
- `src/server/*`
- OpenAI.

Contrato que consume:

- `TodaySummary` desde `src/domain/types.ts`.
- Labels desde `src/domain/labels.ts`.

Entregable:

- Pantalla usable con datos actuales o mocks locales.
- Estados claros para vacio, cargando y error si aplica.
- `npm run lint` sin errores.

## Workstream 2 — Backend eventos

Objetivo: ordenar y robustecer la creacion de eventos manuales y preparar reutilizacion para eventos de voz.

Branch sugerida:

```bash
git switch -c feat/backend-events
```

Puede tocar:

- `app/actions.ts`
- `src/data/*`
- `src/domain/schemas.ts`
- nuevos helpers como `src/data/events.ts`

No deberia tocar:

- UI visual salvo wiring minimo.
- OpenAI.
- Captura de audio.

Contrato que produce:

- Funciones o actions para guardar pañal, lactancia y duda.
- La misma logica debe poder ser llamada por eventos manuales y por confirmacion de voz.

Regla importante:

- Si se guarda un evento interpretado por voz, debe persistir `source: "voice"` y `transcript`.

Entregable:

- Eventos manuales siguen funcionando.
- Logica de guardado con menos duplicacion.
- `npm run lint` sin errores.

## Workstream 3 — Audio recorder

Objetivo: capturar audio desde la web app y enviarlo al backend.

Branch sugerida:

```bash
git switch -c feat/audio-recorder
```

Puede tocar:

- `src/components/voice-recorder.tsx`
- `src/components/*` para integrar el boton.
- `app/globals.css` si necesita estilos.

No deberia tocar:

- OpenAI.
- `supabase/schema.sql`.
- Guardado final de eventos.

Contrato que produce:

- Un `File` o `Blob` de audio enviado como `FormData` a `POST /api/voice/parse`.

Contrato que consume:

- Respuesta `VoiceParseResult` desde `src/domain/voice.ts`.

Entregable:

- Boton de grabar.
- Estados: listo, grabando, procesando, error.
- Manejo simple de permisos del navegador.

## Workstream 4 — Voice parser GPT Mini

Objetivo: transcribir audio e interpretar el texto como propuesta estructurada.

Branch sugerida:

```bash
git switch -c feat/voice-parser
```

Puede tocar:

- `app/api/voice/parse/route.ts`
- `src/server/openai/*`
- `src/domain/voice.ts` solo si el contrato necesita ajuste coordinado.

No deberia tocar:

- Guardado final en Supabase.
- UI de confirmacion, salvo ejemplos o mocks.

Contrato que consume:

- Audio en `FormData`.

Contrato que produce:

- `VoiceParseResult`.

Regla importante:

- `POST /api/voice/parse` no guarda eventos finales. Solo devuelve una propuesta y deja `needsConfirmation: true`.

Entregable:

- Endpoint parsea audio.
- Devuelve transcript, intent, confidence y proposedEvent.
- Maneja `unknown` cuando no entiende.

## Workstream 5 — Confirmacion de voz

Objetivo: unir parser + UI + guardado final con revision humana.

Branch sugerida:

```bash
git switch -c feat/voice-confirmation
```

Puede tocar:

- `src/components/voice-confirmation-card.tsx`
- `src/components/*`
- `app/actions.ts` o helper de confirmacion.
- `src/data/events.ts` si ya existe.

No deberia tocar:

- Transcripcion OpenAI.
- Schema SQL salvo necesidad coordinada.

Contrato que consume:

- `VoiceParseResult`.
- Helpers/actions de guardado de eventos.

Contrato que produce:

- Evento final persistido con `source: "voice"`.
- `voice_parse_logs.accepted`, `discarded` o `corrected` actualizado si se implementa logging.

Regla importante:

- Ningun evento interpretado por IA se guarda sin confirmacion del usuario.

Entregable:

- Tarjeta de confirmacion.
- Editar antes de guardar.
- Confirmar o descartar.
- Revalidar pantalla Hoy.

## Workstream 6 — Read model Hoy

Objetivo: asegurar que todo lo guardado se vea correctamente en la pantalla principal.

Branch sugerida:

```bash
git switch -c feat/today-read-model
```

Puede tocar:

- `src/data/today.ts`
- `src/domain/types.ts`
- `src/domain/labels.ts`

No deberia tocar:

- UI visual compleja.
- OpenAI.
- Captura de audio.
- Guardado de eventos.

Contrato que produce:

- `TodaySummary` consistente para la UI.

Entregable:

- Timeline unificado.
- Ultima toma, ultimo pañal, proximo recordatorio y dudas pendientes correctas.

## Secuencia recomendada

Orden sano para avanzar:

1. Core contracts.
2. UI/UX Hoy, Backend eventos y Voice parser en paralelo.
3. Audio recorder en paralelo o despues de tener el contrato de parser.
4. Confirmacion de voz.
5. Read model Hoy y pulido final.

No conviene dejar pasar muchos dias sin integrar. Mejor hacer subfeatures chicas y mergearlas rapido.

## Protocolo antes de abrir una nueva sesion

Copiar este bloque al iniciar una sesion nueva:

```text
Estoy trabajando en Baby's Project.
Lee README.md, PRD.md y WORKSTREAMS.md antes de tocar codigo.
Workstream: <nombre>
Branch: <branch>
Archivos permitidos: <lista>
Archivos que no deberias tocar: <lista>
Contrato que consumis: <tipo/schema/endpoint>
Contrato que produces: <tipo/schema/endpoint>
Antes de editar, explicame en 5 lineas que vas a hacer.
Al cerrar, corre npm run lint y deja un resumen de cambios.
Si necesitas cambiar un contrato compartido, frena y proponelo primero.
```

## Protocolo de integracion

Antes de mergear una branch:

1. Revisar `git diff`.
2. Confirmar que no toca archivos fuera de su workstream.
3. Correr `npm run lint`.
4. Si cambio un contrato compartido, revisar workstreams dependientes.
5. Agregar una nota breve en `bitacora.md`.

## Mini-checkpoint de aprendizaje

Despues de cerrar una subfeature, Guido deberia poder responder:

1. Que contrato consumia esta sesion?
2. Que contrato produjo?
3. Que archivo compartido hubiera sido riesgoso tocar?
4. Como se integra esto con la siguiente subfeature?
