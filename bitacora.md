# Bitacora

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
