# Bitacora

## 2026-06-27 — M0: permisos combinados (avisos + mic) y reuso de stream
* El botón "Activar" ahora pide en un mismo gesto **notificaciones + micrófono** (mic primero, para no perder el user-gesture tras los awaits).
* `src/lib/mic.ts`: singleton que **reusa** el stream del mic y lo mutea entre grabaciones (`track.enabled`), en vez de soltarlo. Evita el re-prompt en cada grabación dentro de una sesión.
* Flag `localStorage("perms-activated")` para no depender de consultar el estado del permiso de mic (poco confiable en iOS).
* Honesto: la persistencia ENTRE aperturas depende del SO (PWA instalada en iOS la recuerda mejor que Safari); el código solo evita re-pedir dentro de la sesión.

## 2026-06-27 — Alarmas que suenan: PWA + Web Push + Alexa (v0 opción B)

### Avance
* Las alarmas dejaron de ser solo un horario en pantalla: ahora se despachan.
* **Scheduler** (`pg_cron` + `pg_net`): cada minuto Postgres llama a `/api/reminders/dispatch` con un header secreto leído de Supabase Vault. Migración `20260627120000_reminders_cron.sql`.
* **Dispatcher** (`app/api/reminders/dispatch/route.ts`): cliente service-role (salta RLS), busca reminders `scheduled` vencidos, envía a los canales y marca `sent`/`failed`.
* **Canal Web Push (PWA)**: `app/manifest.ts` + íconos, service worker `public/sw.js`, componente `PushSetup` (registra SW, pide permiso, suscribe), tabla `push_subscriptions` (RLS), route `/api/push/subscribe`, helper `src/lib/push.ts`. Reminders pasan a `channel: "web_push"`.
* **Plan B sin dependencias**: la red de MeLi (VPN/DNS + fury con policy) bloqueaba instalar `web-push`. Se reescribió `src/lib/push.ts` con `node:crypto` puro — VAPID JWT (ES256) + cifrado aes128gcm (RFC 8291/8188). Cero deps, funciona también en Vercel. Verificado con test de ida-y-vuelta del cifrado + firma/verificación del JWT (ambos OK).
* **Canal Alexa**: helper `src/lib/voicemonkey.ts` (anuncio por voz, best-effort).
* Decisión: se **descartó** app nativa iOS (AlarmKit) — costo/stack no justificado para v0. Se eligió B (push real al celu, que es notificación) + Alexa.
* M0 (micrófono) **diferido**: probablemente la PWA persista el permiso sola; se re-evalúa tras instalar.

### Conceptos trabajados
* **Estados de permiso** del navegador (`granted`/`denied`/`prompt`) y por qué "Permitir esta vez" deja el re-prompt.
* **Service worker**: script en background que recibe el push aun con la app cerrada.
* **Web Push / VAPID**: par de claves que firma los push; la pública también la usa el cliente al suscribirse.
* **service-role vs RLS**: por qué el cron necesita un cliente que saltea RLS (no hay usuario logueado).
* **pg_cron / pg_net**: Postgres como scheduler + cliente HTTP; secretos en Vault, no en git.
* Límite de plataforma: en iOS el push exige PWA instalada; no existe API pública para alarma nativa de Alexa.

### Validacion tecnica
* `npx tsc --noEmit`: limpio (exit 0). `eslint` de todos los archivos tocados: 0 problemas.
* Test del cifrado push (round-trip) y del JWT VAPID: ambos OK.
* Pendiente de Guido: env vars, `supabase db push`, secrets de Vault, instalar PWA, cuenta Voice Monkey. Todo en `ALARMAS_SETUP.md`. (Ya no hay dependencias que instalar.)

## 2026-06-25 — PRD actualizado con flujo de acceso

### Avance

