# Threat Model FEAT-001a: Cuenta, Saldo, Alta y Lista de Movimientos

| Field | Value |
|-------|-------|
| Ticket | FEAT-001a |
| Spec | docs/daw/specs/spec-FEAT-001a.md |
| PRD | docs/daw/prd/prd-FEAT-001a.md |
| Date | 2026-10-25 |
| Método | STRIDE por componente |

## Componentes analizados

| ID | Componente | Dónde se define |
|---|---|---|
| C1 | SPA React en el navegador (`src/`), incluida la sesión de supabase-js en `localStorage` | Spec Blocks 1, 3–6 |
| C2 | Supabase Auth con inicio de sesión anónimo (`src/sesion/sesionAnonima.js`) | Spec Block 4 |
| C3 | API de datos (PostgREST): vistas `bav_cuenta`, `bav_movimientos` y tabla `bat_categorias` (solo lectura) | Spec Block 2 |
| C4 | RPC `BASP_AGREGAR_MOVIMIENTO` (`SECURITY DEFINER`) | Spec Block 2 |
| C5 | Trigger `BATR_CREAR_CUENTA_USUARIO` / `BATF_CREAR_CUENTA_USUARIO` sobre `auth.users` | Spec Block 2 |
| C6 | Tablas `BAT_CUENTAS`, `BAT_CATEGORIAS`, `BAT_MOVIMIENTOS` con RLS | Spec Block 2 |
| C7 | Esquema `pruebas` y `BAT_FALLAS_SIMULADAS` (ADR-002) | Spec Block 2 |
| C8 | Entorno de pruebas con la service role key (`pruebas/`, `pruebas-navegador/`, scripts SQL) | Spec Blocks 2 y 7 |

## Trust boundaries

| ID | Frontera | De → a | Control |
|---|---|---|---|
| TB1 | Internet | Navegador (no confiable) → Supabase (Auth y PostgREST) | HTTPS (TLS 1.2+), JWT firmado por Supabase, anon key pública |
| TB2 | Rol de base | PostgREST con rol `authenticated` → tablas y vistas | RLS solo SELECT, `REVOKE ALL` + `GRANT SELECT`, vistas `security_invoker` |
| TB3 | Elevación controlada | Rol `authenticated` → `BASP_AGREGAR_MOVIMIENTO` ejecutada como `postgres` | `GRANT EXECUTE` solo a `authenticated`, `search_path = ''`, cuenta desde `auth.uid()`, validación de todos los parámetros |
| TB4 | Registro | `supabase_auth_admin` (INSERT en `auth.users`) → `BATF_CREAR_CUENTA_USUARIO` como `postgres` | Sin parámetros del usuario: solo usa `NEW.id`; `EXECUTE` revocado para los roles de la API |
| TB5 | Entorno de pruebas | Máquina de quien desarrolla con la service role (salta RLS) → proyecto de Supabase | Clave solo en `.env.pruebas.local` (ignorado por git), nunca con prefijo `VITE_` |
| TB6 | Almacenamiento del navegador | Scripts de la página → tokens de sesión en `localStorage` | React escapa el contenido; sin `dangerouslySetInnerHTML` ni `eval` |

## Clasificación de datos

| Dato | Clasificación | En tránsito | En reposo |
|---|---|---|---|
| Montos, saldo, fechas y categorías de movimientos | Financiero (sensible, personal) | TLS (HTTPS de Supabase) | Cifrado de disco AES-256 de Supabase |
| `id` de usuario (uuid, sin email ni nombre: sesión anónima) | Identificador seudónimo | TLS | Cifrado de disco de Supabase |
| JWT de acceso y token de refresco | Credencial | TLS | `localStorage` del navegador (sin cifrar, riesgo R6); en Supabase, cifrado de disco |
| Service role key | Credencial (secreta, máximo privilegio) | TLS | Solo en `.env.pruebas.local` local; nunca en el repo ni en el bundle |
| Anon key y URL del proyecto | Pública por diseño | TLS | En el bundle del navegador |

