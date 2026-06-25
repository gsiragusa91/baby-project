# Baby's Project

Proyecto personal de aprendizaje para construir una herramienta mobile-first de registro y asistencia para padres/madres primerizos.

El objetivo no es solo tener una app util, sino usarla como proyecto guia para aprender desarrollo web paso a paso.

## Estado actual

Primer hito implementado como base tecnica:

- App Next.js + TypeScript + Tailwind.
- Experiencia mobile-only dentro de un ancho de telefono.
- Supabase Auth preparado para usuarios separados.
- Schema inicial de Supabase en `supabase/schema.sql`.
- Onboarding desde la app para crear cuenta, familia y bebe inicial.
- Invitacion por email/link para que otro adulto se una a la misma familia.
- Seed manual de familia/bebe en `supabase/seed.example.sql` como fallback tecnico.
- Pantalla "Hoy" con resumen desde Supabase.
- Formularios manuales para panal, lactancia y dudas.
- Calculo de recordatorio desde el inicio de lactancia.

## Documentos

- [PRD.md](./PRD.md): definicion inicial del producto, alcance MVP, flujos, modelo de datos y criterios tecnicos.
- [WORKSTREAMS.md](./WORKSTREAMS.md): mapa para trabajar en sesiones paralelas sin pisar contratos ni archivos compartidos.
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md): pasos para conectar Auth, schema, seed y validar el primer loop real.

## Setup local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear `.env.local` desde `.env.example`:

   ```bash
   cp .env.example .env.local
   ```

3. Completar:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   OPENAI_API_KEY=
   ```

4. En Supabase:

   - Ejecutar `npx supabase db push` si usas CLI, o `supabase/schema.sql` desde SQL Editor.

5. Correr la app:

   ```bash
   npm run dev
   ```

6. Abrir desde celular o viewport mobile:

   ```text
   http://localhost:3000
   ```

7. Crear el primer usuario desde la app:

   ```text
   /signup -> /onboarding -> Hoy
   ```

8. Verificar Supabase opcionalmente:

   ```bash
   npm run check:supabase
   ```

9. Verificar prerequisitos de voz:

   ```bash
   npm run check:voice
   ```

## Primer loop a probar

1. Crear cuenta.
2. Crear familia y bebe inicial.
3. Ver pantalla Hoy.
4. Crear panal.
5. Confirmar que aparece en timeline y cambia el contador.

## Loop de voz v0

Requisito: `OPENAI_API_KEY` configurada en `.env.local`.

1. Entrar a Hoy con un usuario que tenga familia y bebe.
2. Tocar `Grabar`.
3. Decir un audio corto, por ejemplo:

   ```text
   Panal pis ahora
   ```

   ```text
   Arranco lactancia ahora, izquierda doce minutos, alarma en dos horas y media
   ```

   ```text
   Duda para la pediatra: es normal que tenga hipo despues de tomar?
   ```

4. Tocar `Detener`.
5. Revisar la tarjeta detectada.
6. Tocar `Confirmar` para guardar o descartar si la interpretacion no sirve.
7. Confirmar que Hoy refresca el timeline y los contadores.

En esta v0 no hay edicion antes de guardar: si algo sale mal, descartar y cargar
manual o repetir el audio.

## Loop de acceso compartido

1. Desde el usuario que ya tiene familia, entrar a `/family`.
2. Ingresar el email de la madre y generar un link de invitacion.
3. La madre abre `/invite/[code]`.
4. Si no tiene cuenta, crea password con ese email; si ya tiene cuenta, inicia sesion.
5. Ambos usuarios ven el mismo bebe y los mismos eventos.

Fallback: si el link falla, la madre puede entrar a `/join` y pegar el codigo
manual. El codigo solo funciona para el email invitado.

## Modo de trabajo

- Construir de a bloques chicos.
- Entender cada pieza antes de escribir la siguiente.
- Priorizar que Guido pueda explicar el codigo con sus palabras.
- Registrar avances y dudas en la bitacora del playground.
- Para trabajo paralelo entre Claude, Codex y Guido, usar `WORKSTREAMS.md` antes de abrir una subfeature.

## Primer checkpoint de aprendizaje

Antes de seguir con voz, Guido deberia poder explicar:

1. Que problema resuelve `family_members`.
2. Por que `reminderAt` se calcula fuera de la UI.
3. Que diferencia hay entre `src/domain`, `src/data` y `src/components`.
4. Por que la app usa Supabase desde el servidor y no llama OpenAI desde el browser.
