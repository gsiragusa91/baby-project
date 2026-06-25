# Supabase Setup

Objetivo: dejar lista la primera tajada vertical real.

```text
Crear cuenta -> crear familia/bebe -> guardar panal -> ver Hoy actualizado
```

## 1. Crear proyecto Supabase

Crear un proyecto nuevo en Supabase y copiar:

- Project URL
- anon public key

Luego crear `.env.local`:

```bash
cp .env.example .env.local
```

Completar:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## 2. Crear tablas y funciones

Hay dos caminos.

### Opcion A — Supabase CLI

Autenticarse:

```bash
npx supabase login --token TU_ACCESS_TOKEN
```

Linkear el proyecto:

```bash
npx supabase link --project-ref xqnvzqnyykiyzktkwogl
```

Aplicar la migracion:

```bash
npx supabase db push
```

La migracion vive en:

```text
supabase/migrations/20260624153000_initial_schema.sql
```

### Opcion B — SQL editor

Abrir el SQL editor de Supabase y ejecutar:

```text
supabase/schema.sql
```

Esto crea las tablas:

- `families`
- `family_members`
- `family_invites`
- `babies`
- `diaper_events`
- `feeding_events`
- `questions`
- `reminders`
- `voice_parse_logs`

Tambien activa RLS y policies basicas por familia.

Tambien crea la funcion segura:

```text
public.create_initial_family(...)
```

Esa funcion permite que un usuario autenticado cree su primera familia, quede
asociado en `family_members` y cree el bebe inicial desde la app.

## 3. Crear usuario, familia y bebe desde la app

Levantar la app:

```bash
npm run dev
```

Abrir:

```text
http://localhost:3000
```

Flujo esperado:

1. Ir a `Crear cuenta`.
2. Completar email y password.
3. Si Supabase exige confirmacion de email, confirmar el email antes de entrar.
4. Completar el onboarding con familia y bebe inicial.
5. Llegar a la pantalla Hoy.

## 4. Sumar a la madre con link

Desde el usuario que ya tiene familia:

1. Entrar a `/family`.
2. Ingresar el email de la madre.
3. Tocar `Generar codigo`.
4. Compartir el link generado.

Desde el usuario de la madre:

1. Abrir el link `/invite/[code]`.
2. Crear cuenta propia o iniciar sesion con el email invitado.
3. Al unirse, deberia llegar a Hoy con el mismo bebe.

Fallback: entrar a `/join` y pegar el codigo manual. El codigo solo funciona
para el email invitado.

## 5. Seed manual opcional

Editar:

```text
supabase/seed.example.sql
```

Reemplazar:

```sql
'madre@example.com', 'padre@example.com'
```

por los emails reales de los usuarios creados.

Tambien se puede cambiar:

```sql
'Familia inicial'
'Bebé'
'2026-06-24'
```

Luego ejecutar ese SQL en Supabase.

Este seed ya no es el camino principal. Queda como fallback tecnico si se quiere
cargar una familia manualmente desde SQL.

## 6. Verificar setup

Para validar solo URL y anon key:

```bash
npm run check:supabase
```

Para validar tambien login, `family_members` y bebe inicial, agregar un usuario
de prueba a `.env.local`:

```bash
BABY_TEST_PARENT_EMAIL=
BABY_TEST_PARENT_PASSWORD=
```

Resultado esperado:

```text
PASS Supabase URL and anon key are reachable.
PASS Signed in test parent: ...
PASS Found family membership with role: parent
PASS Found active baby: ...
```

## 7. Probar la app

Primer loop a probar:

1. Crear cuenta.
2. Crear familia y bebe inicial.
3. Ver pantalla Hoy.
4. Crear panal.
5. Confirmar que aparece en timeline y cambia el contador.