* Se valido en Supabase remoto que existen `invited_email`, `create_family_invite(...)`, `get_family_invite_preview(...)` y `join_family_with_invite(...)`.
* Se ajusto `/invite/[code]` para mostrar error si el usuario logueado no coincide con el email invitado.
* Se agrego al PRD un diagrama de flujo de login, registro, onboarding e invitacion familiar.
* Se actualizo el PRD para reemplazar el modelo viejo de seed manual por onboarding + invitacion ligada a email.

### Conceptos trabajados

* Diferencia entre flujo principal y fallback.
* Por que el link de invitacion no debe ser un codigo generico.
* Como una ruta dinamica de Next (`/invite/[code]`) permite llevar estado por URL.

### Validacion tecnica

* `npm run lint` paso correctamente.
* `npm run build` paso correctamente.

## 2026-06-25 — Design system dark-candy + nav voice-first (UI Hoy)

### Avance

* Se definio el sistema de diseno: tema dark-only, estetica "playful candy", regla 60-30-10. Tokens en `app/globals.css` (superficies, texto, categorias sleep/feed/diaper, marca, semantico danger, radios).
* Tipografia Nunito; pantalla Hoy reestilizada consumiendo tokens; login adaptado.
* Nav voice-first: pill flotante con acciones manuales (Panal/Toma/Duda) + boton de voz SEPARADO a la derecha (thumb zone), chip candy con glow + un toque mas de tamano (variante "Mix V2+V3", 50px).
* Se itero el diseno del nav en un mockup standalone `public/nav-explorations.html` (sin tocar React) para comparar variantes.
* Se documento todo en el PRD seccion 16.5.

### Conceptos trabajados

* Regla 60-30-10 y "color como informacion" (cada actividad tiene su color con un trabajo).
* Tokens como contrato: cambiar un valor en un lugar actualiza todo (lo probo `page.tsx`, que se volvio dark sin tocarlo).
* Dark mode real: elevacion con luz (no sombra), cards de color como tint y no relleno, texto off-white (no blanco puro), `color-scheme: dark` para controles nativos.
* Thumb zone (zona del pulgar) como criterio de ubicacion del boton principal.
* Riesgo de dos sesiones (Claude + Codex) editando el mismo archivo sin commits: un edit fallo por pisarse. Mitigacion: commit baseline + branches por workstream.

### Pendiente

* RESUELTO: la `VoiceConfirmationCard` se muestra como bottom-sheet `fixed` (overlay a nivel viewport), ya no dentro de la pill. La logica de guardado de Codex (estados saving/error, onConfirm) quedo intacta.
* ACORDADO: `voice-button.tsx` es de Codex (WS3). La UI (WS1) define posicion/separacion del nav en `today-client`; cambios de tamano/forma del chip se consensuan o se exponen como props, para que no lo editen dos sesiones a la vez.
* Pasar a branches reales (`feat/ui-today`) en vez de trabajar todos sobre `main`.
* Opcional: quitar el label del mic para fidelidad total al mockup aprobado (hoy se mantiene por feedback de estado).

### Validacion tecnica

* `npm run lint` paso correctamente.
* `/preview` responde 200 con el nuevo nav.

## 2026-06-24 — Invitacion para segundo adulto

### Avance

* Se agrego tabla `family_invites` para codigos de invitacion de una familia.
* Se agregaron RPCs `create_family_invite(...)` y `join_family_with_invite(...)`.
* Se agrego pantalla `/family` para generar codigos desde el usuario que ya tiene familia.
* Se agrego pantalla `/join` para que otro usuario se una con codigo.
* Se agrego acceso a invitar desde la pantalla Hoy.
* Se aplico la migracion remota `20260624161000_family_invites.sql`.
* Se creo una segunda iteracion del flujo: invitacion ligada a email, link `/invite/[code]` y codigo manual como fallback.

### Conceptos trabajados

