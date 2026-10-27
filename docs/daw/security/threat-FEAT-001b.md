# Threat Model FEAT-001b: Edición de Movimientos

| Field | Value |
|-------|-------|
| Ticket | FEAT-001b |
| Spec | docs/daw/specs/spec-FEAT-001b.md |
| PRD | docs/daw/prd/prd-FEAT-001b.md |
| Date | 2026-10-27 |
| Método | STRIDE por componente |

> Parte del threat model de FEAT-001a (`threat-FEAT-001a.md`), que sigue vigente. Aquí se analizan
> solo los componentes que FEAT-001b agrega o modifica, y se suma como activo la contraseña de la
> base de datos que dejó pendiente ADR-003.

## Componentes analizados

| ID | Componente | Dónde se define |
|---|---|---|
| C1 | SPA: menú de la fila (`MenuMovimiento`), selector de tipo (`SelectorTipo`), `FormularioMovimiento` en modo edición y la ruta `/movimientos/:idMovimiento/editar`, con el id del movimiento en la URL | Spec Blocks 3 y 4 |
| C2 | Lectura de un movimiento por id: `ObtenerMovimiento` sobre la vista `bav_movimientos`, que suma la columna `id_categoria` | Spec Blocks 2 y 3 |
| C3 | RPC `BASP_EDITAR_MOVIMIENTO` (`SECURITY DEFINER`) | Spec Block 2 |
| C4 | Tablas `BAT_MOVIMIENTOS` y `BAT_CUENTAS`: cambio del movimiento y del saldo en una sola transacción | Spec Block 2 |
| C5 | Esquema `pruebas`: nuevo punto de falla simulada `EDITAR_MOVIMIENTO` (ADR-002) | Spec Block 2 |
| C6 | Entorno de pruebas: la service role key, la contraseña de la base (conexión directa, ADR-003) y el módulo compartido `pruebas/utilidades/ayudantesSupabase.js` | Spec Blocks 1, 2 y 5 |
| C7 | Script de reversión `supabase/scripts/revertir_edicion_movimientos.sql` | Spec Block 2 |

## Trust boundaries

| ID | Frontera | De → a | Control |
|---|---|---|---|
| TB1 | Internet | Navegador (no confiable) → PostgREST (`bav_movimientos` y RPC `basp_editar_movimiento`) | HTTPS (TLS 1.2+), JWT firmado por Supabase |
| TB2 | Rol de base | PostgREST con rol `authenticated` → vista `BAV_MOVIMIENTOS` | `security_invoker = true`, RLS `FOR SELECT` por propietario, `REVOKE ALL` + `GRANT SELECT` |
| TB3 | Elevación controlada | Rol `authenticated` → `BASP_EDITAR_MOVIMIENTO` ejecutada como `postgres` | `GRANT EXECUTE` solo a `authenticated`, `search_path = ''`, cuenta desde `auth.uid()`, movimiento y categoría validados contra esa cuenta |
| TB4 | URL del navegador | Parámetro `:idMovimiento` (lo puede escribir cualquiera) → `ObtenerMovimiento` y el RPC | Se trata como dato no confiable: lo filtran la RLS y la función; cualquier falla es `{ ok: false }` |
| TB5 | Entorno de pruebas | Máquina de quien desarrolla con la service role y la contraseña de `postgres` → proyecto de Supabase | Secretos solo en `.env.pruebas.local` (ignorado por git), nunca `VITE_`; conexión directa con TLS verificado contra la CA de Supabase |
| TB6 | Código de pruebas ↔ código de la app | `pruebas/utilidades/ayudantesSupabase.js` → `pruebas-navegador/` | El módulo recibe `{ urlSupabase, claveServicio }` por parámetro, no lee `process.env` ni importa `pg` o `vite`, y nada en `src/` lo importa |

## Clasificación de datos