No hay PII directa en este sub-ticket: el inicio anónimo no pide email ni nombre. Llegará con Google
OAuth (RF-22) y se reevaluará en ese ticket.

## Análisis STRIDE

| Comp. | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| C1 | R6 | R11 | R9 | R6, R11 | — (estático) | R6 |
| C2 | R6 | R12 | R9 | R14 | R7 | R13 |
| C3 | R2 | R2 | R9 | R2, R4 | R8 | R2 |
| C4 | R1 | R3, R10 | R9 | R11 | R8 | R1 |
| C5 | — (solo `NEW.id`) | R15 | R9 | — | R7 | R1 |
| C6 | R2 | R2, R3 | R9 | R2 | R8 | R2 |
| C7 | — | R10 | — | R10 | — | R10 |
| C8 | R5 | R12 | — | R5 | — | R5 |

## Riesgos

| ID | Riesgo | STRIDE | Prob. | Impacto | Mitigación | Estado |
|---|---|---|---|---|---|---|
| R1 | Abuso de las funciones `SECURITY DEFINER`: manipulación del `search_path` o uso de un parámetro para operar sobre otra cuenta | S, E | Baja | Crítico | `SET search_path = ''`, todo calificado, dueño `postgres`, `v_id_cuenta` solo desde `auth.uid()`, categoría validada con `id_cuenta = v_id_cuenta AND tipo = p_tipo`; pruebas AC-53 | Mitigado en spec (Block 2) |
| R2 | Los privilegios por defecto de Supabase dan ALL a `anon` y `authenticated` sobre tablas y vistas nuevas: lectura o escritura de datos ajenos | S, T, I, E | Alta (si no se revoca) | Crítico | `REVOKE ALL` + `GRANT SELECT` a `authenticated`, RLS `FOR SELECT` por propietario; pruebas AC-51, AC-52, AC-54 | Mitigado en spec (Block 2) |
| R3 | Alterar el saldo o los movimientos sin pasar por la función (saldo inconsistente) | T | Media | Alto | Sin permisos de escritura directa; el saldo solo cambia dentro de `BASP_AGREGAR_MOVIMIENTO`; pruebas AC-54, AC-69 | Mitigado en spec (Block 2) |
| R4 | Vistas que leen con los permisos de su dueño y saltan RLS | I | Media | Crítico | `WITH (security_invoker = true)` en `BAV_CUENTA` y `BAV_MOVIMIENTOS`; AC-51 consulta las vistas | Mitigado en spec (Block 2) |
| R5 | Filtración de la service role key (al repo o al bundle) | S, I, E | Baja | Crítico | Sin prefijo `VITE_`; solo en `.env.pruebas.local`, ignorado por `.env*.local`; verificación final sin la clave en `src/`; el escaneo de secretos de SAST en CODE | Mitigado en spec (Blocks 1, 7 y Final verification) |
| R6 | Robo del token de sesión desde `localStorage` por XSS | S, I, E | Baja | Alto | React escapa todo el texto; regla ESLint `react/no-danger` y prohibición de `dangerouslySetInnerHTML`, `innerHTML` y `eval` en `src/` (verificación final); los nombres de categorías se muestran solo como texto | Mitigación nueva → se agrega a la spec (Block 1 y Final verification) |
| R7 | Altas masivas de usuarios anónimos que llenan la base (cada uno crea cuenta y 2 categorías) | D | Media | Medio | Límite de Supabase de ~30 inicios anónimos por hora por IP (activo por defecto); la app no se abre a usuarios reales hasta Google (riesgo del PRD) | Mitigado (configuración de Supabase) |
| R8 | Un usuario autenticado llama al RPC en bucle y carga millones de movimientos (crecimiento de la base, plan gratuito) | D | Baja | Medio | No hay límite por usuario en PostgREST y el PRD no define un tope de movimientos | **Riesgo aceptado** (ver abajo) |
| R9 | No queda registro de quién hizo cada operación | R | Baja | Bajo | Cada movimiento queda atado a `id_cuenta` y `creado_en`; los logs de la API de Supabase registran las llamadas | Mitigado (diseño) |
| R10 | Activar la falla simulada para un usuario o leer la tabla de fallas | T, I, E | Baja | Bajo | Esquema `pruebas` sin `USAGE` para los roles de la API, tabla sin permisos ni políticas; prueba en `pruebas/seguridad.test.js`; aunque se activara, solo aborta la operación propia | Mitigado en spec (Block 2, ADR-002) |
| R11 | Mensajes de error que exponen detalles internos (SQLSTATE, nombres de tablas, trazas) | I | Media | Bajo | Los servicios devuelven `{ ok: false }` y la interfaz muestra textos fijos de `src/mensajes/textos.js`; prueba AC-60 | Mitigado en spec (Blocks 4–6) |
| R12 | El script de limpieza borra usuarios que no son de prueba: `raw_user_meta_data` lo puede editar el propio usuario con `updateUser`, así que alguien podría marcarse `es_prueba` | T | Baja | Medio | Marcar los usuarios de prueba en `app_metadata` (solo la service role puede escribirlo) con `auth.admin.updateUserById`, y que el script filtre `raw_app_meta_data->>'es_prueba' = 'true' AND is_anonymous = true` | Mitigación nueva → se agrega a la spec (Blocks 2 y 7) |
| R13 | Dependencias npm vulnerables o comprometidas | E | Baja | Alto | Versiones estables más recientes, `package-lock.json` commiteado, `npm audit` en SAST | Mitigado (Block 1 y SAST) |
| R14 | La anon key queda visible en el bundle | I | Alta | Bajo | Es pública por diseño; la protección real es RLS y los permisos (R2) | Mitigado (diseño) |
| R15 | El trigger se ejecuta también para usuarios futuros de Google y crea su cuenta | T | Alta | Bajo | Es el comportamiento deseado (RF-04, RF-05); se revisará al incorporar Google | Mitigado (diseño) |