* Diferencia entre compartir una cuenta y compartir una familia.
* Por que madre/padre deben tener usuarios separados pero el mismo `family_id`.
* Por que el codigo de invitacion es de un solo uso y vence.
* Por que una invitacion ligada a email es mas segura que un codigo generico.

### Pendiente

* Aplicar la migracion remota `20260624170000_email_bound_invites.sql`; `supabase db push` y `supabase db query --linked --file ...` quedaron colgados en `Initialising login role...`.
* Probar con el usuario `guido.siragusa@gmail.com`: `/family` -> ingresar email de la madre -> generar link.
* Crear cuenta de la madre y probar `/invite/[code]`.
* Decidir si en alfa el link se comparte manualmente o si mas adelante se envia por email/WhatsApp.

## 2026-06-24 — Onboarding desde la app

### Avance

* Se agrego pantalla `/signup` para crear usuario con Supabase Auth desde la app.
* Se agrego pantalla `/onboarding` para crear familia y bebe inicial.
* Se agrego la funcion SQL `public.create_initial_family(...)` para resolver el alta inicial sin seed manual.
* Se aplico la migracion remota `20260624160000_create_initial_family_rpc.sql`.
* La home ahora redirige a `/onboarding` cuando el usuario existe pero no tiene `family_members`.

### Conceptos trabajados

* Diferencia entre crear un usuario de Auth y crear datos de dominio.
* Problema huevo-gallina de RLS: no podes ser miembro de una familia que todavia no existe.
* Por que una RPC `security definer` puede ser mas segura que abrir inserts directos en varias tablas.

### Pendiente

* Probar desde la app el flujo completo: `/signup` -> `/onboarding` -> Hoy.
* Definir como se va a sumar el segundo padre/madre: invitacion por codigo o alta manual temporal.
* Revisar si el proyecto Supabase exige confirmacion de email y decidir si conviene desactivarla durante la alfa.

## 2026-06-24 — Supabase remoto conectado

### Avance

* Guido completo `supabase login`, `supabase init`, `supabase link` y `supabase db push`.
* El proyecto quedo linkeado contra Supabase project ref `xqnvzqnyykiyzktkwogl`.
* Se genero `.env.local` local con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
* `npm run check:supabase` valido que la URL y la anon key llegan correctamente al proyecto remoto.

### Conceptos trabajados

* Diferencia entre subir el schema de base de datos y crear datos iniciales.
* Por que las credenciales locales viven en `.env.local` y no se commitean.
* Por que todavia falta seedear `family_members` y `babies` para que el login tenga contexto.

### Pendiente

* Crear usuarios reales en Supabase Auth para madre/padre.
* Editar y ejecutar `supabase/seed.example.sql` con emails reales, familia y bebe inicial.
* Completar `BABY_TEST_PARENT_EMAIL` y `BABY_TEST_PARENT_PASSWORD` en `.env.local` para probar login + seed.
* Probar el loop: login -> guardar panal -> ver Hoy actualizado.

## 2026-06-24 — Preparacion para trabajo paralelo

### Avance

* Se creo `WORKSTREAMS.md` como mapa de coordinacion para sesiones paralelas entre Claude, Codex y Guido.
* Se definieron workstreams para contratos, UI/UX, backend de eventos, grabacion de audio, parser GPT Mini, confirmacion de voz y read model de Hoy.
* Se agrego `src/domain/voice.ts` con el contrato minimo `VoiceParseResult` y los eventos propuestos por voz.
* Se linkeo `WORKSTREAMS.md` desde el README para que futuras sesiones lo lean antes de tocar codigo.

### Conceptos trabajados

* Diferencia entre paralelizar por responsabilidad y duplicar carpetas por agente.
* Que es un contrato compartido entre frontend, backend e IA.
* Por que el endpoint de voz propone datos pero no guarda sin confirmacion.

### Pendiente

* Crear ramas concretas por workstream cuando empiece cada subfeature.
* Validar que Guido puede explicar `VoiceParseResult` antes de implementar el parser real.

