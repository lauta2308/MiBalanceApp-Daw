# ADR-003: Conexión directa a la base para las pruebas de `pruebas/`

| Field | Value |
|-------|-------|
| Date | 2026-10-26 |
| Ticket | FEAT-001a |
| Status | Accepted |

## Context
Varias pruebas del Block 2 de `spec-FEAT-001a.md` necesitan lo que la API de Supabase (PostgREST) no
expone: `pg_trigger` (E2-10), `information_schema` (AC-55), los privilegios de los roles (R2, R4) y
el esquema `pruebas` con la falla simulada (ADR-002, AC-57). La spec preveía hacerlo "con service
role", pero la service role solo llega a lo que expone la API.

## Options considered

### Option 1: conexión directa con `pg` como `postgres`, por el pooler
- **Pros:** llega a todo lo que las pruebas necesitan verificar; el esquema `pruebas` sigue sin acceso para ningún rol de la API.
- **Cons:** suma la dependencia de desarrollo `pg` y una credencial de máximo privilegio (`SUPABASE_DB_PASSWORD`).

### Option 2: exponer funciones de diagnóstico por RPC para la service role
- **Pros:** no hace falta la contraseña de la base.
- **Cons:** agrega a producción funciones que solo usan las pruebas y abre el esquema `pruebas` a un rol de la API.

## Decision
Option 1. Las pruebas usan `pg` contra la URL del pooler de `supabase/.temp/pooler-url` (la crea
`npx supabase link`) con `SUPABASE_DB_PASSWORD`, que vive solo en `.env.pruebas.local`. La conexión
verifica el certificado contra la CA pública de Supabase (`supabase/certificados/prod-ca-2021.crt`),
nunca con `rejectUnauthorized: false`. Esto precisa ADR-002: la tabla de fallas simuladas la escribe
esta conexión directa, no la service role, que no tiene ningún permiso sobre el esquema `pruebas`.

## Consequences
- `pruebas/utilidades/clientesPrueba.js` abre la conexión; `.env.example` documenta la variable y el `supabase link`.
- La service role conserva solo los permisos de tabla que usan las pruebas para cargar datos.
- Activo nuevo para el threat model de FEAT-001a: la contraseña de la base (credencial, solo local, TLS verificado). Se suma al threat model en la próxima revisión de PLAN de este proyecto.
- Correr `pruebas/` exige haber vinculado la CLI al proyecto.

## Actualización FEAT-001b (2026-10-27)
- Usos nuevos de la conexión directa, además de los de FEAT-001a: `EliminarCategoriaPrueba` hace DML
  sobre `public.bat_categorias`, porque la service role no tiene DELETE sobre esa tabla; las pruebas de
  edición (`pruebas/edicion.test.js`) la usan para activar el punto de falla `EDITAR_MOVIMIENTO` y
  para leer `creado_en` antes y después de editar.
- La contraseña de la base ya figura como activo en `docs/daw/security/threat-FEAT-001b.md` (R9):
  credencial, solo en `.env.pruebas.local`, en tránsito con TLS verificado.