## Riesgo aceptado

**R8 — Carga masiva de movimientos por un usuario autenticado.**
- Quién lo acepta: Lautaro, dueño del proyecto, el 2026-10-25 durante la fase PLAN de FEAT-001a.
- Justificación: el PRD no define un límite de movimientos por usuario; la app no se abre
  a usuarios reales mientras use la sesión anónima; el daño se limita al espacio de la base del
  plan gratuito y no afecta datos de otros usuarios.
- Condiciones de revisión: antes de abrir la app a usuarios reales o al incorporar Google
  OAuth (RF-22), lo que ocurra primero; o si el uso de la base supera el 50% del plan.

## Análisis de dependencias (W-TM-01)

Dependencias nuevas: react, react-dom, react-router, @supabase/supabase-js, react-day-picker,
date-fns (producción) y vite, vitest, Testing Library, Playwright, axe-core, ESLint (desarrollo).
Todas mantenidas activamente; se fijan con `package-lock.json` y se revisan con `npm audit` en SAST
(R13).

## Mitigaciones a incorporar en la spec

1. R6 — `eslint.config.js` con la regla `react/no-danger` en error, y en la verificación final la
   búsqueda de `dangerouslySetInnerHTML`, `innerHTML` y `eval(` en `src/` sin resultados.
2. R12 — Usuarios de prueba marcados en `app_metadata` con la service role
   (`auth.admin.updateUserById(id, { app_metadata: { es_prueba: true } })`), tanto en
   `pruebas/utilidades/clientesPrueba.js` como en `pruebas-navegador/configuracionGlobal.js`, y
   `limpiar_usuarios_prueba.sql` filtrando `raw_app_meta_data`.

## Resumen

Riesgos: C:0 abiertos (4 críticos mitigados) · H:0 abiertos (3 altos mitigados) · M:1 aceptado
formalmente (R8), el resto mitigados · L: todos mitigados. Las mitigaciones nuevas de R6 y R12 están
incorporadas en la spec (Spec loops 1). Resultado: PASSED.