## 2026-06-24

### Avance

* Se reviso el PRD desde una mirada de producto y se ajusto el alcance del MVP.
* El MVP queda definido como una alfa compartida para madre/padre, con un unico bebe inicial.
* Se decidio mantener Supabase desde el inicio por necesidad real de uso compartido.
* Se decidio mantener audio real + IA dentro del MVP porque es parte central del valor del producto.
* Se movieron a iteraciones posteriores: sueno, fotos de panales, resumen para consulta medica y notificaciones push/web confiables.
* Se agrego un diagrama tecnico MVP con Next.js, Supabase, OpenAI y servicios de dominio.

### Conceptos trabajados

* Diferencia entre MVP funcional y backlog aspiracional.
* Trade-off entre velocidad de implementacion y deuda futura en autenticacion.
* Separacion entre recordatorio calculado visible y notificacion real confiable.

### Pendiente para decidir antes de codear

* Modelo de acceso inicial: usuarios individuales con familia creada manualmente vs cuenta compartida.
* Decisiones minimas de lactancia, panales y voz.
* Schema inicial de Supabase.
* JSON Schema para extraccion de voz.

## 2026-06-24 — Primer hito tecnico

### Avance

* Se inicializo git dentro del proyecto.
* Se creo scaffold Next.js + TypeScript + Tailwind.
* Se armo layout mobile-only con ancho maximo de telefono.
* Se agrego schema Supabase con familias, miembros, bebe, eventos, dudas y recordatorios.
* Se implemento login minimo con Supabase Auth.
* Se implemento pantalla "Hoy" leyendo datos desde Supabase.
* Se implementaron formularios manuales de panales, lactancia y dudas.
* Se separo logica reusable en `src/domain`, acceso a datos en `src/data` y UI en `src/components`.

### Conceptos trabajados

* Diferencia entre UI, dominio y persistencia.
* Por que el recordatorio de lactancia se calcula desde `startedAt`.
* Por que el acceso compartido necesita `family_members`.

### Pendiente

* Configurar `.env.local` con Supabase real.
* Ejecutar `supabase/schema.sql` y `supabase/seed.example.sql`.
* Hacer checkpoint de comprension antes de avanzar a voz.

### Validacion tecnica

* `npm install` completo usando el registry interno configurado.
* `npm run lint` paso correctamente.
* `npm run build` paso correctamente.

## 2026-06-24 — Preparacion Supabase end-to-end

### Avance

* Se agrego `SUPABASE_SETUP.md` con el paso a paso para crear proyecto, usuarios, schema y seed.
* Se agrego `npm run check:supabase` para validar `.env.local`, credenciales, login, `family_members` y bebe inicial.
* Se documento el setup en `README.md`.
* Se levanto el dev server local para mostrar la pantalla de setup.
* Se instalo Supabase CLI como dev dependency local.
* Se corrio `npx supabase init`.
* Se creo migracion inicial en `supabase/migrations/20260624153000_initial_schema.sql`.

### Pendiente

* Crear proyecto Supabase real.
* Completar `.env.local`.
* Completar `npx supabase login --token ...`.
* Ejecutar `npx supabase link --project-ref xqnvzqnyykiyzktkwogl`.
* Ejecutar `npx supabase db push`.
* Editar y ejecutar `supabase/seed.example.sql`.
* Probar el loop: login -> guardar panal -> ver Hoy actualizado.

## 2026-06-24 — Voz: parser real

### Avance

* Se implemento `POST /api/voice/parse` como primer corte real de voz.
* El endpoint valida sesion, familia, bebe, archivo de audio y limite de 25 MB.
* Se agrego transcripcion server-side con `gpt-4o-mini-transcribe`.
* Se agrego extraccion estructurada con modelo mini configurable y JSON Schema estricto.
* Se conecto el boton de voz de la pantalla Hoy al endpoint real.
* La ruta `/preview` mantiene parser mockeado para revisar UI sin Supabase/OpenAI.
* Por privacidad, el parse no guarda eventos ni transcript en DB todavia.