| Dato | Clasificación | En tránsito | En reposo |
|---|---|---|---|
| Monto, tipo, fecha y categoría del movimiento editado; saldo | Financiero (sensible, personal) | TLS (HTTPS de Supabase) | Cifrado de disco AES-256 de Supabase |
| Id del movimiento (uuid) en la URL | Identificador seudónimo, no secreto | TLS | Historial del navegador (sin datos financieros) |
| JWT de la sesión | Credencial | TLS | `localStorage` (riesgo R6 de FEAT-001a, sin cambios) |
| Service role key | Credencial (secreta, máximo privilegio de la API) | TLS | Solo en `.env.pruebas.local` local |
| Contraseña de `postgres` (`SUPABASE_DB_PASSWORD`) | Credencial (secreta, máximo privilegio de la base) | TLS verificado contra `supabase/certificados/prod-ca-2021.crt` (nunca `rejectUnauthorized: false`) | Solo en `.env.pruebas.local` local; nunca en el repo ni en el bundle |

Sin PII nueva: la sesión sigue siendo anónima.

## Análisis STRIDE

| Comp. | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| C1 | R1 | R12 | R11 | R5 | — (estático) | R12 |
| C2 | R1 | — (solo lectura) | R11 | R2, R5 | R10 | R2 |
| C3 | R1 | R3, R4, R6 | R11 | R5 | R10 | R1, R7 |
| C4 | R1 | R3, R6, R8 | R11 | R2 | R10 | R7 |
| C5 | — | R13 | — | R13 | — | R13 |
| C6 | R9 | R9 | — | R9 | — | R9 |
| C7 | — | R14 | — | R14 | — | R14 |

## Riesgos

| ID | Riesgo | STRIDE | Prob. | Impacto | Mitigación | Estado |
|---|---|---|---|---|---|---|
| R1 | Editar o leer el movimiento de otro usuario cambiando el id de la URL o del RPC (IDOR) | S, E | Media | Crítico | `v_id_cuenta` solo desde `auth.uid()`; el movimiento se busca con `id = p_id_movimiento AND id_cuenta = v_id_cuenta`, y si no existe o es ajeno da el mismo `BA404`; la lectura pasa por la RLS de la vista; pruebas AC-23 y lectura ajena en `edicion.test.js` | Mitigado en spec (Blocks 2 y 3) |
| R2 | `CREATE OR REPLACE VIEW` sin `security_invoker`: la vista lee con los permisos de su dueño y salta la RLS | I, E | Media | Crítico | La migración repite `WITH (security_invoker = true)`; `id_categoria` va al final; `pruebas/seguridad.test.js` sigue verificando que un usuario no lee movimientos ajenos por la vista | Mitigado en spec (Block 2) |
| R3 | Saldo inconsistente: falla entre el cambio del movimiento y el del saldo, o dos ediciones concurrentes del mismo movimiento | T | Media | Alto | Todo en una función (una transacción); bloqueo `FOR UPDATE` de la cuenta y después del movimiento, en el mismo orden que el alta; saldo = saldo − efecto anterior + efecto nuevo en un solo UPDATE; pruebas AC-25 (falla simulada) y AC-26 (invariante) | Mitigado en spec (Block 2) |
| R4 | Asignar una categoría de otro usuario o de otro tipo (incluido el cambio de tipo) | T | Media | Alto | Categoría validada con `id_cuenta = v_id_cuenta AND tipo = p_tipo` antes de escribir; además la FK compuesta `BAFK_MOVIMIENTOS_CATEGORIA`; pruebas AC-13 y AC-24 | Mitigado en spec (Block 2) |
| R5 | Mensajes que exponen detalles internos: un id mal formado en la URL da un error de PostgREST (22P02) con texto técnico | I | Media | Bajo | `ObtenerMovimiento` y `EditarMovimiento` devuelven `{ ok: false }` ante cualquier error, id mal formado o ausente; la interfaz muestra solo textos de `src/mensajes/textos.js` | Mitigado en spec (Blocks 3 y 4) |
| R6 | Cambiar `creado_en` o el `id_cuenta` del movimiento al editar | T | Baja | Medio | La función no recibe esos datos y el UPDATE solo toca `tipo`, `monto`, `id_categoria` y `fecha`; prueba de FR-13 / AC-12 en `edicion.test.js` | Mitigado en spec (Block 2) |
| R7 | Los privilegios por defecto de Supabase dan EXECUTE a `anon` sobre la función nueva | E | Alta (si no se revoca) | Crítico | `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated, service_role` + `GRANT EXECUTE ... TO authenticated`, dueño `postgres`; `seguridad.test.js` verifica EXECUTE para los tres roles | Mitigado en spec (Block 2) |
| R8 | Modificar el saldo directamente desde la API aprovechando la edición (FR-25) | T | Baja | Alto | Sin permisos de UPDATE para `authenticated` sobre `BAT_CUENTAS`; el saldo solo cambia dentro de las funciones; prueba AC-33 | Mitigado en spec (Block 2) |
| R9 | Filtración de la service role key o de la contraseña de `postgres`, incluido que el módulo compartido de pruebas lleve la clave al servidor de desarrollo | S, T, I, E | Baja | Crítico | Ambas solo en `.env.pruebas.local`, sin prefijo `VITE_`; el módulo compartido recibe la clave por parámetro, no lee `process.env` y nada de `src/` lo importa; conexión directa con TLS verificado (ADR-003); escaneo de secretos de SAST en CODE | Mitigado en spec (Blocks 1 y 2, ADR-003) |
| R10 | Ediciones en bucle de un usuario | D | Baja | Bajo | Una edición no agrega filas (no hace crecer la base); el bloqueo es solo de la cuenta propia; el resto queda cubierto por el riesgo aceptado R8 de FEAT-001a | Mitigado (diseño) |
| R11 | No queda registro de los valores anteriores de un movimiento editado | R | Baja | Bajo | Los logs de la API de Supabase registran cada llamada al RPC con el usuario; el historial de ediciones está fuera de alcance del PRD; solo se editan datos propios | Mitigado (diseño) |
| R12 | XSS con un nombre de categoría en el menú o en los selectores | T, E | Baja | Alto | React escapa el texto; la regla `react/no-danger` sigue en error y la verificación final busca `dangerouslySetInnerHTML`, `innerHTML` y `eval(` en `src/` | Mitigado en spec (Block 4 y verificación final) |
| R13 | Activar la falla simulada `EDITAR_MOVIMIENTO` para un usuario | T, I, E | Baja | Bajo | El esquema `pruebas` sigue sin acceso para los roles de la API; aunque se activara, solo aborta la edición propia | Mitigado en spec (Block 2, ADR-002) |
| R14 | El script de reversión deja la vista con los privilegios por defecto (lectura para `anon`) o falla a mitad de camino por filas de `EDITAR_MOVIMIENTO` | T, I, E | Baja | Alto | Todo en `BEGIN/COMMIT`; borra primero esas filas de fallas simuladas; recrea la vista con `security_invoker` y repite `REVOKE ALL` + `GRANT SELECT TO authenticated`; no toca la reversión de FEAT-001a, que nunca se ejecuta en esta base porque borra cuentas reales | Mitigado en spec (Block 2) |