### Pendiente

* Implementar confirmacion persistente para guardar eventos con `source: "voice"` y `transcript`.
* Implementar edicion real antes de confirmar.
* Decidir si `voice_parse_logs` guarda solo eventos aceptados o tambien descartes anonimizados.

### Validacion tecnica

* `npm run lint` paso correctamente.
* `npx tsc --noEmit` paso correctamente.

## 2026-06-24 — Voz: confirmacion v0

### Avance

* Se agrego `confirmVoiceEventAction(...)` para guardar propuestas de voz confirmadas.
* La v0 guarda panales, lactancias y dudas con `source: "voice"` y `transcript`.
* La lactancia por voz crea tambien reminder cuando viene `reminderOption`.
* La pantalla Hoy llama a la confirmacion real y refresca el resumen despues de guardar.
* `/preview` mantiene confirmacion no-op para no depender de Supabase.

### Pendiente

* Implementar edicion real antes de confirmar.
* Definir soporte de `set_reminder` como evento independiente.
* Decidir politica de `voice_parse_logs` para descartes y errores.
* Probar audios reales con `OPENAI_API_KEY` configurada.

### Validacion tecnica

* `npm run lint` paso correctamente.
* `npx tsc --noEmit` paso correctamente.
* `npm run build` paso correctamente.

## 2026-06-24 — Voz: preparacion para test local

### Avance

* Se agrego `npm run check:voice` para validar Supabase + OpenAI antes de probar audios.
* Se mejoraron los errores visibles del boton de voz para mostrar el mensaje real del backend.
* Se documento el loop de prueba de voz v0 en `README.md`.
* Se verifico que Supabase responde con URL y anon key locales.
* Se confirmo que la app local responde en `http://localhost:3000`.

### Bloqueo actual

* Falta `OPENAI_API_KEY` en `.env.local`; sin esa key el parser de voz no puede transcribir audios reales.

### Validacion tecnica

* `npm run check:supabase` paso para URL y anon key.
* `npm run check:voice` falla correctamente por falta de `OPENAI_API_KEY`.
* `npm run lint` paso correctamente.
* `npx tsc --noEmit` paso correctamente.
* `npm run build` paso correctamente.

## 2026-06-25 — Handoff voz v0

### Avance

* Se confirmo que `OPENAI_API_KEY` esta configurada en `.env.local`.
* Se confirmo que la API key es aceptada por OpenAI y que hay prerequisitos locales para voz.
* Se dejo un handoff completo en `VOICE_V0_HANDOFF.md`.
* El servidor local estaba activo en `http://localhost:3000` al momento del handoff.

### Proxima sesion

* Leer `VOICE_V0_HANDOFF.md`.
* Probar audios reales desde Hoy.
* Ajustar prompt/schema segun errores reales.
* Luego avanzar con edicion antes de confirmar.

## 2026-06-25 — Subida a GitHub + deploy en Vercel

### Avance

* Repo subido a GitHub propio (`gsiragusa91/baby-project`), publico.
* Identidad separada del trabajo: cuenta personal `gsiragusa91` logueada en `gh` (la de MeLi queda intacta), y email de commits con override LOCAL al noreply de GitHub (global con mail MeLi sin tocar).
* Se reescribieron los 9 commits viejos (firmados con mail MeLi) al noreply via `git filter-branch`, antes del primer push. Backup en `refs/original/`.
* App deployada en Vercel via integracion con GitHub: cada `git push` redeploya solo. URL: https://joaco-project.vercel.app
* Login funcionando end-to-end.

### Concepto nuevo aprendido

* Local vs remote en git: el remote (`origin`) es un apodo a la URL de la copia en la nube; el codigo sigue local tambien. Clonar = bajar + conectar; no hace falta re-clonar lo que ya tenes.
* `.env.local` = variables de entorno (config secreta y por-entorno). No se sube: lo bloquea `.gitignore`. Los secretos no viajan con el codigo; cada entorno (Mac local / Vercel / vault de MeLi) tiene su propia copia, inyectada donde corre la app.
* Config local vs global (git y npm): el archivo local del proyecto pisa al global solo en esa carpeta.
* Supabase exige whitelist de Redirect URLs: aunque la app pida el redirect correcto, Supabase solo redirige a URLs autorizadas (si no, manda al Site URL).

### Quedo flojo / para repasar

* Por que `--global` vs local en el email (checkpoint Q3 sin responder).
* El deploy fallo 1ra vez: lockfile apuntaba al registro privado de MeLi (furycloud) -> 403 en Vercel. Fix: `.npmrc` del proyecto con registro publico + repunteo del lockfile. Va a repetirse en cada proyecto personal.

### Pendientes operativos

* Decidir repo publico vs privado.
* Limpiar refs de backup colgando (`backup-pre-rewrite`, `refs/original/`).
* Subir `scripts/check-voice-rows.mjs` (quedo sin commitear).

## 2026-06-25 — Fixes de invitacion + recuperar contrasena

### Avance

* Botones de copiar (link y codigo) en `/family`: nuevo Client Component `src/components/copy-field.tsx` con `navigator.clipboard`, icono que pasa de copiar a check y mensaje "Copiado". Commit `c5052e6`.
* Flujo de recuperar contrasena (no existia): link "Olvide mi contrasena" en `/login`, `/reset` (pide el mail), `/auth/callback` (canjea el codigo por sesion) y `/reset/update` (setea la nueva). Commit `872aa2c`.
* Bug del mail apuntando a `localhost:3000` y mensaje rojo confuso tras el signup: se resolvio apagando "Confirm email" en el dashboard de Supabase (no era codigo). Ahora `signUp` devuelve sesion al instante y no se manda mail.
* Se ignoro `tsconfig.tsbuildinfo` (artefacto de build que generaba `tsc`).

### Conceptos trabajados

* Server vs Client Components: el portapapeles necesita el navegador (`onClick`, `useState`, `navigator.clipboard`), asi que vive en un archivo aparte con `"use client"`. El Server Component arma los datos y se los pasa por props.
* `config.toml` (Supabase local) NO controla la app deployada: el proyecto hosteado se configura solo desde el dashboard web. Dos mundos distintos.
* El whitelist de Redirect URLs aplica a TODOS los mails (confirmacion Y recovery): apagar la confirmacion no arregla el Site URL; cualquier mail que mande Supabase sigue cayendo a localhost hasta arreglar la config.
* Flujo de reset en 3 pasos: pedir (token por mail) -> canjear (`exchangeCodeForSession`) -> setear (`updateUser`). El token de un solo uso prueba que controlas la casilla sin saber la contrasena.
* Anti email-enumeration: el endpoint de reset responde siempre lo mismo exista o no la cuenta.

### Validacion tecnica

* `npx tsc --noEmit` paso en ambos cambios.
* `npx next build` paso; aparecen las rutas `/auth/callback`, `/reset`, `/reset/update`.

### Quedo flojo / para repasar

* Checkpoint del Client Component sin responder (por que necesita `"use client"`, que pasa sin el `setTimeout`, quien calcula el `value`).
* Limitacion PKCE del recovery: el link del mail debe abrirse en el MISMO navegador donde se pidio. Si molesta, migrar a `token_hash` (requiere editar template del mail).

### Pendientes operativos

* Dashboard Supabase: poner Site URL = `https://joaco-project.vercel.app` y Redirect URL `https://joaco-project.vercel.app/**` (sin esto el recovery manda a localhost).
* Borrar usuario `dalubeche@gmail.com` y re-invitar para destrabar el acceso.