## Análisis de dependencias (W-TM-01)

FEAT-001b no agrega dependencias. Las existentes se siguen revisando con `npm audit` en SAST (R13 de
FEAT-001a).

## Mitigaciones a incorporar en la spec

1. R2, R7 — Migración con `security_invoker`, `id_categoria` al final y `REVOKE` + `GRANT` explícitos
   sobre la función; `seguridad.test.js` extendido.
2. R1, R5 — `ObtenerMovimiento` trata como `{ ok: false }` el id mal formado, el inexistente y el
   ajeno; la interfaz muestra un texto fijo y vuelve a Cuenta.
3. R9 — `ayudantesSupabase.js` recibe `{ urlSupabase, claveServicio }`, no lee `process.env` ni importa
   `pg` o `vite`.
4. R14 — Script de reversión transaccional que recrea la vista con sus permisos y borra antes las filas
   de fallas simuladas.
5. ADR-003 — Anotar los nuevos usos de la conexión directa: `EliminarCategoriaPrueba` hace DML sobre
   `public.bat_categorias`, y las pruebas de edición la usan para la falla simulada y para leer
   `creado_en`.

## Resumen

Riesgos: C:0 abiertos (4 críticos mitigados) · H:0 abiertos (5 altos mitigados) · M:0 · L: todos
mitigados. Sin riesgos aceptados nuevos. Resultado: PASSED.
